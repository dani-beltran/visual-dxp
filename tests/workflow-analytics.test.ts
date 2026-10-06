// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest } from '../src/lib/ai';
import { createAnalyticsTools } from '../src/lib/analytics';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, Workflow, WorkflowNode } from '../src/lib/types';
import { createWorkflowTools } from '../src/server/ai/tools';
import {
  applyWorkflowOperations as serverApply,
  parseAIChatRequest as serverParse,
} from '../src/server/ai/workflow/ai';
import type { Workflow as ServerWorkflow } from '../src/server/ai/workflow/types';
import { validateWorkflow as serverValidate } from '../src/server/ai/workflow/validation';

const page = window as Window &
  typeof globalThis & {
    gtag?: ReturnType<typeof vi.fn>;
    dataLayer?: { event: string; [key: string]: unknown }[];
    visualDXP?: ReturnType<typeof createRuntime>;
  };
const runtimes: ReturnType<typeof createRuntime>[] = [];
const node = (
  id: string,
  kind: WorkflowNode['data']['kind'],
  config: WorkflowNode['data']['config'] = {},
): WorkflowNode => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: { kind, label: id, config },
});
const edge = (source: string, target: string, sourceHandle?: string) => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle,
});
function graph(): Workflow & ServerWorkflow {
  return {
    version: 1,
    name: 'Offer journey',
    websiteUrl: window.location.href,
    analytics: {
      provider: 'ga4',
      delivery: 'gtag',
      measurementId: 'G-TEST',
      workflowId: 'offers',
      workflowVersion: '2',
    },
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#start' }),
      node('milestone', 'track-event', { analyticsEventName: 'offer_accepted' }),
      node('end', 'dom', { selector: '#result', action: 'text', value: 'Done' }),
    ],
    edges: [edge('start', 'milestone'), edge('milestone', 'end')],
  };
}
function runtime(workflow: Workflow, options: Parameters<typeof createRuntime>[1] = {}) {
  const result = createRuntime(workflow, options);
  runtimes.push(result);
  return result;
}
const names = () => page.gtag?.mock.calls.map((call) => call[1]);
beforeEach(() => {
  vi.useFakeTimers();
  page.gtag = vi.fn();
  page.dataLayer = [];
  document.body.innerHTML = '<button id="start">Start</button><div id="result"></div>';
});
afterEach(() => {
  for (const value of runtimes.splice(0)) value.destroy();
  page.visualDXP?.destroy();
  delete page.visualDXP;
  delete page.gtag;
  delete page.dataLayer;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each(['gtag', 'gtm'] as const)(
  'sends ordered lifecycle and milestone events through %s, including standalone export',
  async (delivery) => {
    for (const exported of [false, true]) {
      page.gtag?.mockClear();
      page.dataLayer = [];
      const workflow = graph();
      workflow.analytics!.delivery = delivery;
      if (exported) new Function(exportWorkflow(workflow))();
      const value = exported ? page.visualDXP : runtime(workflow);
      if (!value) throw new Error('Runtime missing');
      await value.run('start');
      const events =
        delivery === 'gtag'
          ? page.gtag!.mock.calls.map((call) => ({ event: call[1], ...call[2] }))
          : page.dataLayer;
      expect(events?.map((item) => item.event)).toEqual([
        'dxp_workflow_started',
        'offer_accepted',
        'dxp_workflow_step',
        'dxp_workflow_step',
        'dxp_workflow_completed',
      ]);
      expect(events?.[0]).toMatchObject({
        workflow_id: 'offers',
        workflow_version: '2',
        trigger_id: 'start',
      });
      expect(new Set(events?.map((item) => item.run_id)).size).toBe(1);
      expect(events?.[2]).toMatchObject({
        step_id: 'milestone',
        step_type: 'track-event',
        step_index: 1,
      });
      expect(events?.[4]).toMatchObject({ step_count: 2 });
      expect(document.querySelector('#result')?.textContent).toBe('Done');
      if (delivery === 'gtag') expect(events?.[0].send_to).toBe('G-TEST');
      else expect(page.gtag).not.toHaveBeenCalled();
      value.destroy();
    }
  },
);

it('keeps repeated and overlapping trigger invocations separate', async () => {
  const workflow = graph();
  workflow.nodes.splice(1, 0, node('delay', 'delay', { duration: 20 }));
  workflow.edges = [edge('start', 'delay'), edge('delay', 'milestone'), edge('milestone', 'end')];
  const value = runtime(workflow);
  const one = value.run('start'),
    two = value.run('start');
  await vi.advanceTimersByTimeAsync(30);
  await Promise.all([one, two]);
  const calls = page.gtag!.mock.calls;
  const starts = calls.filter((call) => call[1] === 'dxp_workflow_started');
  const finishes = calls.filter((call) => call[1] === 'dxp_workflow_completed');
  expect(starts).toHaveLength(2);
  expect(finishes).toHaveLength(2);
  expect(new Set(starts.map((call) => call[2].run_id)).size).toBe(2);
  expect(finishes.map((call) => call[2].run_id).sort()).toEqual(
    starts.map((call) => call[2].run_id).sort(),
  );
});

it('tracks only executed branches and each loop iteration, and excludes annotations', async () => {
  const workflow = graph();
  workflow.nodes = [
    workflow.nodes[0],
    node('condition', 'fork', { condition: '#result' }),
    node('loop', 'loop', { iterations: 2 }),
    workflow.nodes[1],
    workflow.nodes[2],
    node('unused', 'track-event', { analyticsEventName: 'unused_event' }),
    node('note', 'note'),
  ];
  workflow.edges = [
    edge('start', 'condition'),
    edge('condition', 'loop', 'true'),
    edge('condition', 'unused', 'false'),
    edge('loop', 'milestone', 'body'),
    edge('loop', 'end', 'done'),
    edge('start', 'note'),
  ];
  await runtime(workflow).run('start');
  expect(names()?.filter((name) => name === 'offer_accepted')).toHaveLength(2);
  expect(names()).not.toContain('unused_event');
  const steps = page
    .gtag!.mock.calls.filter((call) => call[1] === 'dxp_workflow_step')
    .map((call) => call[2]);
  expect(steps.map((params) => params.step_id)).toEqual([
    'condition',
    'milestone',
    'milestone',
    'loop',
    'end',
  ]);
  expect(steps[0].branch).toBe('true');
  expect(steps.map((params) => params.step_index)).toEqual([1, 2, 3, 4, 5]);
});

it('does not report completion for thrown errors, handled HTTP errors, or cancellation', async () => {
  for (const mode of ['throw', 'http', 'abort']) {
    page.gtag?.mockClear();
    const workflow = graph();
    workflow.nodes[1] =
      mode === 'throw'
        ? node('milestone', 'dom', { selector: '#absent', action: 'text', value: 'x' })
        : mode === 'http'
          ? node('milestone', 'http', { url: 'https://example.com/fail' })
          : node('milestone', 'delay', { duration: 100 });
    const value = runtime(workflow, {
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    });
    const pending = value.run('start');
    if (mode === 'abort') value.destroy();
    if (mode === 'throw') await expect(pending).rejects.toThrow();
    else await pending;
    expect(names()).toContain('dxp_workflow_started');
    expect(names()).not.toContain('dxp_workflow_completed');
    expect(
      page
        .gtag!.mock.calls.filter((call) => call[1] === 'dxp_workflow_step')
        .some((call) => call[2].step_id === 'milestone'),
    ).toBe(false);
  }
});

it.each(['disabled', 'missing', 'throwing', 'simulate'])(
  'does not block execution with %s analytics',
  async (mode) => {
    const workflow = graph();
    const logs: RunLog[] = [];
    if (mode === 'disabled') workflow.analytics = { provider: 'none' };
    if (mode === 'missing') delete page.gtag;
    if (mode === 'throwing')
      page.gtag = vi.fn(() => {
        throw new Error('Blocked');
      });
    await runtime(workflow, {
      analyticsMode: mode === 'simulate' ? 'simulate' : 'live',
      onLog: (entry) => logs.push(entry),
    }).run('start');
    expect(document.querySelector('#result')?.textContent).toBe('Done');
    if (mode === 'simulate') {
      expect(page.gtag).not.toHaveBeenCalled();
      expect(logs.filter((entry) => entry.message.startsWith('Simulated analytics'))).toHaveLength(
        5,
      );
    }
    if (mode === 'disabled') expect(page.gtag).not.toHaveBeenCalled();
  },
);

it('passes incoming data onward without adding it to any analytics payload', async () => {
  const workflow = graph();
  workflow.nodes.splice(1, 0, node('request', 'http', { url: 'https://example.com/data' }));
  workflow.nodes[3].data.config.value = '{{secret}}';
  workflow.edges = [
    edge('start', 'request'),
    edge('request', 'milestone'),
    edge('milestone', 'end'),
  ];
  await runtime(workflow, {
    fetch: vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => '{"secret":"private@example.com"}' }),
  }).run('start');
  expect(document.querySelector('#result')?.textContent).toBe('private@example.com');
  expect(JSON.stringify(page.gtag!.mock.calls)).not.toContain('private@example.com');
});

