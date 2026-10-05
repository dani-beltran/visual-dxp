// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest } from '../src/lib/ai';
import { createNode } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { previewBridgeSource } from '../src/lib/previewBridge';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';
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
    dataLayer?: unknown[];
    visualDXP?: ReturnType<typeof createRuntime>;
  };
const runtimes: ReturnType<typeof createRuntime>[] = [];
const config: StepConfig = {
  experimentAnalytics: 'ga4',
  experimentId: 'homepage-cta-v1',
  experimentKey: 'assignment-only',
  experimentSelector: '.cta',
  experimentInteraction: 'click',
  experimentDelivery: 'gtag',
  experimentSplit: 100,
};
function node(
  id: string,
  kind: WorkflowNode['data']['kind'],
  config: StepConfig = {},
): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function workflow(settings: StepConfig = config): Workflow & ServerWorkflow {
  return {
    version: 1,
    name: 'Analytics',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#start' }),
      node('test', 'experiment', settings),
      node('a', 'dom', {
        selector: '#slot',
        action: 'html',
        value: '<button class="cta" data-variant="a"><span>Private text</span></button>',
      }),
      node('b', 'dom', {
        selector: '#slot',
        action: 'html',
        value: '<input class="cta" data-variant="b" value="private@example.com">',
      }),
    ],
    edges: [
      { id: 'start-test', source: 'start', target: 'test' },
      { id: 'a', source: 'test', target: 'a', sourceHandle: 'a' },
      { id: 'b', source: 'test', target: 'b', sourceHandle: 'b' },
    ],
  };
}
async function settle() {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(32);
}
function dispatch(selector: string, type = 'click') {
  const event = new Event(type, { bubbles: true, cancelable: true });
  document.querySelector(selector)!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '<button id="start">Run</button><main id="slot"></main>';
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = Number(this.getAttribute('data-top') ?? 10);
    return {
      top,
      bottom: top + 30,
      left: 10,
      right: 110,
      width: 100,
      height: 30,
      x: 10,
      y: top,
      toJSON: () => ({}),
    };
  });
  page.gtag = vi.fn();
  page.dataLayer = [];
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  page.visualDXP?.destroy();
  delete page.visualDXP;
  delete page.gtag;
  delete page.dataLayer;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

for (const exported of [false, true])
  for (const variant of ['a', 'b'] as const)
    for (const interaction of ['click', 'change'] as const)
      for (const delivery of ['gtag', 'gtm'] as const) {
        it(`${exported ? 'standalone' : 'runtime'}: variant ${variant}, ${interaction}, ${delivery} uses the assigned branch only`, async () => {
          const random = vi.spyOn(Math, 'random').mockReturnValue(variant === 'a' ? 0.1 : 0.9);
          const graph = workflow({
            ...config,
            experimentSplit: 50,
            experimentInteraction: interaction,
            experimentDelivery: delivery,
            experimentMeasurementId: 'G-TEST123',
          });
          let runtime: ReturnType<typeof createRuntime>;
          if (exported) {
            new Function('window', 'document', exportWorkflow(graph))(window, document);
            runtime = page.visualDXP!;
          } else {
            runtime = createRuntime(graph);
            runtimes.push(runtime);
          }
          await runtime.run();
          expect(document.querySelector('.cta')?.getAttribute('data-variant')).toBe(variant);
          expect(page.gtag).not.toHaveBeenCalled();
          expect(page.dataLayer).toEqual([]);
          dispatch('.cta', interaction); // No interaction before visible exposure.
          await settle();
          await runtime.run();
          await runtime.run();
          await settle(); // Replaced CTA and repeated execution.
          dispatch(variant === 'a' ? '.cta span' : '.cta', interaction);
          dispatch('.cta', interaction === 'click' ? 'change' : 'click');
          expect(random).toHaveBeenCalledTimes(1);
          const parameters = { experiment_id: 'homepage-cta-v1', variant_id: variant };
          if (delivery === 'gtag') {
            expect(page.gtag?.mock.calls).toEqual([
              ['event', 'experiment_view', { ...parameters, send_to: 'G-TEST123' }],
              [
                'event',
                'experiment_cta',
                { ...parameters, cta_type: interaction, send_to: 'G-TEST123' },
              ],
            ]);
            expect(page.dataLayer).toEqual([]);
          } else {
            expect(page.gtag).not.toHaveBeenCalled();
            expect(page.dataLayer).toEqual([
              { event: 'experiment_view', ...parameters },
              { event: 'experiment_cta', ...parameters, cta_type: interaction },
            ]);
          }
          runtime.destroy();
          dispatch('.cta', interaction);
          await settle();
          expect(delivery === 'gtag' ? page.gtag?.mock.calls.length : page.dataLayer?.length).toBe(
            2,
          );
        });
      }

