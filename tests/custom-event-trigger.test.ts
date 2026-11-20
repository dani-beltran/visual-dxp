// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { stepSummary } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, StepConfig, Workflow } from '../src/lib/types';

const config: StepConfig = { event: 'custom-event', customEventName: 'cart:updated' };

function workflow(trigger: StepConfig = config): Workflow {
  return {
    version: 1,
    name: 'Custom event trigger',
    websiteUrl: window.location.href,
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: trigger },
      },
      {
        id: 'result',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: { kind: 'dom', label: 'Update', config: { selector: '#result', value: 'Triggered' } },
      },
    ],
    edges: [{ id: 'edge', source: 'start', target: 'result' }],
  };
}

const runtimes: ReturnType<typeof createRuntime>[] = [];
beforeEach(() => {
  document.body.innerHTML =
    '<div id="widget"><button id="target">Add</button></div><p id="result">Waiting</p>';
});
afterEach(() => {
  for (const instance of runtimes.splice(0)) instance.destroy();
  const global = window as Window & { visualDXP?: ReturnType<typeof createRuntime> };
  global.visualDXP?.destroy();
  delete global.visualDXP;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function start(trigger: StepConfig = config, signal?: AbortSignal) {
  const fired = vi.fn();
  const logs: RunLog[] = [];
  const instance = createRuntime(workflow(trigger), {
    signal,
    onLog: (entry) => {
      logs.push(entry);
      if (entry.nodeId === 'start' && entry.status === 'running') fired();
    },
  });
  runtimes.push(instance);
  instance.start();
  instance.start(); // Idempotent: must not register a second listener.
  return { instance, fired, logs };
}
const target = () => document.querySelector('#target')!;

describe('custom event trigger runtime', () => {
  it('runs once per dispatch of the exact name on window, document, or any element', async () => {
    const { fired } = start();
    expect(fired).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('cart:updated'));
    expect(fired).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: 2 } }));
    expect(fired).toHaveBeenCalledTimes(2);
    target().dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
    expect(fired).toHaveBeenCalledTimes(3);
    // Non-bubbling events on elements are still observed during the capture phase.
    target().dispatchEvent(new CustomEvent('cart:updated'));
    expect(fired).toHaveBeenCalledTimes(4);
    // Page handlers that stop propagation below the window cannot hide the event.
    target().addEventListener('cart:updated', (event) => event.stopImmediatePropagation());
    target().dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
    expect(fired).toHaveBeenCalledTimes(5);
    await Promise.resolve();
    expect(document.querySelector('#result')!.textContent).toBe('Triggered');
  });

  it('ignores other names, case variants, partial matches, and non-CustomEvent events', () => {
    const { fired } = start();
    for (const name of [
      'Cart:Updated',
      'CART:UPDATED',
      'cart:update',
      'cart:updated2',
      'cart',
      ' cart:updated',
      'cart:updated ',
      'updated',
    ])
      window.dispatchEvent(new CustomEvent(name));
    // The same name on a plain Event is not a custom event defined with the CustomEvent API.
    window.dispatchEvent(new Event('cart:updated'));
    expect(fired).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('cart:updated'));
    expect(fired).toHaveBeenCalledOnce();
  });

  it('does not start from built-in browser events that share the configured name', () => {
    const { fired } = start({ event: 'custom-event', customEventName: 'click' });
    (target() as HTMLButtonElement).click();
    target().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).not.toHaveBeenCalled();
    target().dispatchEvent(new CustomEvent('click', { bubbles: true }));
    expect(fired).toHaveBeenCalledOnce();
  });

  it('accepts CustomEvent subclasses and events created in another realm', () => {
    const { fired } = start();
    class CartEvent extends CustomEvent<{ items: number }> {}
    window.dispatchEvent(new CartEvent('cart:updated', { detail: { items: 1 } }));
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const other = frame.contentWindow as Window & typeof globalThis;
    const foreign = new other.CustomEvent('cart:updated');
    expect(foreign instanceof CustomEvent).toBe(false);
    window.dispatchEvent(foreign);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('trims surrounding whitespace from the configured name and keeps inner spaces', async () => {
    const { fired, logs } = start({ event: 'custom-event', customEventName: ' \tcart:updated \n' });
    expect(logs.filter(({ status }) => status === 'error')).toEqual([]);
    // The untrimmed spelling is not what the trigger listens for.
    window.dispatchEvent(new CustomEvent(' \tcart:updated \n'));
    window.dispatchEvent(new CustomEvent(' cart:updated'));
    expect(fired).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('cart:updated'));
    expect(fired).toHaveBeenCalledOnce();

    const spaced = start({ event: 'custom-event', customEventName: '  checkout complete  ' });
    window.dispatchEvent(new CustomEvent('checkoutcomplete'));
    expect(spaced.fired).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('checkout complete'));
    expect(spaced.fired).toHaveBeenCalledOnce();

    // Exported scripts trim too.
    for (const instance of runtimes.splice(0)) instance.destroy();
    const script = exportWorkflow(
      workflow({ event: 'custom-event', customEventName: ' cart:updated ' }),
    );
    new Function('window', 'document', script)(window, document);
    window.dispatchEvent(new CustomEvent('cart:updated'));
    await Promise.resolve();
    expect(document.querySelector('#result')!.textContent).toBe('Triggered');
  });

  it('keeps multiple custom event triggers independent', () => {
    const fired = new Map<string, number>();
    const graph = workflow();
    graph.nodes.push({
      id: 'second',
      type: 'workflow',
      position: { x: 0, y: 200 },
      data: {
        kind: 'trigger',
        label: 'Second',
        config: { event: 'custom-event', customEventName: 'checkout:done' },
      },
    });
    const instance = createRuntime(graph, {
      onLog: (entry) => {
        if (entry.status === 'running' && graph.nodes.some((node) => node.id === entry.nodeId))
          fired.set(entry.nodeId, (fired.get(entry.nodeId) ?? 0) + 1);
      },
    });
    runtimes.push(instance);
    instance.start();
    window.dispatchEvent(new CustomEvent('checkout:done'));
    expect(fired.get('start')).toBeUndefined();
    expect(fired.get('second')).toBe(1);
    window.dispatchEvent(new CustomEvent('cart:updated'));
    expect(fired.get('start')).toBe(1);
    expect(fired.get('second')).toBe(1);
  });

  it('removes its listener when stopped or aborted', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const controller = new AbortController();
    const { fired, instance } = start(config, controller.signal);
    const registration = add.mock.calls.find(([event]) => event === 'cart:updated');
    expect(registration).toBeDefined();
    controller.abort();
    expect(remove).toHaveBeenCalledWith('cart:updated', registration![1], true);
    window.dispatchEvent(new CustomEvent('cart:updated'));
    expect(fired).not.toHaveBeenCalled();
    instance.destroy();
  });

  it.each([
    { event: 'custom-event' },
    { event: 'custom-event', customEventName: '' },
    { event: 'custom-event', customEventName: '   ' },
  ] satisfies StepConfig[])('reports a missing name without listening: %j', (trigger) => {
    const add = vi.spyOn(window, 'addEventListener');
    const { fired, logs } = start(trigger);
    expect(logs).toContainEqual(
      expect.objectContaining({
        nodeId: 'start',
        status: 'error',
        message: 'Enter a custom event name for this trigger.',
      }),
    );
    expect(add.mock.calls.filter(([event]) => !['abort'].includes(event))).toEqual([]);
    window.dispatchEvent(new CustomEvent(''));
    window.dispatchEvent(new CustomEvent('   '));
    expect(fired).not.toHaveBeenCalled();
  });

  it('runs in the dependency-free exported script', async () => {
    const script = exportWorkflow(workflow());
    new Function('window', 'document', script)(window, document);
    window.dispatchEvent(new CustomEvent('cart:Updated'));
    window.dispatchEvent(new Event('cart:updated'));
    await Promise.resolve();
    expect(document.querySelector('#result')!.textContent).toBe('Waiting');
    document.dispatchEvent(new CustomEvent('cart:updated'));
    await Promise.resolve();
    expect(document.querySelector('#result')!.textContent).toBe('Triggered');
  });
});

