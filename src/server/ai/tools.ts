import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { applicableAIConfigDefaults } from '../../lib/aiConfig';
import { semanticJSON } from '../../lib/aiProgress';
import { RecoverableToolError } from '../../lib/aiToolErrors';
import type { BrandingProfile } from '../../lib/branding';
import type { WorkflowOperation } from './workflow/ai';
import { applyWorkflowOperations } from './workflow/ai';
import { catalog } from './workflow/catalog';
import { dataTools } from './workflow/data';
import type { Workflow, WorkflowNode } from './workflow/types';

const shortText = z.string().max(200);
const text = z.string().max(20000);
const id = z.string().min(1).max(200);
const position = z.object({ x: z.number().finite(), y: z.number().finite() });
const config = z.object({
  analyticsPayload: text
    .describe(
      'Track event: optional JSON object of GA4 event parameters. Supports incoming-data variables, e.g. {"plan":"{{plan}}","value":{{price}}}.',
    )
    .optional(),
  analyticsEventName: z
    .string()
    .max(40)
    .describe(
      'Track event: static GA4 custom event name, starting with a letter; letters, numbers, underscores only. No reserved names or dxp_ prefix.',
    )
    .optional(),
  dataPath: text
    .describe(
      'Data Transform: nested path such as user.name or items[0].price; empty selects the whole input.',
    )
    .optional(),
  transformations: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ type: z.enum(['capitalize', 'lowercase', 'uppercase', 'title-case', 'trim']) }),
        z.object({ type: z.enum(['prefix', 'suffix']), value: text }),
        z.object({ type: z.literal('replace'), find: text.min(1), replacement: text }),
        z.object({ type: z.literal('fallback'), value: z.json() }),
      ]),
    )
    .max(100)
    .describe(
      'Data Transform operations run in list order. Text operations require strings. Fallback handles only missing or null values.',
    )
    .optional(),

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
  selector: text
    .describe(
      'CSS selector for element triggers, Update element actions, or anchored popovers. Required and non-empty for popovers with position: anchor. Omit for page-wide triggers and non-anchored popovers. Update element actions, including hide/show, may interpolate {{variables}} here.',
    )
    .optional(),
  url: text
    .describe(
      'HTTP request URL or iframe popover URL. HTTP requests support incoming data templates such as {{user.id}} or {{items[0].id}}. Omit for HTML popovers.',
    )
    .optional(),
  method: shortText.optional(),
  headers: text.describe('JSON object encoded as a string, with string header values.').optional(),
  body: text
    .describe(
      'Request body; supports incoming data templates such as {{user.name}}. Omit for GET/HEAD.',
    )
    .optional(),
  conditionOperator: z
    .enum(
      Object.keys(dataTools.operators) as [
        keyof typeof dataTools.operators,
        ...Array<keyof typeof dataTools.operators>,
      ],
    )
    .optional(),
  action: z
    .enum(['text', 'html', 'add-class', 'remove-class', 'hide', 'show', 'attribute'])
    .optional(),
  value: text
    .describe(
      'Update element content; omit for hide/show. Mix literal text and incoming variables such as Hello {{name}}, {{user.name}}, or {{$}} for the whole incoming input.',
    )
    .optional(),
  attribute: text.describe('Attribute name for Update element; supports {{variables}}.').optional(),
  cookieName: text
    .describe(
      'Cookie name on the current host; supports {{name}}, nested paths, and {{$}} from incoming data. Missing/null name variables stop the step. The resolved name must have no spaces or cookie separators.',
    )
    .optional(),
  cookieValue: text
    .describe(
      'Cookie value; supports {{name}}, nested paths, and {{$}} from incoming data. Missing/null value variables become empty text; objects and arrays become JSON. Names and values are percent-encoded after substitution.',
    )
    .optional(),
  cookieDays: z
    .number()
    .int()
    .min(0)
    .max(400)
    .describe('Cookie lifetime in whole days. Zero (default) means browser session.')
    .optional(),
  experimentKey: text
    .describe(
      'Experiment ID shown in the UI, used for assignments and GA4 experiment_id. Required for GA4; otherwise empty uses the node ID. Change it to start a new experiment.',
    )
    .optional(),
  experimentAnalytics: z
    .enum(['none', 'ga4'])
    .describe('Analytics platform; default none. PostHog is unavailable.')
    .optional(),
  experimentSelector: text
    .describe('Required for GA4; CSS selector for visible CTA exposure and interactions.')
    .optional(),
  experimentInteraction: z
    .enum(['click', 'change'])
    .describe(
      'GA4 CTA event, default click; omit when analytics is disabled. Change means field value committed; no values are collected.',
    )
    .optional(),
  experimentDelivery: z
    .enum(['gtag', 'gtm'])
    .describe(
      'GA4 only: existing window.gtag (default), or existing window.dataLayer with GTM forwarding configured by the website owner. Omit when analytics is disabled.',
    )
    .optional(),
  experimentMeasurementId: text
    .describe(
      'Optional G-XXXXXXXXXX send_to destination for GA4 gtag delivery. Omit for GTM or disabled analytics.',
    )
    .optional(),
  experimentSplit: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Percentage of new visitors assigned to A; B receives the remainder. Defaults to 50.')
    .optional(),
  duration: z.number().min(0).max(86400000).describe('Milliseconds.').optional(),
  conditionType: z
    .enum([
      'data',
      'selector',
      'device',
      'language',
      'referrer',
      'date-range',
      'time-of-day',
      'weekdays',
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
      'Expected value: desktop/mobile, language tag (en or en-US), exact referrer domain (example.com; subdomains are distinct), exact stored string, or Data comparison input (numbers, true/false, text, JSON arrays/objects). Empty strings are allowed for named variables. Omit for unary Data operators and selector/date/time conditions.',
    )
    .optional(),
  conditionWeekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .describe(
      'Required for weekdays: selected days, 0 Sunday through 6 Saturday. Matches any selected day.',
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
  conditionTimeZoneOffset: z
    .number()
    .min(-12)
    .max(14)
    .int()
    .describe(
      'Required for conditionTimeZone offset: whole hours from UTC, -12 to +14. No daylight saving adjustment.',
    )
    .optional(),
  conditionTimeZone: z
    .enum(['local', 'utc', 'offset'])
    .describe(
      "Time zone for weekdays, date-range and time-of-day conditions: local uses the visitor's local clock (default); utc uses UTC; offset uses conditionTimeZoneOffset as fixed hours from UTC.",
    )
    .optional(),
  iterations: z.number().int().min(1).max(1000).optional(),
  contentType: z.enum(['html', 'iframe']).optional(),
  content: text
    .describe(
      'Popover HTML. For colored anchored popovers, include a scoped <style> rule targeting the runtime > svg path with fill and stroke matching the adjoining surface/border. Scope by the actual [data-visual-dxp-popover="NODE_ID"] or :has(.unique-content-class), and include that exact unique class on the HTML wrapper. The arrow is outside the content; background/color alone do not recolor it. Preserve matching CSS/classes when updating. Do not generate a second arrow.',
    )
    .optional(),
  position: z
    .enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'anchor'])
    .describe(
      'Popover placement. Position anchor requires a non-empty config.selector identifying the anchor element. Without an anchor selector, use a non-anchored position such as bottom-right (the default). If anchoring is requested but the selector is unknown, ask the user; never invent it. A page-load trigger does not supply an anchor.',
    )
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
export function createWorkflowTools(
  workflow: Workflow,
  selectedNodeIds: string[],
  brandingProfile?: BrandingProfile,
) {
  let draft = structuredClone(workflow);
  const operations: WorkflowOperation[] = [];

  function mutate(operation: WorkflowOperation) {
    try {
      const next = applyWorkflowOperations(draft, [operation]);
      const changed = semanticJSON(next) !== semanticJSON(draft);
      if (changed) {
        if (operations.length >= 100) throw new Error('A request can make at most 100 changes.');
        draft = next;
        operations.push(operation);
      }
      const state =
        operation.type === 'add_node' || operation.type === 'update_node'
          ? {
              node: draft.nodes.find(
                (node) =>
                  node.id === (operation.type === 'add_node' ? operation.node.id : operation.id),
              ),
            }
          : operation.type === 'add_edge' || operation.type === 'update_edge'
            ? {
                edge: draft.edges.find(
                  (edge) =>
                    edge.id === (operation.type === 'add_edge' ? operation.edge.id : operation.id),
                ),
              }
            : {};
      return JSON.stringify({ ok: true, changed, operation, ...state });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid change.',
        ...(error instanceof RecoverableToolError ? { code: error.code, retryable: true } : {}),
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
    const invoke = (input: unknown) => {
      const parsed = fields.schema.safeParse(input);
      if (!parsed.success)
        return JSON.stringify({
          ok: false,
          code: 'invalid_arguments',
          error: `Invalid tool arguments at ${parsed.error.issues.map((issue) => issue.path.join('.') || 'input').join(', ')}. Follow the tool schema and resubmit the corrected call.`,
          retryable: true,
        });
      return handler(parsed.data);
    };
    privateHandlers.set(fields.name, invoke);
    definitions.push({
      type: 'function',
      name: fields.name,
      description: fields.description,
      parameters: z.toJSONSchema(fields.schema),
      strict: false,
    });
    return { ...fields, invoke: async (input: unknown) => invoke(input) };
  }
  const tools = [
    defineTool(() => JSON.stringify({ workflow: draft, selectedNodeIds, brandingProfile }), {
      name: 'read_workflow',
      description:
        'Read the current workflow draft, node IDs, connections, selected nodes and detected website branding. Read before editing.',
      schema: z.object({}),
    }),
    defineTool(
      () =>
        JSON.stringify(
          catalog.map(({ kind, label, description, config: defaults }) => ({
            kind,
            label,
            description,
            defaults: applicableAIConfigDefaults(kind, defaults),
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
            config: { ...applicableAIConfigDefaults(kind, entry.config, patch), ...patch },
          },
        };
        return mutate({ type: 'add_node', node });
      },
      {
        name: 'add_node',
        description:
          'Create a configured node using applicable catalog defaults. Send only fields supported by the resulting configuration. Returns changed and the resulting node plus operation with its generated ID; use that ID to connect executable nodes. Notes cannot be connected. Does not create connections.',
        schema: z.object({
          kind: z.enum([
            'trigger',
            'http',
            'transform',
            'dom',
            'cookie',
            'delay',
            'experiment',
            'track-event',
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
        'Patch label, description, position or configuration of an existing node. Send only fields supported by the resulting configuration. Omitted fields are preserved unless a setting changes which fields apply; then inactive fields are removed. Include any fields required by the resulting configuration. Returns changed and the resulting node. changed:false stages nothing; repeating that call will not help. Replacing noteText without noteMarks clears formatting; provide noteMarks to retain or revise it.',
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
          'Connect existing executable nodes. Connections carry data unchanged. Use a Data Transform node for field selection or transformation. Notes cannot have incoming or outgoing connections. Condition sourceHandle must be true/false; Loop must be body/done; Experiment must be a/b; all other executable nodes use null or omit it. Cycles and incoming trigger connections are unsupported.',
        schema: z.object({
          source: id,
          target: id,
          sourceHandle: z.enum(['true', 'false', 'body', 'done', 'a', 'b']).nullable().optional(),
          label: shortText.optional(),
        }),
      },
    ),
    defineTool((patch) => mutate({ type: 'update_edge', ...patch }), {
      name: 'update_connection',
      description:
        'Rewire or relabel an existing connection. Field selection belongs to Data Transform nodes. Send sourceHandle=null when changing to an ordinary source node.',
      schema: z.object({
        id,
        source: id.optional(),
        target: id.optional(),
        sourceHandle: z.enum(['true', 'false', 'body', 'done', 'a', 'b']).nullable().optional(),
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