it.each(['input', 'select', 'checkbox'] as const)(
  'tracks committed %s changes without collecting values or intercepting forms',
  async (kind) => {
    const graph = workflow({ ...config, experimentInteraction: 'change' });
    graph.nodes[2].data.config.value = `<form><${kind === 'select' ? 'select' : 'input'} class="cta" type="${kind === 'checkbox' ? 'checkbox' : 'text'}" value="private@example.com">${kind === 'select' ? '<option>Secret</option></select>' : ''}</form>`;
    const runtime = createRuntime(graph);
    runtimes.push(runtime);
    await runtime.run();
    await settle();
    dispatch('.cta', 'input');
    expect(page.gtag).toHaveBeenCalledTimes(1);
    dispatch('.cta', 'change');
    expect(page.gtag).toHaveBeenCalledTimes(2);
    dispatch('form', 'submit');
    expect(page.gtag).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(page.gtag?.mock.calls)).not.toMatch(/private|Secret|value/);
  },
);

it('waits for visibility, handles delayed insertion/replacement, and deduplicates exposure', async () => {
  const graph = workflow();
  graph.edges.splice(1);
  const runtime = createRuntime(graph);
  runtimes.push(runtime);
  await runtime.run();
  await settle();
  expect(page.gtag).not.toHaveBeenCalled();
  document.querySelector('#slot')!.innerHTML =
    '<section style="display:none"><button class="cta"><span>Click</span></button></section>';
  await settle();
  dispatch('.cta span');
  expect(page.gtag).not.toHaveBeenCalled();
  document.querySelector('section')!.removeAttribute('style');
  document.querySelector('.cta')!.setAttribute('data-top', '2000');
  await settle();
  expect(page.gtag).not.toHaveBeenCalled();
  document.querySelector('.cta')!.setAttribute('data-top', '10');
  await settle();
  expect(page.gtag).toHaveBeenCalledTimes(1);
  document.querySelector('.cta')!.outerHTML = '<button class="cta"><b>Replacement</b></button>';
  await settle();
  dispatch('.cta b');
  expect(page.gtag).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event('resize'));
  document.dispatchEvent(new Event('scroll'));
  await settle();
  expect(page.gtag).toHaveBeenCalledTimes(2);
});

it('keeps simultaneous experiments independent and deduplicates nodes sharing the same reporting pair', async () => {
  const graph = workflow();
  graph.nodes.push(
    node('second', 'experiment', {
      ...config,
      experimentId: 'second',
      experimentKey: 'second',
      experimentSplit: 0,
    }),
    node('duplicate', 'experiment', { ...config }),
  );
  graph.edges.push(
    { id: 'second', source: 'start', target: 'second' },
    { id: 'duplicate', source: 'start', target: 'duplicate' },
  );
  const runtime = createRuntime(graph);
  runtimes.push(runtime);
  await runtime.run();
  await settle();
  dispatch('.cta span');
  expect(
    page.gtag?.mock.calls.map((call) => [call[1], call[2].experiment_id, call[2].variant_id]),
  ).toEqual([
    ['experiment_view', 'homepage-cta-v1', 'a'],
    ['experiment_view', 'second', 'b'],
    ['experiment_cta', 'homepage-cta-v1', 'a'],
    ['experiment_cta', 'second', 'b'],
  ]);
});

it('removes observers/listeners and cancels pending scans on destruction', async () => {
  const observe = vi.fn(),
    unobserve = vi.fn(),
    disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
  const remove = vi.spyOn(document, 'removeEventListener');
  const mutationDisconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const runtime = createRuntime(workflow());
  runtimes.push(runtime);
  await runtime.run();
  await settle();
  expect(observe).toHaveBeenCalled();
  document.querySelector('.cta')!.remove();
  await settle();
  expect(unobserve).toHaveBeenCalled();
  await runtime.run();
  runtime.destroy();
  await settle();
  dispatch('.cta');
  expect(disconnect).toHaveBeenCalledOnce();
  expect(mutationDisconnect).toHaveBeenCalledOnce();
  expect(remove.mock.calls.filter(([event]) => ['click', 'change'].includes(event))).toHaveLength(
    2,
  );
  expect(page.gtag).toHaveBeenCalledTimes(1);
});