describe('custom event trigger contracts', () => {
  it('requires a nonblank name, and no target element', () => {
    expect(validateWorkflow(workflow())).toEqual([]);
    // A stale selector from a previous element trigger is ignored.
    expect(validateWorkflow(workflow({ ...config, selector: '[' }))).toEqual([]);
    for (const name of [undefined, '', '   ']) {
      const graph = workflow({ event: 'custom-event', customEventName: name });
      expect(validateWorkflow(graph)).toEqual([
        { nodeId: 'start', message: 'Enter a custom event name for this trigger.' },
      ]);
      expect(() => exportWorkflow(graph)).toThrow();
    }
    // Surrounding whitespace is trimmed rather than rejected. Names are otherwise unrestricted.
    for (const name of [
      ' cart:updated',
      'cart:updated ',
      '\tcart:updated\n',
      'checkout complete',
      'Cart.Updated',
      'x',
      'ünïcødé-🛒',
    ])
      expect(validateWorkflow(workflow({ event: 'custom-event', customEventName: name }))).toEqual(
        [],
      );
  });

  it('summarizes the configured name on the canvas', () => {
    expect(stepSummary('trigger', config)).toBe('Custom event · cart:updated');
    expect(
      stepSummary('trigger', { event: 'custom-event', customEventName: '  cart:updated ' }),
    ).toBe('Custom event · cart:updated');
    expect(stepSummary('trigger', { event: 'custom-event' })).toBe(
      'Custom event · Enter an event name',
    );
  });

  it('retains the name across JSON import and AI editing', () => {
    const graph = workflow();
    expect(isWorkflow(JSON.parse(JSON.stringify(graph)))).toBe(true);
    expect(
      isWorkflow(workflow({ event: 'custom-event', customEventName: 42 as unknown as string })),
    ).toBe(false);
    expect(
      parseAIChatRequest({
        workflow: graph,
        messages: [{ role: 'user', content: 'Edit' }],
        selectedNodeIds: [],
      }).workflow.nodes[0].data.config,
    ).toEqual(config);
    const response = parseAIChatResponse({
      message: 'Updated',
      operations: [{ type: 'update_node', id: 'start', config }],
    });
    expect(applyWorkflowOperations(workflow({}), response.operations).nodes[0].data.config).toEqual(
      config,
    );
  });

  it('owns only the event name when AI edits convert triggers', () => {
    const converted = applyWorkflowOperations(workflow({ event: 'click', selector: '#target' }), [
      { type: 'update_node', id: 'start', config },
    ]);
    expect(converted.nodes[0].data.config).toEqual(config);
    const back = applyWorkflowOperations(converted, [
      { type: 'update_node', id: 'start', config: { event: 'click', selector: '#target' } },
    ]);
    expect(back.nodes[0].data.config).toEqual({ event: 'click', selector: '#target' });
  });
});

