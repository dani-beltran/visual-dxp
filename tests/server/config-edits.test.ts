import { describe, expect, it } from 'vitest';
import {
  applyWorkflowOperations as applyClient,
  parseAIChatResponse as parseClient,
} from '../../src/lib/ai';
import { aiConfigCapabilities, validateAIConfigWrite } from '../../src/lib/aiConfig';
import { isWorkflow } from '../../src/lib/serialization';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations as applyServer,
  parseAIChatResponse,
} from '../../src/server/ai/workflow/ai';
import type { NodeKind, StepConfig, Workflow } from '../../src/server/ai/workflow/types';
import { experimentKeyRequest } from './experiment-key-fixture';

function workflow(kind: NodeKind, config: StepConfig): Workflow {
  return {
    version: 1,
    name: 'Configuration edits',
    websiteUrl: 'https://example.test',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: {} },
      },
      {
        id: 'target',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: { kind, label: 'Target', description: 'Keep me', config },
      },
    ],
    edges: [{ id: 'edge', type: 'smoothstep', source: 'start', target: 'target' }],
  };
}

const analytics: StepConfig = {
  experimentSplit: 40,
  experimentKey: 'offer',
  experimentAnalytics: 'ga4',
  experimentId: 'offer',
  experimentSelector: '#cta',
  experimentInteraction: 'click',
  experimentDelivery: 'gtag',
  experimentMeasurementId: 'G-TEST123',
};
const { experimentMeasurementId: _measurement, ...gtmAnalytics } = analytics;

const cases: {
  name: string;
  kind: NodeKind;
  before: StepConfig;
  patch: StepConfig;
  after: StepConfig;
}[] = [
  {
    name: 'selector condition to query parameter',
    kind: 'fork',
    before: { condition: '#cta' },
    patch: { conditionType: 'query-param', conditionKey: 'source', conditionValue: 'email' },
    after: { conditionType: 'query-param', conditionKey: 'source', conditionValue: 'email' },
  },
  {
    name: 'binary data condition to unary',
    kind: 'fork',
    before: { conditionType: 'data', conditionValue: 'premium' },
    patch: { conditionOperator: 'exists' },
    after: { conditionType: 'data', conditionOperator: 'exists' },
  },
  {
    name: 'unary data condition to binary',
    kind: 'fork',
    before: { conditionType: 'data', conditionOperator: 'exists' },
    patch: { conditionOperator: 'equal', conditionValue: 'premium' },
    after: { conditionType: 'data', conditionOperator: 'equal', conditionValue: 'premium' },
  },
  {
    name: 'date condition to time range retains shared timezone',
    kind: 'fork',
    before: {
      conditionType: 'date-range',
      conditionStartDate: '2026-01-01',
      conditionEndDate: '2026-12-31',
      conditionTimeZone: 'utc',
    },
    patch: { conditionType: 'time-of-day', conditionStartTime: '09:00', conditionEndTime: '17:00' },
    after: {
      conditionType: 'time-of-day',
      conditionStartTime: '09:00',
      conditionEndTime: '17:00',
      conditionTimeZone: 'utc',
    },
  },
  {
    name: 'query parameter to cookie retains key and value',
    kind: 'fork',
    before: { conditionType: 'query-param', conditionKey: 'source', conditionValue: 'email' },
    patch: { conditionType: 'cookie' },
    after: { conditionType: 'cookie', conditionKey: 'source', conditionValue: 'email' },
  },
  {
    name: 'HTTP POST to lowercase GET',
    kind: 'http',
    before: { method: 'POST', url: 'https://example.test', headers: '{}', body: 'payload' },
    patch: { method: 'get' },
    after: { method: 'get', url: 'https://example.test', headers: '{}' },
  },
  {
    name: 'HTTP POST to PATCH retains body',
    kind: 'http',
    before: { method: 'POST', url: 'https://example.test', body: 'payload' },
    patch: { method: 'PATCH' },
    after: { method: 'PATCH', url: 'https://example.test', body: 'payload' },
  },
  {
    name: 'attribute action to image replacement',
    kind: 'dom',
    before: { selector: '#hero', action: 'attribute', attribute: 'src', value: '/old.jpg' },
    patch: { action: 'replace-image', value: '/new.jpg', imageAlt: 'New image' },
    after: { selector: '#hero', action: 'replace-image', value: '/new.jpg', imageAlt: 'New image' },
  },
  {
    name: 'image replacement to text removes alt',
    kind: 'dom',
    before: {
      selector: '#hero',
      action: 'replace-image',
      value: '/new.jpg',
      imageAlt: 'New image',
    },
    patch: { action: 'text', value: 'Hello' },
    after: { selector: '#hero', action: 'text', value: 'Hello' },
  },
  {
    name: 'attribute action to hide',
    kind: 'dom',
    before: { selector: '#cta', action: 'attribute', attribute: 'title', value: 'Offer' },
    patch: { action: 'hide' },
    after: { selector: '#cta', action: 'hide' },
  },
  {
    name: 'attribute action to text retains value',
    kind: 'dom',
    before: { selector: '#cta', action: 'attribute', attribute: 'title', value: 'Offer' },
    patch: { action: 'text' },
    after: { selector: '#cta', action: 'text', value: 'Offer' },
  },
  {
    name: 'anchored HTML to centered iframe',
    kind: 'popover',
    before: { content: '<p>Offer</p>', position: 'anchor', selector: '#cta', width: 400 },
    patch: { contentType: 'iframe', url: 'https://example.test/embed', position: 'center' },
    after: {
      contentType: 'iframe',
      url: 'https://example.test/embed',
      position: 'center',
      width: 400,
    },
  },
  {
    name: 'iframe to HTML retains anchor',
    kind: 'popover',
    before: {
      contentType: 'iframe',
      url: 'https://example.test/embed',
      position: 'anchor',
      selector: '#cta',
    },
    patch: { contentType: 'html', content: '<p>Offer</p>' },
    after: { contentType: 'html', content: '<p>Offer</p>', position: 'anchor', selector: '#cta' },
  },
  {
    name: 'popover placement alone removes obsolete anchor',
    kind: 'popover',
    before: { content: '<p>Offer</p>', position: 'anchor', selector: '#cta' },
    patch: { position: 'bottom-right' },
    after: { content: '<p>Offer</p>', position: 'bottom-right' },
  },
  {
    name: 'key update preserves legacy analytics configuration',
    kind: 'experiment',
    before: analytics,
    patch: { experimentKey: 'new-offer' },
    after: { ...analytics, experimentKey: 'new-offer' },
  },
];