it.each(['missing-gtag', 'throwing-gtag', 'missing-gtm', 'throwing-gtm'] as const)(
  'continues with %s and reports events as not queued',
  async (kind) => {
    const delivery = kind.endsWith('gtm') ? 'gtm' : 'gtag';
    if (kind === 'missing-gtag') delete page.gtag;
    if (kind === 'throwing-gtag')
      page.gtag = vi.fn(() => {
        throw new Error('blocked');
      });
    if (kind === 'missing-gtm') delete page.dataLayer;
    if (kind === 'throwing-gtm')
      page.dataLayer = Object.assign([], {
        push: () => {
          throw new Error('blocked');
        },
      });
    const logs: RunLog[] = [];
    const runtime = createRuntime(workflow({ ...config, experimentDelivery: delivery }), {
      onLog: (entry) => logs.push(entry),
    });
    runtimes.push(runtime);
    await runtime.run();
    await settle();
    dispatch('.cta');
    expect(document.querySelector('.cta')?.getAttribute('data-variant')).toBe('a');
    expect(logs.filter((entry) => entry.message.includes('Event was not queued'))).toHaveLength(2);
    expect(logs.some((entry) => entry.status === 'error')).toBe(false);
    if (delivery === 'gtag') expect(page.dataLayer).toEqual([]);
    else expect(page.gtag).not.toHaveBeenCalled();
  },
);

it('uses existing gtag destinations by default and distinguishes queueing from delivery', async () => {
  const logs: RunLog[] = [];
  const runtime = createRuntime(workflow(), { onLog: (entry) => logs.push(entry) });
  runtimes.push(runtime);
  await runtime.run();
  await settle();
  expect(page.gtag).toHaveBeenCalledWith('event', 'experiment_view', {
    experiment_id: 'homepage-cta-v1',
    variant_id: 'a',
  });
  expect(logs.some((entry) => entry.message.includes('Delivery is not confirmed'))).toBe(true);
  expect(document.querySelector('script')).toBeNull();
});

it.each([undefined, 'none'] as const)(
  'older or untracked experiments (%s) never access analytics',
  async (platform) => {
    const runtime = createRuntime(
      workflow({ experimentAnalytics: platform, experimentSplit: 100 }),
    );
    runtimes.push(runtime);
    await runtime.run();
    await settle();
    dispatch('.cta');
    expect(page.gtag).not.toHaveBeenCalled();
    expect(page.dataLayer).toEqual([]);
  },
);

it.each(['gtag', 'gtm'] as const)(
  'preview simulation of %s records event parameters without transmission',
  async (delivery) => {
    const logs: RunLog[] = [];
    const runtime = createRuntime(workflow({ ...config, experimentDelivery: delivery }), {
      analyticsMode: 'simulate',
      onLog: (entry) => logs.push(entry),
    });
    runtimes.push(runtime);
    await runtime.run();
    await settle();
    dispatch('.cta span');
    expect(page.gtag).not.toHaveBeenCalled();
    expect(page.dataLayer).toEqual([]);
    expect(
      logs
        .filter((entry) => entry.message.startsWith('Simulated analytics'))
        .map((entry) => entry.message),
    ).toEqual([
      'Simulated analytics: experiment_view {"experiment_id":"homepage-cta-v1","variant_id":"a"}',
      'Simulated analytics: experiment_cta {"experiment_id":"homepage-cta-v1","variant_id":"a","cta_type":"click"}',
    ]);
  },
);

it('serialized editor bridge forces simulation for a target website with real analytics installed', async () => {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const win = frame.contentWindow! as Window &
    typeof globalThis & { gtag: ReturnType<typeof vi.fn>; dataLayer: unknown[] };
  const doc = win.document;
  doc.body.innerHTML = '<button id="start">Run</button><main id="slot"></main>';
  vi.spyOn(doc, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(win.Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ top: 10, bottom: 40, left: 10, right: 110, width: 100, height: 30 }) as DOMRect,
  );
  win.gtag = vi.fn();
  win.dataLayer = [];
  const send = vi.spyOn(win.parent, 'postMessage').mockImplementation(() => {});
  new Function('window', 'document', previewBridgeSource(window.location.origin))(win, doc);
  const receive = (data: object) =>
    win.dispatchEvent(
      new win.MessageEvent('message', {
        source: win.parent,
        origin: window.location.origin,
        data: { protocol: 'visual-dxp:preview', channel: 'test', ...data },
      }),
    );
  receive({ type: 'init' });
  receive({ type: 'run', workflow: workflow() });
  doc.querySelector<HTMLButtonElement>('#start')!.click();
  await settle();
  doc.querySelector<HTMLButtonElement>('.cta')!.click();
  expect(win.gtag).not.toHaveBeenCalled();
  expect(win.dataLayer).toEqual([]);
  expect(
    send.mock.calls.filter(([data]) => data.log?.message.startsWith('Simulated analytics')),
  ).toHaveLength(2);
  receive({ type: 'stop' });
  frame.remove();
});

