import { context, propagation } from '@opentelemetry/api';
import { configBeforeAIPatch, validateAIConfigWrite } from './aiConfig';
import {
  AI_BASE_URL_HEADER,
  AI_KEY_HEADER,
  AI_MODEL_HEADER,
  AI_PROVIDER_HEADER,
  AI_RESERVED_HEADERS,
  AIConfigurationError,
  type AIRequestConfiguration,
  allowsBrowserCredentials,
  isAIProvider,
  isBrowserConfiguration,
  OPENAI_KEY_HEADER,
  OPENAI_MODEL_HEADER,
  OPENAI_OVERRIDE_HEADER,
  resolveAIEndpoint,
  validBrowserConfiguration,
} from './aiCredentials';
import { getAIEditFailure } from './aiErrors';
import { responseLines, safeTextEmitter } from './aiStream';
import { type BrandingProfile, parseBrandingProfile } from './branding';
import { type DataTransformation, dataTransformTools } from './dataTransform';
import { validateWorkflow } from './export';
import { framesFirst, removeNodes } from './frames';
import { isNoteMarks } from './noteText';
import type { NodeKind, StepConfig, Workflow, WorkflowEdge, WorkflowNode } from './types';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  workflow: Workflow;
  selectedNodeIds: string[];
  brandingProfile?: BrandingProfile;
}

export type WorkflowOperation =
  | { type: 'add_node'; node: WorkflowNode }
  | {
      type: 'update_node';
      id: string;
      label?: string;
      description?: string;
      config?: StepConfig;
      position?: { x: number; y: number };
    }
  | { type: 'remove_node'; id: string }
  | { type: 'add_edge'; edge: WorkflowEdge }
  | {
      type: 'update_edge';
      id: string;
      source?: string;
      target?: string;
      sourceHandle?: string | null;
      label?: string;
    }
  | { type: 'remove_edge'; id: string };

export interface AIChatResponse {
  message: string;
  operations: WorkflowOperation[];
}

/** Explicitly opt in to an AI server; encrypted settings manage browser overrides. */
export interface AIChatConfig {
  endpoint: string;
  /** Show the AI Settings tab when an explicit nonempty endpoint is supplied. Default: true. */
  showSettings?: boolean;
  /** Application authentication/CSRF only. X-DXP-OpenAI-* headers are reserved. */
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

export const AI_LIMITS = {
  operations: 100,
  nodes: 500,
  edges: 1000,
  messages: 40,
  messageCharacters: 12000,
  payloadBytes: 1024 * 1024,
  timeoutMs: 120000,
} as const;

const kinds = new Set<NodeKind>([
  'trigger',
  'http',
  'transform',
  'dom',
  'cookie',
  'delay',
  'experiment',
  'fork',
  'loop',
  'popover',
  'note',
  'frame',
]);
const configStrings = [
  'event',
  'selector',
  'url',
  'method',
  'headers',
  'body',
  'dataPath',
  'action',
  'value',
  'attribute',
  'experimentKey',
  'experimentAnalytics',
  'experimentId',
  'experimentSelector',
  'experimentInteraction',
  'experimentDelivery',
  'experimentMeasurementId',
  'cookieName',
  'cookieValue',
  'condition',
  'conditionType',
  'conditionOperator',
  'conditionKey',
  'conditionValue',
  'conditionStartDate',
  'conditionEndDate',
  'conditionStartTime',
  'conditionEndTime',
  'conditionTimeZone',
  'contentType',
  'content',
  'position',
  'noteText',
  'noteColor',
] as const;
const configNumbers = [
  'experimentSplit',
  'cookieDays',
  'duration',
  'iterations',
  'width',
  'rageClickCount',
  'rageClickWindow',
  'rageClickRadius',
  'scrollDirectionChanges',
  'scrollThrashWindow',
  'scrollMinDistance',
  'scrollThreshold',
] as const;
const configBooleans = ['noteBold', 'noteItalic', 'noteStrikethrough'] as const;
const own = (value: object, key: string) => Object.hasOwn(value, key);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Object.assign(new Error(`${label} must be an object.`), {
      messageKey: 'errors.ai.labelMustBeAnObject',
      messageParams: { label: String(label) },
    });
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw Object.assign(
      new Error(
        `${label} must be ${allowEmpty ? 'text' : 'nonempty text'} of at most ${max} characters.`,
      ),
      {
        messageKey: 'errors.ai.labelMustBeValue2OfAtMostMaxCharacters',
        messageParams: {
          label: String(label),
          value2: String(allowEmpty ? 'text' : 'nonempty text'),
          max: String(max),
        },
      },
    );
  return value;
}

