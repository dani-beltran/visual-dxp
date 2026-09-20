import { validateWorkflow } from './export';
import { isNoteMarks } from './noteText';
import type { NodeKind, NoteMark, StepConfig, Workflow, WorkflowEdge, WorkflowNode } from './types';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  workflow: Workflow;
  selectedNodeIds: string[];
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

/** Configure your own authenticated server endpoint; provider keys belong on that server. */
export interface AIChatConfig {
  endpoint: string;
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
  'dom',
  'delay',
  'fork',
  'loop',
  'popover',
  'note',
]);
const configStrings = [
  'event',
  'selector',
  'url',
  'method',
  'headers',
  'body',
  'action',
  'value',
  'attribute',
  'condition',
  'contentType',
  'content',
  'position',
  'noteText',
  'noteColor',
] as const;
const configNumbers = ['duration', 'iterations', 'width'] as const;
const configBooleans = ['noteBold', 'noteItalic', 'noteStrikethrough'] as const;
const own = (value: object, key: string) => Object.hasOwn(value, key);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw new Error(
      `${label} must be ${allowEmpty ? 'text' : 'nonempty text'} of at most ${max} characters.`,
    );
  return value;
}

function id(value: unknown): string {
  const result = text(value, 'An ID', 200);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: IDs must reject control characters.
  if (result.trim() !== result || /[\u0000-\u001f\u007f]/.test(result))
    throw new Error('IDs cannot contain surrounding whitespace or control characters.');
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
    throw new Error('Step positions must contain finite coordinates within the canvas limits.');
  return { x: input.x, y: input.y };
}

function config(value: unknown, complete = false): StepConfig {
  const input = record(value, 'Step configuration');
  const output: Record<string, string | number | boolean | NoteMark[]> = {};
  for (const key of configStrings) {
    if (own(input, key) && input[key] !== undefined)
      output[key] = text(input[key], 'Step configuration text', 20000, true);
  }
  for (const key of configNumbers) {
    if (!own(input, key) || input[key] === undefined) continue;
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]))
      throw new Error('Step configuration numbers must be finite.');
    output[key] = input[key];
  }
  for (const key of configBooleans) {
    if (!own(input, key) || input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean')
      throw new Error('Note text formatting must contain boolean values.');
    output[key] = input[key];
  }
  if (input.noteMarks !== undefined) {
    const length = complete ? ((output.noteText as string | undefined) ?? '').length : Infinity;
    if (!isNoteMarks(input.noteMarks, length))
      throw new Error('Note text formatting must use sorted, nonoverlapping ranges within the note text.');
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
    throw new Error('Note colors must be a six-digit hex color or transparent.');
  return output as StepConfig;
}

/** Pick semantic fields explicitly: never accept styles, arbitrary data or ReactFlow internals. */
function node(value: unknown): WorkflowNode {
  const input = record(value, 'Step');
  const data = record(input.data, 'Step data');
  if (input.type !== 'workflow' || !kinds.has(data.kind as NodeKind))
    throw new Error('Choose a supported workflow step type.');
  return {
    id: id(input.id),
    type: 'workflow',
    position: position(input.position),
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
  if (!['true', 'false', 'body', 'done'].includes(value as string))
    throw new Error('Connections must use a supported output handle.');
  return value as string;
}

function edge(value: unknown): WorkflowEdge {
  const input = record(value, 'Connection');
  if (input.targetHandle != null) throw new Error('Connections cannot specify target handles.');
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
    throw new Error(`An AI response may contain at most ${AI_LIMITS.operations} changes.`);
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
          throw new Error('An update cannot change a step type; remove and add a step instead.');
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
          throw new Error('A step update must contain a change.');
        return update;
      }
      case 'update_edge': {
        if (input.targetHandle != null)
          throw new Error('Connections cannot specify target handles.');
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
          throw new Error('A connection update must contain a change.');
        return update;
      }
      default:
        throw new Error('The AI response contains an unsupported workflow change.');
    }
  });
}

function workflowShape(value: unknown): Workflow {
  const input = record(value, 'Workflow');
  if (input.version !== 1) throw new Error('This workflow version is not supported.');
  if (
    !Array.isArray(input.nodes) ||
    input.nodes.length > AI_LIMITS.nodes ||
    !Array.isArray(input.edges) ||
    input.edges.length > AI_LIMITS.edges
  )
    throw new Error(
      `AI editing supports up to ${AI_LIMITS.nodes} steps and ${AI_LIMITS.edges} connections.`,
    );
  return {
    version: 1,
    name: text(input.name, 'Workflow name', 500, true),
    websiteUrl: text(input.websiteUrl, 'Website URL', 4000, true),
    nodes: input.nodes.map(node),
    edges: input.edges.map(edge),
  };
}