it.each([
  '',
  'two words',
  '4bad',
  'a'.repeat(41),
  'page_view',
  'dxp_workflow_started',
  'google_test',
  '{{value}}',
])('rejects invalid or reserved event name %s', (name) => {
  expect(() => createAnalyticsTools().validateEventName(name)).toThrow();
  const workflow = graph();
  workflow.nodes[1].data.config.analyticsEventName = name;
  expect(validateWorkflow(workflow).length).toBeGreaterThan(0);
  expect(serverValidate(workflow).length).toBeGreaterThan(0);
});

it('preserves and edits event nodes across JSON import, client and server AI, and tool boundaries', async () => {
  const workflow = graph();
  workflow.nodes[1].data.config.analyticsPayload = '{"value":{{price}}}';
  expect(isWorkflow(JSON.parse(JSON.stringify(workflow)))).toBe(true);
  for (const parse of [parseAIChatRequest, serverParse]) {
    const result = parse({
      workflow,
      selectedNodeIds: [],
      messages: [{ role: 'user', content: 'Track a milestone' }],
    });
    expect(result.workflow.analytics).toEqual(workflow.analytics);
    expect(result.workflow.nodes[1].data.config.analyticsEventName).toBe('offer_accepted');
    expect(result.workflow.nodes[1].data.config.analyticsPayload).toBe('{"value":{{price}}}');
  }
  for (const apply of [applyWorkflowOperations, serverApply]) {
    expect(
      apply(workflow, [
        { type: 'update_node', id: 'milestone', config: { analyticsEventName: 'lead_confirmed' } },
      ]).nodes[1].data.config.analyticsEventName,
    ).toBe('lead_confirmed');
  }
  const toolkit = createWorkflowTools(workflow, []);
  const add = toolkit.tools.find((tool) => tool.name === 'add_node');
  expect(add).toBeDefined();
  const result = await add!.invoke({
    kind: 'track-event',
    label: 'Checkout',
    position: { x: 0, y: 0 },
    config: { analyticsEventName: 'checkout_confirmed' },
  });
  expect(JSON.stringify(result)).not.toContain('invalid_configuration');
});