function id(value: unknown): string {
  const result = text(value, 'An ID', 200);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: IDs must reject control characters.
  if (result.trim() !== result || /[\u0000-\u001f\u007f]/.test(result))
    throw Object.assign(
      new Error('IDs cannot contain surrounding whitespace or control characters.'),
      {
        messageKey: 'errors.ai.idsCannotContainSurroundingWhitespaceOrControlCharacters',
        messageParams: {},
      },
    );
  return result;
}

function position(value: unknown): WorkflowNode['position'] {
  const input = record(value, 'Step position');
  if (
    typeof input.x !== 'number' ||
    !Number.isFinite(input.x) ||
    Math.abs(input.x) > 1000000 ||
    typeof input.y !== 'number' ||
    !Number.isFinite(input.y) ||
    Math.abs(input.y) > 1000000
  )
    throw Object.assign(
      new Error('Step positions must contain finite coordinates within the canvas limits.'),
      {
        messageKey: 'errors.ai.stepPositionsMustContainFiniteCoordinatesWithinTheCanvasLimits',
        messageParams: {},
      },
    );
  return { x: input.x, y: input.y };
}

function config(value: unknown, complete = false): StepConfig {
  const input = record(value, 'Step configuration');
  const output: Record<string, unknown> = {};
  for (const key of configStrings) {
    if (own(input, key) && input[key] !== undefined)
      output[key] = text(input[key], 'Step configuration text', 20000, true);
  }
  for (const [key, values, messageKey] of [
    ['experimentAnalytics', ['none', 'ga4'], 'invalidPlatform'],
    ['experimentDelivery', ['gtag', 'gtm'], 'invalidDelivery'],
    ['experimentInteraction', ['click', 'change'], 'invalidInteraction'],
  ] as const) {
    if (output[key] !== undefined && !(values as readonly string[]).includes(output[key] as string))
      throw Object.assign(new Error('Choose a supported Experiment analytics option.'), {
        messageKey: `experiment.${messageKey}`,
      });
  }
  for (const key of configNumbers) {
    if (!own(input, key) || input[key] === undefined) continue;
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]))
      throw Object.assign(new Error('Step configuration numbers must be finite.'), {
        messageKey: 'errors.ai.stepConfigurationNumbersMustBeFinite',
        messageParams: {},
      });
    output[key] = input[key];
  }
  for (const key of configBooleans) {
    if (!own(input, key) || input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean')
      throw Object.assign(new Error('Note text formatting must contain boolean values.'), {
        messageKey: 'errors.ai.noteTextFormattingMustContainBooleanValues',
        messageParams: {},
      });
    output[key] = input[key];
  }
  if (input.transformations !== undefined) {
    dataTransformTools.validate(
      { transformations: input.transformations as DataTransformation[] },
      true,
    );
    output.transformations = (input.transformations as DataTransformation[]).map((item) => {
      if (item.type === 'fallback' || item.type === 'prefix' || item.type === 'suffix')
        return { type: item.type, value: structuredClone(item.value) };
      if (item.type === 'replace')
        return { type: item.type, find: item.find, replacement: item.replacement };
      return { type: item.type };
    });
  }
  if (input.noteMarks !== undefined) {
    const length = complete ? ((output.noteText as string | undefined) ?? '').length : Infinity;
    if (!isNoteMarks(input.noteMarks, length))
      throw Object.assign(
        new Error(
          'Note text formatting must use sorted, nonoverlapping ranges within the note text.',
        ),
        {
          messageKey: 'errors.ai.noteTextFormattingMustUseSortedNonoverlappingRangesWithinThe',
          messageParams: {},
        },
      );
    output.noteMarks = input.noteMarks.map((mark) => ({
      start: mark.start,
      end: mark.end,
      ...(mark.bold !== undefined ? { bold: mark.bold } : {}),
      ...(mark.italic !== undefined ? { italic: mark.italic } : {}),
      ...(mark.strikethrough !== undefined ? { strikethrough: mark.strikethrough } : {}),
    }));
  }
  if (
    output.noteColor !== undefined &&
    output.noteColor !== 'transparent' &&
    !/^#[\da-f]{6}$/i.test(output.noteColor as string)
  )
    throw Object.assign(new Error('Note colors must be a six-digit hex color or transparent.'), {
      messageKey: 'errors.ai.noteColorsMustBeASixDigitHexColorOr',
      messageParams: {},
    });
  return output as StepConfig;
}

