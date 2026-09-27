import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { WorkflowOperation } from './workflow/ai';
import { applyWorkflowOperations } from './workflow/ai';
import { catalog } from './workflow/catalog';
import type { Workflow, WorkflowNode } from './workflow/types';

const shortText = z.string().max(200);
const text = z.string().max(20000);
const id = z.string().min(1).max(200);
const position = z.object({ x: z.number().finite(), y: z.number().finite() });
const config = z.object({
  event: z
    .enum([
      'page-load',
      'click',
      'mouseover',
      'submit',
      'change',
      'zoom-in',
      'swipe',
      'exit-intent',
      'rage-click',
      'inactivity',
      'scroll-thrashing',
      'scroll-depth',
    ])
    .optional(),
  rageClickCount: z
    .number()
    .int()
    .min(2)
    .max(100)
    .describe('Nearby clicks required, default 3.')
    .optional(),
  rageClickWindow: z
    .number()
    .int()
    .min(100)
    .max(60000)
    .describe('Rage click window in milliseconds, default 1000.')
    .optional(),
  rageClickRadius: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe('Distance from first click in CSS pixels, default 50.')
    .optional(),
  scrollDirectionChanges: z
    .number()
    .int()
    .min(2)
    .max(100)
    .describe('Scroll reversals required, default 4.')
    .optional(),
  scrollThrashWindow: z
    .number()
    .int()
    .min(100)
    .max(60000)
    .describe('Scroll thrashing window in milliseconds, default 2000.')
    .optional(),
  scrollMinDistance: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe('Minimum travel per scroll reversal in CSS pixels, default 50.')
    .optional(),
  scrollThreshold: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe('Percentage of page scrollable distance, default 75.')
    .optional(),
  selector: text.optional(),
  url: text.optional(),
  method: shortText.optional(),
  headers: text.describe('JSON object encoded as a string, with string header values.').optional(),
  body: text.optional(),
  action: z
    .enum(['text', 'html', 'add-class', 'remove-class', 'hide', 'show', 'attribute'])
    .optional(),
  value: text.optional(),
  attribute: text.optional(),
  cookieName: text
    .describe('Name of a cookie to set on the current host; no spaces or cookie separators.')
    .optional(),
  cookieValue: text
    .describe('Cookie value; may be empty. Names and values are percent-encoded when written.')
    .optional(),
  cookieDays: z
    .number()
    .int()
    .min(0)
    .max(400)
    .describe('Cookie lifetime in whole days. Zero (default) means browser session.')
    .optional(),
  duration: z.number().min(0).max(86400000).describe('Milliseconds.').optional(),
  conditionType: z
    .enum([
      'selector',
      'device',
      'language',
      'referrer',
      'date-range',
      'time-of-day',
      'query-param',
      'cookie',
    ])
    .describe(
      'Condition source. Cookie checks cookies, localStorage, and sessionStorage. Defaults to selector for older workflows.',
    )
    .optional(),
  condition: text.describe('CSS selector for a selector condition.').optional(),
  conditionKey: text
    .describe('Exact query parameter, cookie, local storage, or session storage key.')
    .optional(),
  conditionValue: text
    .describe(
      'Expected value: desktop/mobile, language tag (en or en-US), exact referrer domain (example.com; subdomains are distinct), or exact stored string. Empty strings are allowed for named variables.',
    )
    .optional(),
  conditionStartDate: text
    .describe(
      'Required for date-range: inclusive start date in YYYY-MM-DD format, using conditionTimeZone.',
    )
    .optional(),
  conditionEndDate: text
    .describe(
      'Required for date-range: inclusive end date in YYYY-MM-DD format, on or after the start date. The entire end date is included.',
    )
    .optional(),
  conditionStartTime: text
    .describe(
      'Required for time-of-day: inclusive start minute in 24-hour HH:MM format, from 00:00 to 23:59.',
    )
    .optional(),
  conditionEndTime: text
    .describe(
      'Required for time-of-day: inclusive end minute in HH:MM format. Earlier than start crosses midnight; equal times match only that minute.',
    )
    .optional(),
  conditionTimeZone: z
    .enum(['local', 'utc'])
    .describe(
      "Time zone for date-range and time-of-day conditions: local uses the visitor's local clock (default); utc uses UTC.",
    )
    .optional(),
  iterations: z.number().int().min(1).max(1000).optional(),
  contentType: z.enum(['html', 'iframe']).optional(),
  content: text.optional(),
  position: z
    .enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'anchor'])
    .optional(),
  width: z.number().min(240).max(960).optional(),
  noteText: text.describe('Plain text for a non-executable canvas note.').optional(),
  noteMarks: z
    .array(
      z.object({
        start: z.number().int().min(0),
        end: z.number().int().min(1),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        strikethrough: z.boolean().optional(),
      }),
    )
    .describe(
      'Sorted, non-overlapping text formatting ranges. Start is inclusive and end exclusive, using UTF-16 offsets within noteText. Send [] to clear formatting.',
    )
    .optional(),
  noteColor: z
    .union([z.string().regex(/^#[0-9a-f]{6}$/i), z.literal('transparent')])
    .describe('A six-digit hex color or transparent for the note background.')
    .optional(),
  noteBold: z.boolean().optional(),
  noteItalic: z.boolean().optional(),
  noteStrikethrough: z.boolean().optional(),
});

/** Every invocation owns its draft; tools never mutate the caller's workflow. */
export function createWorkflowTools(workflow: Workflow, selectedNodeIds: string[]) {
  let draft = structuredClone(workflow);
  const operations: WorkflowOperation[] = [];

  function mutate(operation: WorkflowOperation) {
    try {
      if (operations.length >= 100) throw new Error('A request can make at most 100 changes.');
      const next = applyWorkflowOperations(draft, [operation]);
      draft = next;
      operations.push(operation);
      return JSON.stringify({ ok: true, operation });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid change.',
      });
    }
  }

  // Share the exact schemas and handlers with the SDK loop, without Runnable tracing/checkpoints.
  const privateHandlers = new Map<string, (input: unknown) => string>();
  const definitions: {
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: false;
  }[] = [];
  function defineTool<S extends z.ZodObject, const Name extends string>(
    handler: (input: z.output<S>) => string,
    fields: { name: Name; description: string; schema: S },
  ) {
    privateHandlers.set(fields.name, (input) => handler(fields.schema.parse(input)));
    definitions.push({
      type: 'function',
      name: fields.name,
      description: fields.description,
      parameters: z.toJSONSchema(fields.schema),
      strict: false,
    });
    return { ...fields, invoke: async (input: unknown) => handler(fields.schema.parse(input)) };
  }
  const tools = [
    defineTool(() => JSON.stringify({ workflow: draft, selectedNodeIds }), {
      name: 'read_workflow',
      description:
        'Read the current workflow draft, node IDs, connections and selected nodes. Read before editing.',
      schema: z.object({}),
    }),
    defineTool(
      () =>
        JSON.stringify(
          catalog.map(({ kind, label, description, config: defaults }) => ({
            kind,
            label,
            description,
            defaults,
          })),
        ),
      {
        name: 'read_node_catalog',
        description:
          'Read supported node kinds and their default configuration. Defaults are examples; configure them for the user request.',
        schema: z.object({}),
      },
    ),
    defineTool(
      ({ kind, label, description, config: patch, position: location }) => {
        const entry = catalog.find((item) => item.kind === kind)!;
        const node: WorkflowNode = {
          id: `${kind}-${randomUUID()}`,
          type: 'workflow',
          position: location ?? {
            x: draft.nodes.length
              ? Math.max(...draft.nodes.map((item) => item.position.x)) + 300
              : 60,
            y: 220,
          },
          data: {
            kind,
            label: label ?? entry.label,
            ...(description === undefined ? {} : { description }),
            config: { ...entry.config, ...patch },
          },
        };
        return mutate({ type: 'add_node', node });
      },
      {
        name: 'add_node',
        description:
          'Create a configured node. Returns its generated ID; use that ID to connect executable nodes. Notes are canvas annotations and cannot be connected. Does not create connections.',
        schema: z.object({
          kind: z.enum([
            'trigger',
            'http',
            'dom',
            'cookie',
            'delay',
            'fork',
            'loop',
            'popover',
            'note',
          ]),
          label: shortText.optional(),
          description: z.string().max(2000).optional(),
          config: config.optional(),
          position: position.optional(),
        }),
      },
    ),
    defineTool((patch) => mutate({ type: 'update_node', ...patch }), {
      name: 'update_node',
      description:
        'Update label, description, position or configuration of an existing node. Configuration fields are merged. Replacing noteText without noteMarks clears existing formatting; provide noteMarks to preserve or change formatting ranges.',
      schema: z.object({
        id,
        label: shortText.optional(),
        description: z.string().max(2000).optional(),
        config: config.optional(),
        position: position.optional(),
      }),
    }),
    defineTool(({ id: nodeId }) => mutate({ type: 'remove_node', id: nodeId }), {
      name: 'remove_node',
      description:
        'Remove a node and all of its incident connections. Use only when the user requested removal or replacement.',
      schema: z.object({ id }),
    }),
    defineTool(
      ({ source, target, sourceHandle, label }) =>
        mutate({
          type: 'add_edge',
          edge: {
            id: `edge-${randomUUID()}`,
            source,
            target,
            type: 'smoothstep',
            ...(sourceHandle === undefined ? {} : { sourceHandle }),
            ...(label === undefined ? {} : { label }),
          },
        }),
      {
        name: 'add_connection',
        description:
          'Connect existing executable nodes. Notes cannot have incoming or outgoing connections. Condition sourceHandle must be true/false; Loop must be body/done; all other executable nodes use null or omit it. Cycles and incoming trigger connections are unsupported.',
        schema: z.object({
          source: id,
          target: id,
          sourceHandle: z.enum(['true', 'false', 'body', 'done']).nullable().optional(),
          label: shortText.optional(),
        }),
      },
    ),
    defineTool((patch) => mutate({ type: 'update_edge', ...patch }), {
      name: 'update_connection',
      description:
        'Rewire or relabel an existing connection. Send sourceHandle=null when changing to an ordinary source node.',
      schema: z.object({
        id,
        source: id.optional(),
        target: id.optional(),
        sourceHandle: z.enum(['true', 'false', 'body', 'done']).nullable().optional(),
        label: shortText.optional(),
      }),
    }),
    defineTool(({ id: edgeId }) => mutate({ type: 'remove_edge', id: edgeId }), {
      name: 'remove_connection',
      description: 'Remove a connection using its ID without deleting its nodes.',
      schema: z.object({ id }),
    }),
  ];

  return {
    tools,
    definitions,
    invokePrivate(name: string, input: unknown): string {
      try {
        const handler = privateHandlers.get(name);
        if (!handler) return JSON.stringify({ ok: false, error: 'Unknown workflow tool.' });
        return handler(input);
      } catch {
        return JSON.stringify({
          ok: false,
          error: 'Invalid tool arguments. Check the tool schema and try again.',
        });
      }
    },
    getOperations: () => structuredClone(operations),
    getWorkflow: () => structuredClone(draft),
  };
}