it.each([false, true])(
  'automatically reports experiment identity and assignment without node analytics controls (exported: %s)',
  async (exported) => {
    const workflow = graph();
    workflow.nodes[1] = node('experiment', 'experiment', {
      experimentSplit: 100,
      experimentKey: 'offer_test',
    });
    workflow.edges = [edge('start', 'experiment'), edge('experiment', 'end', 'a')];
    expect(validateWorkflow(workflow)).toEqual([]);
    if (exported) new Function(exportWorkflow(workflow))();
    const value = exported ? page.visualDXP : runtime(workflow);
    if (!value) throw new Error('Missing runtime');
    await value.run('start');
    expect(page.gtag).toHaveBeenCalledWith(
      'event',
      'dxp_workflow_step',
      expect.objectContaining({
        step_id: 'experiment',
        step_type: 'experiment',
        experiment_id: 'offer_test',
        variant_id: 'a',
        branch: 'a',
      }),
    );
    expect(names()).not.toContain('experiment_view');
  },
);

it.each(['gtag', 'gtm'] as const)(
  'resolves JSON payload variables via %s in live and exported workflows',
  async (delivery) => {
    for (const exported of [false, true]) {
      page.gtag?.mockClear();
      page.dataLayer = [];
      const workflow = graph();
      workflow.analytics!.delivery = delivery;
      workflow.nodes[1].data.config.analyticsPayload =
        '{"plan":"{{plan}}","value":{{price}},"items":{{items}},"source":"workflow"}';
      workflow.nodes.splice(1, 0, node('request', 'http', { url: 'https://example.com/data' }));
      workflow.nodes[3].data.config.value = '{{plan}}';
      workflow.edges = [
        edge('start', 'request'),
        edge('request', 'milestone'),
        edge('milestone', 'end'),
      ];
      const input = {
        plan: 'Premium "plus"\n{{literal}}',
        price: 49,
        items: [{ item_id: 'sku1' }],
        secret: 'not-mapped',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(input) }),
      );
      expect(validateWorkflow(workflow)).toEqual([]);
      expect(serverValidate(workflow)).toEqual([]);
      if (exported) new Function(exportWorkflow(workflow))();
      const value = exported ? page.visualDXP! : runtime(workflow);
      await value.run('start');
      const payload =
        delivery === 'gtag'
          ? page.gtag!.mock.calls.find((call) => call[1] === 'offer_accepted')?.[2]
          : page.dataLayer?.find((event) => event.event === 'offer_accepted');
      expect(payload).toMatchObject({
        plan: input.plan,
        value: 49,
        items: input.items,
        source: 'workflow',
        workflow_id: 'offers',
      });
      expect(payload).not.toHaveProperty('secret');
      expect(document.querySelector('#result')?.textContent).toBe(input.plan);
      value.destroy();
      vi.unstubAllGlobals();
    }
  },
);

it.each([
  '[]',
  'null',
  '{bad}',
  '{"event":"override"}',
  '{"send_to":"G-OTHER"}',
  '{"workflow_id":"override"}',
  '{"__proto__":{}}',
])('rejects invalid or reserved JSON payload %s', (payload) => {
  const workflow = graph();
  workflow.nodes[1].data.config.analyticsPayload = payload;
  expect(validateWorkflow(workflow).length).toBeGreaterThan(0);
  expect(serverValidate(workflow).length).toBeGreaterThan(0);
});

it('does not send a custom event or continue after an unresolved payload variable', async () => {
  const workflow = graph();
  workflow.nodes[1].data.config.analyticsPayload = '{"plan":"{{missing}}"}';
  const logs: RunLog[] = [];
  await expect(
    runtime(workflow, { onLog: (entry) => logs.push(entry) }).run('start'),
  ).rejects.toThrow('could not be resolved');
  expect(names()).not.toContain('offer_accepted');
  expect(names()).not.toContain('dxp_workflow_completed');
  expect(document.querySelector('#result')?.textContent).toBe('');
});