describe('configuration dependencies across node kinds', () => {
  it.each([
    ['fork', { condition: '#cta' }, { conditionType: 'device' }, { conditionValue: 'mobile' }],
    [
      'fork',
      { conditionType: 'device', conditionValue: 'desktop' },
      { conditionType: 'device', conditionValue: 'tablet' },
      { conditionValue: 'mobile' },
    ],
    ['fork', { condition: '#cta' }, { conditionType: 'language' }, { conditionValue: 'es' }],
    [
      'fork',
      { condition: '#cta' },
      { conditionType: 'referrer' },
      { conditionValue: 'example.com' },
    ],
    [
      'fork',
      { condition: '#cta' },
      { conditionType: 'query-param' },
      { conditionKey: 'source', conditionValue: '' },
    ],
    [
      'fork',
      { condition: '#cta' },
      { conditionType: 'date-range', conditionStartDate: '2026-10-06' },
      { conditionEndDate: '2026-10-07' },
    ],
    [
      'fork',
      { condition: '#cta' },
      { conditionType: 'time-of-day', conditionStartTime: '09:00' },
      { conditionEndTime: '17:00' },
    ],
    ['fork', { condition: '#cta' }, { conditionType: 'weekdays' }, { conditionWeekdays: [1, 2] }],
    [
      'fork',
      { condition: '#cta' },
      { conditionType: 'weekdays', conditionWeekdays: [1], conditionTimeZone: 'offset' },
      { conditionTimeZoneOffset: 2 },
    ],
    [
      'fork',
      { condition: '#cta' },
      { conditionType: 'data', conditionOperator: 'matches', conditionValue: '[' },
      { conditionValue: '^hello' },
    ],
    ['dom', { selector: 'h1' }, { action: 'attribute' }, { selector: 'h1', attribute: 'title' }],
    ['popover', { content: 'Hello' }, { contentType: 'iframe' }, { url: 'https://example.com' }],
    ['popover', { content: 'Hello' }, { position: 'anchor' }, { selector: '#cta' }],
    [
      'trigger',
      { event: 'page-load' },
      { event: 'click', selector: '' },
      { selector: '#shop-now' },
    ],
    ['http', { url: 'https://example.com' }, { headers: '{broken' }, { headers: '{}' }],
    [
      'cookie',
      { cookieName: 'audience', cookieValue: '' },
      { cookieName: 'bad name' },
      { cookieName: 'audience' },
    ],
    [
      'track-event',
      { analyticsEventName: 'purchase' },
      { analyticsEventName: 'bad name' },
      { analyticsEventName: 'purchase' },
    ],
  ] satisfies [NodeKind, StepConfig, StepConfig, StepConfig][])(
    'makes semantic %s failures recoverable for adds and updates: %j → %j',
    (kind, before, invalid, repair) => {
      const original = workflow(kind, before);
      if (kind === 'trigger') original.edges = [];
      for (const name of ['add_node', 'update_node']) {
        const toolkit = createWorkflowTools(original, []);
        const args = name === 'add_node' ? { kind } : { id: 'target' };
        const result = JSON.parse(toolkit.invokePrivate(name, { ...args, config: invalid }));
        expect(result).toMatchObject({
          ok: false,
          code: 'invalid_configuration',
          retryable: true,
          error: expect.stringContaining('Correct the node configuration'),
        });
        expect(toolkit.getOperations()).toEqual([]);
        expect(toolkit.getWorkflow()).toEqual(original);
        expect(
          JSON.parse(toolkit.invokePrivate(name, { ...args, config: { ...invalid, ...repair } })),
        ).toMatchObject({ ok: true });
        expect(applyClient(original, toolkit.getOperations())).toEqual(toolkit.getWorkflow());
      }
    },
  );

  it.each(cases)(
    '$name: stages once and replays identically on server and client',
    ({ kind, before, patch, after }) => {
      const original = workflow(kind, before);
      const snapshot = structuredClone(original);
      const toolkit = createWorkflowTools(original, ['target']);
      const result = JSON.parse(
        toolkit.invokePrivate('update_node', { id: 'target', config: patch }),
      );
      expect(result).toMatchObject({ ok: true, changed: true, node: { data: { config: after } } });
      const expected = structuredClone(original);
      expected.nodes[1].data.config = after;
      expect(toolkit.getWorkflow()).toEqual(expected);
      const transported = JSON.parse(
        JSON.stringify(
          parseAIChatResponse({ message: 'Updated.', operations: toolkit.getOperations() }),
        ),
      );
      expect(applyServer(original, transported.operations)).toEqual(expected);
      expect(applyClient(original, parseClient(transported).operations)).toEqual(expected);
      expect(
        JSON.parse(toolkit.invokePrivate('update_node', { id: 'target', config: patch })),
      ).toMatchObject({ ok: true, changed: false });
      expect(toolkit.getOperations()).toHaveLength(1);
      expect(original).toEqual(snapshot);
    },
  );

  it.each([
    [
      'http',
      { url: 'https://example.test', body: 'Historical body' },
      { method: 'get', headers: '{}' },
    ],
    [
      'dom',
      { selector: '#cta', attribute: 'title', value: 'Offer' },
      { action: 'text', value: 'New' },
    ],
    [
      'fork',
      { condition: '#cta', conditionValue: 'Historical value' },
      { conditionType: 'selector', condition: '#new' },
    ],
    [
      'popover',
      { content: '<p>Offer</p>', url: 'https://example.test/old', selector: '#old' },
      { contentType: 'html', position: 'bottom-right', width: 400 },
    ],
    [
      'experiment',
      { experimentKey: 'offer', experimentId: 'Historical ID' },
      { experimentSplit: 30 },
    ],
  ] satisfies [NodeKind, StepConfig, StepConfig][])(
    'preserves historical fields on same-mode %s patches',
    (kind, before, patch) => {
      const original = workflow(kind, before);
      for (const apply of [applyServer, applyClient]) {
        expect(
          apply(original, [{ type: 'update_node', id: 'target', config: patch }]).nodes[1].data
            .config,
        ).toEqual({ ...before, ...patch });
        expect(
          apply(original, [{ type: 'update_node', id: 'target', label: 'Renamed' }]).nodes[1].data
            .config,
        ).toEqual(before);
      }
    },
  );

  it.each([
    ['http', { url: 'https://example.test' }, { body: 'Inactive' }],
    [
      'http',
      { url: 'https://example.test', method: 'POST', body: 'Old' },
      { method: 'HEAD', body: 'Inactive' },
    ],
    ['dom', { selector: '#cta', action: 'hide' }, { value: 'Inactive' }],
    ['dom', { selector: '#cta' }, { attribute: 'title' }],
    [
      'fork',
      { conditionType: 'data', conditionOperator: 'exists' },
      { conditionValue: 'Inactive' },
    ],
    [
      'fork',
      { condition: '#cta' },
      {
        conditionType: 'cookie',
        conditionKey: 'key',
        conditionValue: 'value',
        condition: '#obsolete',
      },
    ],
    ['popover', { content: '<p>Offer</p>' }, { url: 'https://example.test' }],
    ['popover', { content: '<p>Offer</p>' }, { selector: '#inactive' }],
    ['experiment', {}, { experimentSelector: '.inactive' }],
    [
      'experiment',
      { ...gtmAnalytics, experimentDelivery: 'gtm' },
      { experimentMeasurementId: 'G-TEST123' },
    ],
  ] satisfies [NodeKind, StepConfig, StepConfig][])(
    'rejects inactive fields in %s writes atomically',
    (kind, before, patch) => {
      const original = workflow(kind, before);
      const snapshot = structuredClone(original);
      const toolkit = createWorkflowTools(original, ['target']);
      expect(
        JSON.parse(toolkit.invokePrivate('update_node', { id: 'target', config: patch })),
      ).toMatchObject({
        ok: false,
        error: expect.stringMatching(/Invalid configuration fields|Invalid tool arguments/),
      });
      expect(toolkit.getOperations()).toEqual([]);
      expect(toolkit.getWorkflow()).toEqual(original);
      for (const apply of [applyServer, applyClient]) {
        expect(() =>
          apply(original, [
            { type: 'update_node', id: 'target', label: 'Must not persist' },
            { type: 'update_node', id: 'target', config: patch },
          ]),
        ).toThrow(/Invalid configuration fields/);
      }
      expect(original).toEqual(snapshot);
    },
  );

  it.each([
    ['fork', { condition: '#cta' }, { conditionType: 'time-of-day' }],
    [
      'fork',
      { conditionType: 'data', conditionOperator: 'exists' },
      { conditionOperator: 'equal' },
    ],
    ['dom', { selector: '#cta' }, { action: 'attribute' }],
    ['popover', { content: '<p>Offer</p>' }, { contentType: 'iframe' }],
    ['popover', { content: '<p>Offer</p>' }, { position: 'anchor' }],
    ['experiment', {}, { experimentAnalytics: 'ga4' }],
  ] satisfies [NodeKind, StepConfig, StepConfig][])(
    'requires missing fields when changing %s mode',
    (kind, before, patch) => {
      const original = workflow(kind, before);
      for (const apply of [applyServer, applyClient])
        expect(() =>
          apply(original, [{ type: 'update_node', id: 'target', config: patch }]),
        ).toThrow();
    },
  );

  it.each([
    ['dom', { action: 'hide', selector: '#shop-now' }, ['value', 'attribute', 'changes']],
    [
      'fork',
      { conditionType: 'data', conditionOperator: 'exists' },
      ['condition', 'conditionValue'],
    ],
    [
      'popover',
      { contentType: 'iframe', url: 'https://example.test/embed' },
      ['content', 'selector'],
    ],
  ] satisfies [NodeKind, StepConfig, string[]][])(
    'filters inactive catalog defaults when adding %s',
    (kind, config, absent) => {
      const original = workflow('delay', { duration: 100 });
      const toolkit = createWorkflowTools(original, []);
      const result = JSON.parse(toolkit.invokePrivate('add_node', { kind, config }));
      expect(result).toMatchObject({ ok: true, changed: true, node: { data: { config } } });
      for (const field of absent) expect(result.node.data.config).not.toHaveProperty(field);
      expect(applyClient(original, toolkit.getOperations())).toEqual(toolkit.getWorkflow());
    },
  );
});