/** Pick semantic fields explicitly: never accept styles, arbitrary data or ReactFlow internals. */
function node(value: unknown): WorkflowNode {
  const input = record(value, 'Step');
  const data = record(input.data, 'Step data');
  if (input.type !== 'workflow' || !kinds.has(data.kind as NodeKind))
    throw Object.assign(new Error('Choose a supported workflow step type.'), {
      messageKey: 'errors.ai.chooseASupportedWorkflowStepType',
      messageParams: {},
    });
  const dimensions: { width?: number; height?: number } = {};
  if (data.kind === 'frame') {
    for (const key of ['width', 'height'] as const) {
      if (input[key] === undefined) continue;
      if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] <= 0)
        throw Object.assign(new Error('Frame dimensions must be positive numbers.'), {
          messageKey: 'errors.ai.frameDimensionsMustBePositiveNumbers',
          messageParams: {},
        });
      dimensions[key] = input[key];
    }
  }
  return {
    id: id(input.id),
    type: 'workflow',
    position: position(input.position),
    ...dimensions,
    ...(input.parentId !== undefined ? { parentId: id(input.parentId) } : {}),
    data: {
      kind: data.kind as NodeKind,
      label: text(data.label, 'Step label', 200, true),
      ...(data.description !== undefined
        ? { description: text(data.description, 'Step description', 2000, true) }
        : {}),
      config: config(data.config, true),
    },
  };
}

function handle(value: unknown): string | null {
  if (value === null) return null;
  if (!['true', 'false', 'body', 'done', 'a', 'b'].includes(value as string))
    throw Object.assign(new Error('Connections must use a supported output handle.'), {
      messageKey: 'errors.ai.connectionsMustUseASupportedOutputHandle',
      messageParams: {},
    });
  return value as string;
}

function edge(value: unknown): WorkflowEdge {
  const input = record(value, 'Connection');
  if (input.targetHandle != null)
    throw Object.assign(new Error('Connections cannot specify target handles.'), {
      messageKey: 'errors.ai.connectionsCannotSpecifyTargetHandles',
      messageParams: {},
    });
  return {
    id: id(input.id),
    source: id(input.source),
    target: id(input.target),
    type: 'smoothstep',
    ...(input.sourceHandle !== undefined ? { sourceHandle: handle(input.sourceHandle) } : {}),
    ...(input.label !== undefined
      ? { label: text(input.label, 'Connection label', 200, true) }
      : {}),
  };
}

function operations(value: unknown): WorkflowOperation[] {
  if (!Array.isArray(value) || value.length > AI_LIMITS.operations)
    throw Object.assign(
      new Error(`An AI response may contain at most ${AI_LIMITS.operations} changes.`),
      {
        messageKey: 'errors.ai.anAiResponseMayContainAtMostOperationsChanges',
        messageParams: { operations: String(AI_LIMITS.operations) },
      },
    );
  return value.map((entry): WorkflowOperation => {
    const input = record(entry, 'Workflow change');
    switch (input.type) {
      case 'add_node':
        return { type: input.type, node: node(input.node) };
      case 'add_edge':
        return { type: input.type, edge: edge(input.edge) };
      case 'remove_node':
      case 'remove_edge':
        return { type: input.type, id: id(input.id) };
      case 'update_node': {
        if (own(input, 'kind') || own(input, 'data'))
          throw Object.assign(
            new Error('An update cannot change a step type; remove and add a step instead.'),
            {
              messageKey: 'errors.ai.anUpdateCannotChangeAStepTypeRemoveAndAdd',
              messageParams: {},
            },
          );
        const update: Extract<WorkflowOperation, { type: 'update_node' }> = {
          type: input.type,
          id: id(input.id),
        };
        if (input.label !== undefined) update.label = text(input.label, 'Step label', 200, true);
        if (input.description !== undefined)
          update.description = text(input.description, 'Step description', 2000, true);
        if (input.config !== undefined) update.config = config(input.config);
        if (input.position !== undefined) update.position = position(input.position);
        if (Object.keys(update).length === 2)
          throw Object.assign(new Error('A step update must contain a change.'), {
            messageKey: 'errors.ai.aStepUpdateMustContainAChange',
            messageParams: {},
          });
        return update;
      }
      case 'update_edge': {
        if (input.targetHandle != null)
          throw Object.assign(new Error('Connections cannot specify target handles.'), {
            messageKey: 'errors.ai.connectionsCannotSpecifyTargetHandles',
            messageParams: {},
          });
        const update: Extract<WorkflowOperation, { type: 'update_edge' }> = {
          type: input.type,
          id: id(input.id),
        };
        if (input.source !== undefined) update.source = id(input.source);
        if (input.target !== undefined) update.target = id(input.target);
        if (input.sourceHandle !== undefined) update.sourceHandle = handle(input.sourceHandle);
        if (input.label !== undefined)
          update.label = text(input.label, 'Connection label', 200, true);
        if (Object.keys(update).length === 2)
          throw Object.assign(new Error('A connection update must contain a change.'), {
            messageKey: 'errors.ai.aConnectionUpdateMustContainAChange',
            messageParams: {},
          });
        return update;
      }
      default:
        throw Object.assign(new Error('The AI response contains an unsupported workflow change.'), {
          messageKey: 'errors.ai.theAiResponseContainsAnUnsupportedWorkflowChange',
          messageParams: {},
        });
    }
  });
}