function assertGraph(workflow: Workflow): void {
  const nodes = new Map(workflow.nodes.map((entry) => [entry.id, entry]));
  if (nodes.size !== workflow.nodes.length) throw new Error('Every step must have a unique ID.');
  const edgeIds = new Set<string>();
  const connections = new Set<string>();
  const incoming = new Map(workflow.nodes.map((entry) => [entry.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const entry of workflow.edges) {
    if (edgeIds.has(entry.id)) throw new Error('Every connection must have a unique ID.');
    edgeIds.add(entry.id);
    const source = nodes.get(entry.source);
    const target = nodes.get(entry.target);
    if (!source || !target) throw new Error('A connection refers to a missing step.');
    if (source.data.kind === 'note' || target.data.kind === 'note')
      throw new Error('Notes cannot have workflow connections.');
    if (target.data.kind === 'trigger')
      throw new Error('Triggers cannot receive incoming connections.');
    const allowed =
      source.data.kind === 'fork'
        ? ['true', 'false']
        : source.data.kind === 'loop'
          ? ['body', 'done']
          : [];
    if (allowed.length ? !allowed.includes(entry.sourceHandle ?? '') : entry.sourceHandle != null)
      throw new Error('A connection uses an invalid output for its source step.');
    if (entry.targetHandle != null) throw new Error('Connections cannot specify target handles.');
    const key = JSON.stringify([entry.source, entry.target, entry.sourceHandle ?? null]);
    if (connections.has(key)) throw new Error('Duplicate connections are not allowed.');
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
    throw new Error('Circular connections are not supported. Use a Repeat step instead.');
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
          throw new Error('A step with that ID already exists.');
        nodes.push(change.node);
        break;
      case 'update_node': {
        const index = nodes.findIndex((entry) => entry.id === change.id);
        if (index < 0) throw new Error('The step to update does not exist.');
        const current = nodes[index];
        nodes[index] = {
          ...current,
          position: change.position ?? current.position,
          data: {
            ...current.data,
            ...(change.label !== undefined ? { label: change.label } : {}),
            ...(change.description !== undefined ? { description: change.description } : {}),
            config: {
              ...current.data.config,
              ...(current.data.kind === 'note' && change.config?.noteText !== undefined && change.config.noteMarks === undefined
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
          throw new Error('The step to remove does not exist.');
        nodes = nodes.filter((entry) => entry.id !== change.id);
        edges = edges.filter((entry) => entry.source !== change.id && entry.target !== change.id);
        break;
      case 'add_edge':
        if (edges.some((entry) => entry.id === change.edge.id))
          throw new Error('A connection with that ID already exists.');
        edges.push(change.edge);
        break;
      case 'update_edge': {
        const index = edges.findIndex((entry) => entry.id === change.id);
        if (index < 0) throw new Error('The connection to update does not exist.');
        const { type: _type, id: _id, ...patch } = change;
        edges[index] = { ...edges[index], ...patch };
        break;
      }
      case 'remove_edge':
        if (!edges.some((entry) => entry.id === change.id))
          throw new Error('The connection to remove does not exist.');
        edges = edges.filter((entry) => entry.id !== change.id);
        break;
    }
  }
  const result = { ...workflow, nodes, edges };
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
    throw new Error(`The proposed changes are incomplete or invalid: ${introduced.message}`);
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
    throw new Error(`An AI request needs between 1 and ${AI_LIMITS.messages} messages.`);
  const messages = input.messages.map((entry): AIChatMessage => {
    const message = record(entry, 'Chat message');
    if (message.role !== 'user' && message.role !== 'assistant')
      throw new Error('Chat messages must have a user or assistant role.');
    return {
      role: message.role,
      content: text(message.content, 'Chat message', AI_LIMITS.messageCharacters),
    };
  });
  if (messages.at(-1)?.role !== 'user')
    throw new Error('The last chat message must be from the user.');
  const workflow = workflowShape(input.workflow);
  assertGraph(workflow);
  if (!Array.isArray(input.selectedNodeIds) || input.selectedNodeIds.length > AI_LIMITS.nodes)
    throw new Error('Selected steps must be an array of step IDs.');
  const selectedNodeIds = input.selectedNodeIds.map(id);
  const nodeIds = new Set(workflow.nodes.map((entry) => entry.id));
  if (
    new Set(selectedNodeIds).size !== selectedNodeIds.length ||
    selectedNodeIds.some((key) => !nodeIds.has(key))
  )
    throw new Error('Selected steps must identify existing steps without duplicates.');
  const request = { messages, workflow, selectedNodeIds };
  if (new TextEncoder().encode(JSON.stringify(request)).byteLength > AI_LIMITS.payloadBytes)
    throw new Error('This workflow and conversation are too large for an AI request.');
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
    throw new Error('The AI assistant returned a response that is too large.');
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
          throw new Error('The AI assistant returned a response that is too large.');
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
      throw new Error('The AI assistant returned a response that is too large.');
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error('The AI assistant returned an invalid response. Try again.');
  }
}

/** Sends only the supported graph fields and never displays raw server error bodies. */
export async function requestAIChat(
  settings: AIChatConfig,
  request: AIChatRequest,
  signal?: AbortSignal,
): Promise<AIChatResponse> {
  const endpoint = text(settings.endpoint, 'AI endpoint', 4000);
  const url = new URL(endpoint, 'https://forma.invalid');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Configure an HTTP or HTTPS AI endpoint.');
  const body = JSON.stringify(parseAIChatRequest(request));
  const deadline = AbortSignal.timeout(AI_LIMITS.timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const headers = new Headers(settings.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        credentials: settings.credentials ?? 'same-origin',
        body,
        signal: requestSignal,
      });
    } catch (error) {
      if (requestSignal.aborted || (error instanceof Error && error.name === 'AbortError'))
        throw error;
      throw new Error('Could not reach the AI assistant. Check the connection and try again.');
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 401 || response.status === 403)
        throw new Error(
          'You are not authorized to use this AI assistant. Check your sign-in or endpoint configuration.',
        );
      if (response.status === 429)
        throw new Error('The AI assistant is busy. Try again in a moment.');
      if (response.status === 503)
        throw new Error('The AI assistant is not configured or is temporarily unavailable.');
      throw new Error('The AI request failed. Try again or check your server configuration.');
    }
    const value = await boundedResponse(response);
    try {
      return parseAIChatResponse(value);
    } catch {
      throw new Error('The AI assistant returned an invalid response. Try again.');
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (deadline.aborted) throw new Error('The AI assistant took too long to respond. Try again.');
    throw error;
  }
}