describe('custom event detail as data', () => {
  /** Trigger on cart:updated, optionally wait, then write a template into #result. */
  function dataWorkflow(value: string, delay?: number): Workflow {
    const graph = workflow();
    graph.nodes[1].data.config = { selector: '#result', value };
    if (delay !== undefined) {
      graph.nodes.splice(1, 0, {
        id: 'wait',
        type: 'workflow',
        position: { x: 150, y: 0 },
        data: { kind: 'delay', label: 'Wait', config: { duration: delay } },
      });
      graph.edges = [
        { id: 'to-wait', source: 'start', target: 'wait' },
        { id: 'edge', source: 'wait', target: 'result' },
      ];
    }
    return graph;
  }
  function startData(graph: Workflow) {
    const logs: RunLog[] = [];
    const previews: { edgeId: string; value: unknown; exists: boolean }[] = [];
    const instance = createRuntime(graph, {
      onLog: (entry) => logs.push(entry),
      onConnectionPreview: (edgeId, preview) =>
        previews.push({ edgeId, ...(preview.source as { exists: boolean; value: unknown }) }),
    });
    runtimes.push(instance);
    instance.start();
    return { instance, logs, previews };
  }
  const result = () => document.querySelector('#result')?.textContent;
  const settle = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  it('passes the event detail to the next node as incoming data', async () => {
    const { logs, previews } = startData(
      dataWorkflow('{{items}} × {{products[0].name}} for {{customer.name}}'),
    );
    const detail = { items: 2, products: [{ name: 'Vase' }], customer: { name: 'Ada' } };
    window.dispatchEvent(new CustomEvent('cart:updated', { detail }));
    await settle();
    expect(result()).toBe('2 × Vase for Ada');
    expect(previews).toEqual([{ edgeId: 'edge', exists: true, value: detail }]);
    expect(logs).toContainEqual(
      expect.objectContaining({
        nodeId: 'start',
        status: 'success',
        message: 'Event received. Its detail is passed to the next step:',
        data: JSON.stringify(detail, null, 2),
      }),
    );
  });

  it('passes the whole detail, including scalar values, with {{$}}', async () => {
    startData(dataWorkflow('Detail: {{$}}'));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: 'checkout' }));
    await settle();
    expect(result()).toBe('Detail: checkout');
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: 42 }));
    await settle();
    expect(result()).toBe('Detail: 42');
  });

  it('passes null when the event has no detail', async () => {
    const { logs, previews } = startData(dataWorkflow('Detail: [{{$}}]'));
    window.dispatchEvent(new CustomEvent('cart:updated'));
    await settle();
    expect(previews).toEqual([{ edgeId: 'edge', exists: true, value: null }]);
    // Element content renders null as empty text, as it does for other data sources.
    expect(result()).toBe('Detail: []');
    expect(logs).toContainEqual(
      expect.objectContaining({ nodeId: 'start', status: 'success', data: 'null' }),
    );
  });

  it('forwards the detail through intermediate steps and snapshots it at dispatch', async () => {
    startData(dataWorkflow('{{count}}', 20));
    const detail = { count: 1 };
    window.dispatchEvent(new CustomEvent('cart:updated', { detail }));
    detail.count = 99; // The page changes its object while the workflow waits.
    await settle(60);
    expect(result()).toBe('1');
  });

  it('keeps overlapping runs independent', async () => {
    const { previews } = startData(dataWorkflow('{{count}}', 20));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: 1 } }));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: 2 } }));
    await settle(60);
    expect(previews.filter(({ edgeId }) => edgeId === 'edge').map(({ value }) => value)).toEqual([
      { count: 1 },
      { count: 2 },
    ]);
    expect(result()).toBe('2');
  });

  it('passes details that cannot be cloned or logged as JSON', async () => {
    const { logs } = startData(dataWorkflow('{{label}}'));
    const uncloneable = { label: 'With function', format: () => 'x' };
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: uncloneable }));
    await settle();
    expect(result()).toBe('With function');

    const cyclic: Record<string, unknown> = { label: 'Cyclic' };
    cyclic.self = cyclic;
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: cyclic }));
    await settle();
    expect(result()).toBe('Cyclic');
    const successes = logs.filter((log) => log.nodeId === 'start' && log.status === 'success');
    expect(successes.at(-1)).toMatchObject({ message: 'Step completed' });
    expect(successes.at(-1)).not.toHaveProperty('data');
    expect(logs.filter((log) => log.status === 'error')).toEqual([]);
  });

  it('gives other triggers no incoming data', async () => {
    const graph = dataWorkflow('{{$}}');
    graph.nodes[0].data.config = { event: 'click', selector: '#target' };
    const { logs, previews } = startData(graph);
    (document.querySelector('#target') as HTMLButtonElement).click();
    await settle();
    expect(previews).toEqual([{ edgeId: 'edge', exists: false, value: undefined }]);
    expect(logs).toContainEqual(
      expect.objectContaining({ nodeId: 'start', status: 'success', message: 'Step completed' }),
    );
  });

  it('lets hosts run a trigger with incoming data', async () => {
    const { instance } = startData(dataWorkflow('{{name}}'));
    await instance.run('start', { exists: true, value: { name: 'Manual' } });
    expect(result()).toBe('Manual');
  });

  it('passes the detail in the exported script', async () => {
    new Function('window', 'document', exportWorkflow(dataWorkflow('{{productId}}')))(
      window,
      document,
    );
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { productId: 'vase' } }));
    await settle();
    expect(result()).toBe('vase');
  });
});