function workflowShape(value: unknown): Workflow {
  const input = record(value, 'Workflow');
  if (input.includeSubpages !== undefined && typeof input.includeSubpages !== 'boolean')
    throw Object.assign(new Error('Include subpages must be a boolean.'), {
      messageKey: 'errors.ai.includeSubpagesMustBeABoolean',
      messageParams: {},
    });
  if (input.version !== 1)
    throw Object.assign(new Error('This workflow version is not supported.'), {
      messageKey: 'errors.ai.thisWorkflowVersionIsNotSupported',
      messageParams: {},
    });
  if (
    !Array.isArray(input.nodes) ||
    input.nodes.length > AI_LIMITS.nodes ||
    !Array.isArray(input.edges) ||
    input.edges.length > AI_LIMITS.edges
  )
    throw Object.assign(
      new Error(
        `AI editing supports up to ${AI_LIMITS.nodes} steps and ${AI_LIMITS.edges} connections.`,
      ),
      {
        messageKey: 'errors.ai.aiEditingSupportsUpToNodesStepsAndEdgesConnections',
        messageParams: { nodes: String(AI_LIMITS.nodes), edges: String(AI_LIMITS.edges) },
      },
    );
  return {
    version: 1,
    name: text(input.name, 'Workflow name', 500, true),
    websiteUrl: text(input.websiteUrl, 'Website URL', 4000, true),
    includeSubpages: input.includeSubpages ?? false,
    nodes: input.nodes.map(node),
    edges: input.edges.map(edge),
  };
}