describe('issue #38 configuration capabilities', () => {
  it('exposes experiment-only capabilities and the shared analytics authoring path', () => {
    const input = experimentKeyRequest();
    const toolkit = createWorkflowTools(input.workflow, input.selectedNodeIds);
    const read = JSON.parse(toolkit.invokePrivate('read_workflow', {}));
    const id = input.selectedNodeIds[0];
    expect(read.workflow).toEqual(input.workflow);
    expect(read.configCapabilities[id]).toMatchObject({
      kind: 'experiment',
      applicableFields: ['experimentKey', 'experimentSplit'],
      modes: {},
    });
    expect(read.analyticsAuthoring).toMatchObject({ path: 'workflow.analytics' });
    expect(read.analyticsAuthoring.instruction).toContain('Analytics tab');
    const entry = JSON.parse(toolkit.invokePrivate('read_node_catalog', {})).find(
      (entry: { kind: string }) => entry.kind === 'experiment',
    );
    expect(entry.configCapabilities).toEqual(read.configCapabilities[id]);
    for (const definition of toolkit.definitions.filter(({ name }) =>
      ['update_node', 'add_node', 'insert_node'].includes(name),
    )) {
      const schema = JSON.stringify(definition.parameters);
      expect(schema).not.toContain('experimentAnalytics');
      expect(schema).not.toContain('experimentSelector');
      expect(schema).not.toContain('Required for GA4');
    }
  });

  it('returns repair details and replays only the requested key change on server and client', () => {
    const input = experimentKeyRequest();
    const snapshot = structuredClone(input);
    const id = input.selectedNodeIds[0];
    const toolkit = createWorkflowTools(input.workflow, input.selectedNodeIds);
    const failure = JSON.parse(
      toolkit.invokePrivate('update_node', {
        id,
        config: { experimentSplit: 50, conditionType: 'selector', condition: 'h1' },
      }),
    );
    expect(failure).toMatchObject({
      ok: false,
      code: 'invalid_configuration',
      retryable: true,
      details: {
        kind: 'experiment',
        invalidFields: ['condition', 'conditionType'],
        applicableFields: ['experimentKey', 'experimentSplit'],
        currentConfig: { experimentSplit: 50 },
        repairHint: expect.stringContaining('changed partial patch'),
      },
    });
    expect(toolkit.getOperations()).toEqual([]);
    const patch = { id, config: { experimentKey: 'headline-test-v1' } };
    expect(JSON.parse(toolkit.invokePrivate('update_node', patch))).toMatchObject({
      ok: true,
      changed: true,
    });
    const expected = structuredClone(input.workflow);
    const experiment = expected.nodes.find((node) => node.id === id);
    if (!experiment) throw new Error('Missing fixture experiment');
    experiment.data.config.experimentKey = 'headline-test-v1';
    expect(toolkit.getOperations()).toEqual([{ type: 'update_node', ...patch }]);
    for (const apply of [applyServer, applyClient])
      expect(apply(input.workflow, toolkit.getOperations())).toEqual(expected);
    expect(toolkit.getWorkflow()).toEqual(expected);
    expect(input).toEqual(snapshot);
  });

  it('describes mode transitions without blocking fields made active by the patch', () => {
    const capabilities = aiConfigCapabilities('http', {
      method: 'GET',
      url: 'https://example.test',
    });
    expect(capabilities.applicableFields).not.toContain('body');
    expect(capabilities.policy.variants[0].options.POST.fields).toContain('body');
    expect(() =>
      validateAIConfigWrite('http', { method: 'POST', body: '{}' }, { method: 'GET' }),
    ).not.toThrow();
    const fork = aiConfigCapabilities('fork', { conditionType: 'selector' });
    expect(fork.policy.variants[0].options.data.variants[0].options.exists.fields).toEqual([]);
    expect(fork.policy.variants[0].options.data.variants[0].options.equal.fields).toContain(
      'conditionValue',
    );
  });

  it('preserves saved legacy configuration but rejects new legacy analytics writes without silently dropping them', () => {
    const original = workflow('experiment', analytics);
    expect(isWorkflow(original)).toBe(true);
    const toolkit = createWorkflowTools(original, ['target']);
    for (const name of ['update_node', 'add_node']) {
      expect(
        JSON.parse(
          toolkit.invokePrivate(name, {
            id: 'target',
            kind: 'experiment',
            config: { experimentAnalytics: 'ga4' },
          }),
        ),
      ).toMatchObject({ ok: false, code: 'invalid_arguments', retryable: true });
    }
    expect(toolkit.getOperations()).toEqual([]);
    expect(toolkit.getWorkflow()).toEqual(original);
    expect(
      JSON.parse(
        toolkit.invokePrivate('update_node', {
          id: 'target',
          config: { experimentKey: 'new-key' },
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(toolkit.getWorkflow().nodes[1].data.config).toEqual({
      ...analytics,
      experimentKey: 'new-key',
    });
  });
});