it('persists analytics configuration through import/export and both workflow assistant boundaries', async () => {
  const graph = workflow({ ...config, experimentMeasurementId: 'G-TEST123' });
  const json = JSON.parse(JSON.stringify(graph));
  expect(isWorkflow(json)).toBe(true);
  expect(validateWorkflow(graph)).toEqual([]);
  expect(serverValidate(graph)).toEqual([]);
  expect(exportWorkflow(json)).toContain('homepage-cta-v1');
  for (const parse of [parseAIChatRequest, serverParse])
    expect(
      parse({
        messages: [{ role: 'user', content: 'Track this' }],
        workflow: json,
        selectedNodeIds: [],
      }).workflow.nodes[1].data.config,
    ).toEqual(graph.nodes[1].data.config);
  for (const apply of [applyWorkflowOperations, serverApply]) {
    const result = apply(graph, [
      {
        type: 'update_node',
        id: 'test',
        config: { experimentDelivery: 'gtm', experimentInteraction: 'change' },
      },
    ]);
    const { experimentMeasurementId: _measurementId, ...supported } = graph.nodes[1].data.config;
    expect(result.nodes[1].data.config).toEqual({
      ...supported,
      experimentDelivery: 'gtm',
      experimentInteraction: 'change',
    });
  }
  const toolkit = createWorkflowTools(graph, ['test']);
  const update = toolkit.tools.find((tool) => tool.name === 'update_node')!;
  expect(
    JSON.parse(
      await update.invoke({ id: 'test', config: { ...config, experimentDelivery: 'gtm' } }),
    ).ok,
  ).toBe(true);
  await expect(
    update.invoke({ id: 'test', config: { experimentAnalytics: 'posthog' } }),
  ).rejects.toThrow();
  expect(createNode('experiment').data.config.experimentAnalytics).toBeUndefined();
});

it.each([
  { experimentAnalytics: 'posthog' },
  { experimentId: '' },
  { experimentSelector: '' },
  { experimentInteraction: 'input' },
  { experimentDelivery: 'both' },
  { experimentMeasurementId: 'UA-123' },
])('rejects invalid analytics configuration %s in both validators', (patch) => {
  const graph = workflow({ ...config, ...patch } as StepConfig);
  expect(validateWorkflow(graph).length).toBeGreaterThan(0);
  expect(serverValidate(graph).length).toBeGreaterThan(0);
});
it('uses Trigger CSS selector validation and leaves malformed analytics unable to stop the branch', async () => {
  const graph = workflow({ ...config, experimentSelector: '[' });
  expect(validateWorkflow(graph).some((issue) => issue.message.includes('selector'))).toBe(true);
  const runtime = createRuntime(graph);
  runtimes.push(runtime);
  await expect(runtime.run()).resolves.toBeUndefined();
  expect(document.querySelector('.cta')).not.toBeNull();
  expect(page.gtag).not.toHaveBeenCalled();
});

it.each([
  { experimentAnalytics: 'posthog' },
  { experimentDelivery: 'both' },
  { experimentInteraction: 'input' },
])('rejects unsupported tracking options at import and assistant boundaries: %s', (patch) => {
  const graph = workflow({ ...config, ...patch } as StepConfig);
  expect(isWorkflow(JSON.parse(JSON.stringify(graph)))).toBe(false);
  for (const parse of [parseAIChatRequest, serverParse])
    expect(() =>
      parse({
        messages: [{ role: 'user', content: 'Track this' }],
        workflow: graph,
        selectedNodeIds: [],
      }),
    ).toThrow();
  for (const apply of [applyWorkflowOperations, serverApply])
    expect(() =>
      apply(workflow(), [{ type: 'update_node', id: 'test', config: patch as StepConfig }]),
    ).toThrow();
});
it('preserves editable incomplete GA4 configurations at import and assistant boundaries', () => {
  const graph = workflow({ experimentAnalytics: 'ga4' });
  expect(isWorkflow(graph)).toBe(true);
  for (const parse of [parseAIChatRequest, serverParse])
    expect(
      parse({
        messages: [{ role: 'user', content: 'Configure this' }],
        workflow: graph,
        selectedNodeIds: [],
      }).workflow.nodes[1].data.config,
    ).toEqual({ experimentAnalytics: 'ga4' });
});