function assertGraph(workflow: Workflow): void {
  const nodes = new Map(workflow.nodes.map((entry) => [entry.id, entry]));
  if (nodes.size !== workflow.nodes.length)
    throw Object.assign(new Error('Every step must have a unique ID.'), {
      messageKey: 'errors.ai.everyStepMustHaveAUniqueId',
      messageParams: {},
    });
  for (const entry of workflow.nodes) {
    if (
      entry.parentId !== undefined &&
      (entry.data.kind === 'frame' || nodes.get(entry.parentId)?.data.kind !== 'frame')
    )
      throw Object.assign(new Error('Nodes must belong to an existing top-level frame.'), {
        messageKey: 'errors.ai.nodesMustBelongToAnExistingTopLevelFrame',
        messageParams: {},
      });
  }
  const edgeIds = new Set<string>();
  const connections = new Set<string>();
  const incoming = new Map(workflow.nodes.map((entry) => [entry.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const entry of workflow.edges) {
    if (edgeIds.has(entry.id))
      throw Object.assign(new Error('Every connection must have a unique ID.'), {
        messageKey: 'errors.ai.everyConnectionMustHaveAUniqueId',
        messageParams: {},
      });
    edgeIds.add(entry.id);
    const source = nodes.get(entry.source);
    const target = nodes.get(entry.target);
    if (!source || !target)
      throw Object.assign(new Error('A connection refers to a missing step.'), {
        messageKey: 'errors.ai.aConnectionRefersToAMissingStep',
        messageParams: {},
      });
    if (source.data.kind === 'note' || target.data.kind === 'note')
      throw Object.assign(new Error('Notes cannot have workflow connections.'), {
        messageKey: 'errors.ai.notesCannotHaveWorkflowConnections',
        messageParams: {},
      });
    if (source.data.kind === 'frame' || target.data.kind === 'frame')
      throw Object.assign(new Error('Frames cannot have workflow connections.'), {
        messageKey: 'errors.ai.framesCannotHaveWorkflowConnections',
        messageParams: {},
      });
    if (target.data.kind === 'trigger')
      throw Object.assign(new Error('Triggers cannot receive incoming connections.'), {
        messageKey: 'errors.ai.triggersCannotReceiveIncomingConnections',
        messageParams: {},
      });
    const allowed =
      source.data.kind === 'experiment'
        ? ['a', 'b']
        : source.data.kind === 'fork'
          ? ['true', 'false']
          : source.data.kind === 'loop'
            ? ['body', 'done']
            : [];
    if (allowed.length ? !allowed.includes(entry.sourceHandle ?? '') : entry.sourceHandle != null)
      throw Object.assign(new Error('A connection uses an invalid output for its source step.'), {
        messageKey: 'errors.ai.aConnectionUsesAnInvalidOutputForItsSourceStep',
        messageParams: {},
      });
    if (entry.targetHandle != null)
      throw Object.assign(new Error('Connections cannot specify target handles.'), {
        messageKey: 'errors.ai.connectionsCannotSpecifyTargetHandles',
        messageParams: {},
      });
    const key = JSON.stringify([entry.source, entry.target, entry.sourceHandle ?? null]);
    if (connections.has(key))
      throw Object.assign(new Error('Duplicate connections are not allowed.'), {
        messageKey: 'errors.ai.duplicateConnectionsAreNotAllowed',
        messageParams: {},
      });
    connections.add(key);
    incoming.set(entry.target, incoming.get(entry.target)! + 1);
    const targets = outgoing.get(entry.source) ?? [];
    targets.push(entry.target);
    outgoing.set(entry.source, targets);
  }
  const ready = [...incoming.keys()].filter((key) => incoming.get(key) === 0);
  for (let index = 0; index < ready.length; index += 1) {
    for (const target of outgoing.get(ready[index]) ?? []) {
      const count = incoming.get(target)! - 1;
      incoming.set(target, count);
      if (count === 0) ready.push(target);
    }
  }
  if (ready.length !== nodes.size)
    throw Object.assign(
      new Error('Circular connections are not supported. Use a Repeat step instead.'),
      {
        messageKey: 'errors.ai.circularConnectionsAreNotSupportedUseARepeatStepInstead',
        messageParams: {},
      },
    );
}

/** Apply all changes together, or throw without changing the caller's workflow. */
export function applyWorkflowOperations(workflow: Workflow, value: unknown): Workflow {
  const changes = operations(value);
  // Validate field types before running the existing semantic validator. Graph
  // relationships are checked after all operations, allowing remove/add rewrites.
  const baseline = workflowShape(workflow);
  const previousIssues = new Set(validateWorkflow(baseline).map((issue) => JSON.stringify(issue)));
  let nodes = workflow.nodes.map((entry) => ({
    ...entry,
    position: { ...entry.position },
    data: { ...entry.data, config: { ...entry.data.config } },
  }));
  let edges = workflow.edges.map((entry) => ({ ...entry }));
  for (const change of changes) {
    switch (change.type) {
      case 'add_node':
        if (nodes.some((entry) => entry.id === change.node.id))
          throw Object.assign(new Error('A step with that ID already exists.'), {
            messageKey: 'errors.ai.aStepWithThatIdAlreadyExists',
            messageParams: {},
          });
        validateAIConfigWrite(change.node.data.kind, change.node.data.config);
        nodes.push(change.node);
        break;
      case 'update_node': {
        const index = nodes.findIndex((entry) => entry.id === change.id);
        if (index < 0)
          throw Object.assign(new Error('The step to update does not exist.'), {
            messageKey: 'errors.ai.theStepToUpdateDoesNotExist',
            messageParams: {},
          });
        const current = nodes[index];
        if (change.config)
          validateAIConfigWrite(current.data.kind, change.config, current.data.config);
        nodes[index] = {
          ...current,
          position: change.position ?? current.position,
          data: {
            ...current.data,
            ...(change.label !== undefined ? { label: change.label } : {}),
            ...(change.description !== undefined ? { description: change.description } : {}),
            config: {
              ...configBeforeAIPatch(current.data.kind, current.data.config, change.config),
              ...(current.data.kind === 'note' &&
              change.config?.noteText !== undefined &&
              change.config.noteMarks === undefined
                ? { noteMarks: [], noteBold: false, noteItalic: false, noteStrikethrough: false }
                : {}),
              ...change.config,
            },
          },
        };
        break;
      }
      case 'remove_node':
        if (!nodes.some((entry) => entry.id === change.id))
          throw Object.assign(new Error('The step to remove does not exist.'), {
            messageKey: 'errors.ai.theStepToRemoveDoesNotExist',
            messageParams: {},
          });
        nodes = removeNodes(nodes, new Set([change.id]));
        edges = edges.filter((entry) => entry.source !== change.id && entry.target !== change.id);
        break;
      case 'add_edge':
        if (edges.some((entry) => entry.id === change.edge.id))
          throw Object.assign(new Error('A connection with that ID already exists.'), {
            messageKey: 'errors.ai.aConnectionWithThatIdAlreadyExists',
            messageParams: {},
          });
        edges.push(change.edge);
        break;
      case 'update_edge': {
        const index = edges.findIndex((entry) => entry.id === change.id);
        if (index < 0)
          throw Object.assign(new Error('The connection to update does not exist.'), {
            messageKey: 'errors.ai.theConnectionToUpdateDoesNotExist',
            messageParams: {},
          });
        const { type: _type, id: _id, ...patch } = change;
        edges[index] = { ...edges[index], ...patch };
        break;
      }
      case 'remove_edge':
        if (!edges.some((entry) => entry.id === change.id))
          throw Object.assign(new Error('The connection to remove does not exist.'), {
            messageKey: 'errors.ai.theConnectionToRemoveDoesNotExist',
            messageParams: {},
          });
        edges = edges.filter((entry) => entry.id !== change.id);
        break;
    }
  }
  const result = { ...workflow, nodes: framesFirst(nodes), edges };
  const validated = workflowShape(result);
  assertGraph(validated);
  // An editor may contain an empty or triggerless draft. Completeness notices
  // do not block editing; graph and step configuration errors still do.
  const introduced = validated.nodes.length
    ? validateWorkflow(validated).find(
        (issue) =>
          issue.message !== 'Add at least one trigger.' &&
          !previousIssues.has(JSON.stringify(issue)),
      )
    : undefined;
  if (introduced)
    throw Object.assign(
      new Error(`The proposed changes are incomplete or invalid: ${introduced.message}`),
      {
        messageKey: 'errors.ai.theProposedChangesAreIncompleteOrInvalidMessage',
        messageParams: { message: String(introduced.message) },
      },
    );
  return result;
}

export function parseAIChatResponse(value: unknown): AIChatResponse {
  const input = record(value, 'AI response');
  return {
    message: text(input.message, 'AI reply', AI_LIMITS.messageCharacters),
    operations: operations(input.operations),
  };
}

export function parseAIChatRequest(value: unknown): AIChatRequest {
  const input = record(value, 'AI request');
  if (
    !Array.isArray(input.messages) ||
    !input.messages.length ||
    input.messages.length > AI_LIMITS.messages
  )
    throw Object.assign(
      new Error(`An AI request needs between 1 and ${AI_LIMITS.messages} messages.`),
      {
        messageKey: 'errors.ai.anAiRequestNeedsBetween1AndMessagesMessages',
        messageParams: { messages: String(AI_LIMITS.messages) },
      },
    );
  const messages = input.messages.map((entry): AIChatMessage => {
    const message = record(entry, 'Chat message');
    if (message.role !== 'user' && message.role !== 'assistant')
      throw Object.assign(new Error('Chat messages must have a user or assistant role.'), {
        messageKey: 'errors.ai.chatMessagesMustHaveAUserOrAssistantRole',
        messageParams: {},
      });
    return {
      role: message.role,
      content: text(message.content, 'Chat message', AI_LIMITS.messageCharacters),
    };
  });
  if (messages.at(-1)?.role !== 'user')
    throw Object.assign(new Error('The last chat message must be from the user.'), {
      messageKey: 'errors.ai.theLastChatMessageMustBeFromTheUser',
      messageParams: {},
    });
  const workflow = workflowShape(input.workflow);
  assertGraph(workflow);
  if (!Array.isArray(input.selectedNodeIds) || input.selectedNodeIds.length > AI_LIMITS.nodes)
    throw Object.assign(new Error('Selected steps must be an array of step IDs.'), {
      messageKey: 'errors.ai.selectedStepsMustBeAnArrayOfStepIds',
      messageParams: {},
    });
  const selectedNodeIds = input.selectedNodeIds.map(id);
  const nodeIds = new Set(workflow.nodes.map((entry) => entry.id));
  if (
    new Set(selectedNodeIds).size !== selectedNodeIds.length ||
    selectedNodeIds.some((key) => !nodeIds.has(key))
  )
    throw Object.assign(
      new Error('Selected steps must identify existing steps without duplicates.'),
      {
        messageKey: 'errors.ai.selectedStepsMustIdentifyExistingStepsWithoutDuplicates',
        messageParams: {},
      },
    );
  const request = {
    messages,
    workflow,
    selectedNodeIds,
    ...(input.brandingProfile !== undefined
      ? { brandingProfile: parseBrandingProfile(input.brandingProfile, workflow.websiteUrl) }
      : {}),
  };
  if (new TextEncoder().encode(JSON.stringify(request)).byteLength > AI_LIMITS.payloadBytes)
    throw Object.assign(
      new Error('This workflow and conversation are too large for an AI request.'),
      { messageKey: 'errors.ai.thisWorkflowAndConversationAreTooLargeForAnAi', messageParams: {} },
    );
  return request;
}

/** Semantic snapshot for rejecting proposals made against a different canvas revision. */
export function workflowFingerprint(workflow: Workflow): string {
  // Reconstructing in a fixed key order also ignores object insertion order.
  return JSON.stringify(workflowShape(workflow));
}

async function boundedResponse(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > AI_LIMITS.payloadBytes) {
    await response.body?.cancel();
    throw Object.assign(new Error('The AI assistant returned a response that is too large.'), {
      messageKey: 'errors.ai.theAiAssistantReturnedAResponseThatIsTooLarge',
      messageParams: {},
    });
  }
  const reader = response.body?.getReader();
  let body = '';
  if (reader) {
    const decoder = new TextDecoder();
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > AI_LIMITS.payloadBytes) {
          await reader.cancel();
          throw Object.assign(
            new Error('The AI assistant returned a response that is too large.'),
            {
              messageKey: 'errors.ai.theAiAssistantReturnedAResponseThatIsTooLarge',
              messageParams: {},
            },
          );
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  } else {
    body = await response.text();
    if (new TextEncoder().encode(body).byteLength > AI_LIMITS.payloadBytes)
      throw Object.assign(new Error('The AI assistant returned a response that is too large.'), {
        messageKey: 'errors.ai.theAiAssistantReturnedAResponseThatIsTooLarge',
        messageParams: {},
      });
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw Object.assign(new Error('The AI assistant returned an invalid response. Try again.'), {
      messageKey: 'errors.ai.theAiAssistantReturnedAnInvalidResponseTryAgain',
      messageParams: {},
    });
  }
}

function workflowEditError(value: unknown): Error | undefined {
  const failure = getAIEditFailure(value);
  return failure
    ? Object.assign(new Error(failure.message), {
        code: failure.code,
        messageKey: `errors.ai.${failure.code}`,
        messageParams: {},
      })
    : undefined;
}

/** Sends only the supported graph fields and never displays raw server error bodies. */
export async function requestAIChat(
  settings: AIChatConfig,
  request: AIChatRequest,
  signal?: AbortSignal,
  configuration?: AIRequestConfiguration,
  onText?: (text: string) => void,
): Promise<AIChatResponse> {
  const override =
    configuration && isBrowserConfiguration(configuration) ? configuration : undefined;
  const provider = configuration?.provider ?? 'openai';
  if (!isAIProvider(provider))
    throw Object.assign(new AIConfigurationError('Choose a supported AI provider.'), {
      messageKey: 'errors.ai.chooseASupportedAiProvider',
      messageParams: {},
    });
  const endpoint = text(settings.endpoint, 'AI endpoint', 4000);
  const url = resolveAIEndpoint(
    endpoint,
    typeof window === 'undefined' ? undefined : window.location.origin,
  );
  if (override && (!allowsBrowserCredentials(url) || override.origin !== url.origin))
    throw Object.assign(
      new AIConfigurationError(
        'Browser credentials require HTTPS and confirmation of this server origin.',
      ),
      {
        messageKey: 'errors.ai.browserCredentialsRequireHttpsAndConfirmationOfThisServerOrigin',
        messageParams: {},
      },
    );
  if (override && !validBrowserConfiguration(override))
    throw Object.assign(
      new AIConfigurationError(
        'Browser AI settings are incomplete or invalid. Save a complete key and model pair.',
      ),
      {
        messageKey: 'errors.ai.browserAiSettingsAreIncompleteOrInvalidSaveAComplete',
        messageParams: {},
      },
    );
  const body = JSON.stringify(parseAIChatRequest(request));
  const deadline = AbortSignal.timeout(AI_LIMITS.timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const headers = new Headers(settings.headers);
  if (AI_RESERVED_HEADERS.some((header) => headers.has(header)))
    throw Object.assign(
      new AIConfigurationError(
        'Use browser AI settings for provider credentials; reserve ai.headers for application authentication.',
      ),
      {
        messageKey: 'errors.ai.useBrowserAiSettingsForProviderCredentialsReserveAiHeaders',
        messageParams: {},
      },
    );
  headers.set(AI_PROVIDER_HEADER, provider);
  if (override) {
    if (override.apiKey && (body.includes(override.apiKey) || url.href.includes(override.apiKey)))
      throw Object.assign(
        new Error('Remove credentials from your conversation or workflow before sending.'),
        {
          messageKey: 'errors.ai.removeCredentialsFromYourConversationOrWorkflowBeforeSending',
          messageParams: {},
        },
      );
    // Retain the legacy OpenAI wire protocol for existing embedding backends.
    if (override.apiKey)
      headers.set(provider === 'openai' ? OPENAI_KEY_HEADER : AI_KEY_HEADER, override.apiKey);
    headers.set(provider === 'openai' ? OPENAI_MODEL_HEADER : AI_MODEL_HEADER, override.model);
    if (override.baseURL) headers.set(AI_BASE_URL_HEADER, override.baseURL);
    headers.set(OPENAI_OVERRIDE_HEADER, 'browser');
  }
  // Reuse a host application's active browser trace, if it has configured OTel.
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  for (const name of ['traceparent', 'tracestate'])
    if (carrier[name]) headers.set(name, carrier[name]);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', onText ? 'application/x-ndjson, application/json' : 'application/json');
  try {
    let response: Response;
    try {
      response = await fetch(override ? url.href : endpoint, {
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        method: 'POST',
        headers,
        credentials: settings.credentials ?? 'same-origin',
        body,
        signal: requestSignal,
      });
    } catch (error) {
      if (requestSignal.aborted || (error instanceof Error && error.name === 'AbortError'))
        throw error;
      throw Object.assign(
        new Error('Could not reach the AI assistant. Check the connection and try again.'),
        {
          messageKey: 'errors.ai.couldNotReachTheAiAssistantCheckTheConnectionAnd',
          messageParams: {},
        },
      );
    }
    if (response.redirected)
      throw Object.assign(
        new Error('AI server redirects are not allowed. Configure the final HTTPS endpoint.'),
        {
          messageKey: 'errors.ai.aiServerRedirectsAreNotAllowedConfigureTheFinalHttps',
          messageParams: {},
        },
      );
    if (!response.ok) {
      if (response.status === 422) {
        let failure: Error | undefined;
        try {
          failure = workflowEditError(await boundedResponse(response));
        } catch {
          /* Unrecognized or malformed errors retain the existing safe fallback. */
        }
        if (failure) throw failure;
      }
      void response.body?.cancel().catch(() => {});
      if (response.status === 401 || response.status === 403)
        throw Object.assign(
          new AIConfigurationError(
            'The AI endpoint rejected the request. Check your endpoint configuration.',
          ),
          {
            messageKey: 'errors.ai.theAiEndpointRejectedTheRequestCheckYourEndpointConfiguration',
            messageParams: {},
          },
        );
      if (override && (response.status === 400 || response.status === 422))
        throw new AIConfigurationError(
          provider === 'local'
            ? 'Run the demo app and model server locally. Check the localhost base URL, optional key, and model. The model must support workflow tool calls. No changes were applied.'
            : 'Check your browser API key and model in AI Settings. The override was rejected; no server fallback was used.',
        );
      if (response.status === 409)
        throw Object.assign(
          new AIConfigurationError(
            'This provider is unavailable in the current execution mode. Save its configuration in AI Settings.',
          ),
          {
            messageKey: 'errors.ai.thisProviderIsUnavailableInTheCurrentExecutionModeSave',
            messageParams: {},
          },
        );
      if (response.status === 429)
        throw Object.assign(new Error('The AI assistant is busy. Try again in a moment.'), {
          messageKey: 'errors.ai.theAiAssistantIsBusyTryAgainInAMoment',
          messageParams: {},
        });
      if (response.status === 503)
        throw Object.assign(
          new AIConfigurationError(
            'The AI assistant is not configured or is temporarily unavailable.',
          ),
          {
            messageKey: 'errors.ai.theAiAssistantIsNotConfiguredOrIsTemporarilyUnavailable',
            messageParams: {},
          },
        );
      if (response.status === 502)
        throw Object.assign(
          new AIConfigurationError('Check your API key and model in AI Settings.'),
          { messageKey: 'errors.ai.checkYourApiKeyAndModelInAiSettings', messageParams: {} },
        );
      throw Object.assign(new Error('The AI request failed. Try again or check AI Settings.'), {
        messageKey: 'errors.ai.theAiRequestFailedTryAgainOrCheckAiSettings',
        messageParams: {},
      });
    }
    let value: unknown;
    if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
      let finished = false;
      const emit = safeTextEmitter(override?.apiKey ?? '', (text) => onText?.(text));
      for await (const line of responseLines(response, AI_LIMITS.payloadBytes)) {
        requestSignal.throwIfAborted();
        if (!line) continue;
        const event = JSON.parse(line);
        if (finished || !event || typeof event !== 'object') throw new Error('Invalid AI stream.');
        if (event.type === 'text' && typeof event.text === 'string') {
          emit(event.text);
        } else if (event.type === 'result') {
          value = event.response;
          finished = true;
        } else {
          const failure = event.type === 'error' ? workflowEditError(event) : undefined;
          if (failure) throw failure;
          throw new Error(
            'The AI request failed. No changes were applied. Try again or check AI Settings.',
          );
        }
      }
      if (!finished) throw new Error('The AI response was interrupted. No changes were applied.');
    } else value = await boundedResponse(response);
    requestSignal.throwIfAborted();
    if (override?.apiKey && JSON.stringify(value).includes(override.apiKey))
      throw Object.assign(
        new Error('The AI server returned an unsafe response. No changes were applied.'),
        {
          messageKey: 'errors.ai.theAiServerReturnedAnUnsafeResponseNoChangesWere',
          messageParams: {},
        },
      );
    try {
      return parseAIChatResponse(value);
    } catch {
      throw Object.assign(new Error('The AI assistant returned an invalid response. Try again.'), {
        messageKey: 'errors.ai.theAiAssistantReturnedAnInvalidResponseTryAgain',
        messageParams: {},
      });
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (deadline.aborted)
      throw Object.assign(new Error('The AI assistant took too long to respond. Try again.'), {
        messageKey: 'errors.ai.theAiAssistantTookTooLongToRespondTryAgain',
        messageParams: {},
      });
    throw error;
  }
}
