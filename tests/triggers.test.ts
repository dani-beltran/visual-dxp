// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import { triggerOptions } from '../src/lib/triggers';
import type { StepConfig, Workflow } from '../src/lib/types';

const configs: StepConfig[] = [
  { event: 'exit-intent' },
  { event: 'rage-click', rageClickCount: 4, rageClickWindow: 800, rageClickRadius: 25 },
  { event: 'inactivity', duration: 5000 },
  {
    event: 'scroll-thrashing',
    scrollDirectionChanges: 3,
    scrollThrashWindow: 1500,
    scrollMinDistance: 40,
  },
  { event: 'scroll-depth', scrollThreshold: 60 },
];

function workflow(config: StepConfig): Workflow {
  return {
    version: 1,
    name: 'Behavior trigger',
    websiteUrl: 'https://example.com',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config },
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
let hidden: ReturnType<typeof vi.spyOn>;
let height: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  height = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2500);
  vi.stubGlobal('innerHeight', 500);
  vi.stubGlobal('scrollY', 0);
  document.body.innerHTML =
    '<button id="target"><span>Click</span></button><p id="result">Waiting</p>';
});

afterEach(() => {
  for (const instance of runtimes.splice(0)) instance.destroy();
  const global = window as Window & { MrDXP?: ReturnType<typeof createRuntime> };
  global.MrDXP?.destroy();
  delete global.MrDXP;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function start(config: StepConfig, signal?: AbortSignal) {
  const fired = vi.fn();
  const instance = createRuntime(workflow(config), {
    signal,
    onLog: (entry) => {
      if (entry.nodeId === 'start' && entry.status === 'running') fired();
    },
  });
  runtimes.push(instance);
  instance.start();
  instance.start();
  return { instance, fired };
}
function click(x = 100, y = 100, init: MouseEventInit = {}) {
  document.querySelector('#target span')!.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      detail: 1,
      button: 0,
      clientX: x,
      clientY: y,
      ...init,
    }),
  );
}
function scroll(position: number, target: EventTarget = document) {
  vi.stubGlobal('scrollY', position);
  target.dispatchEvent(new Event('scroll'));
}
function exit(init: MouseEventInit = {}) {
  document.documentElement.dispatchEvent(
    new MouseEvent('mouseout', {
      bubbles: true,
      clientX: 300,
      clientY: -1,
      relatedTarget: null,
      ...init,
    }),
  );
}
function visibility(value: boolean) {
  hidden.mockReturnValue(value);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('behavior trigger detection', () => {
  it('detects only top-edge exits, once per runtime', () => {
    const { fired } = start({ event: 'exit-intent' });
    exit({ relatedTarget: document.body });
    exit({ clientX: -1, clientY: 100 });
    exit({ clientY: 501 });
    visibility(true);
    exit();
    expect(fired).not.toHaveBeenCalled();
    visibility(false);
    exit();
    exit();
    expect(fired).toHaveBeenCalledOnce();
  });

  it('requires rapid nearby primary clicks and resets after each matching group', async () => {
    const { fired } = start({
      event: 'rage-click',
      rageClickCount: 3,
      rageClickWindow: 500,
      rageClickRadius: 20,
    });
    click();
    click(100, 100, { detail: 0 });
    click(100, 100, { button: 2 });
    await vi.advanceTimersByTimeAsync(501);
    click();
    click(500);
    click(501);
    expect(fired).not.toHaveBeenCalled();
    click(502);
    expect(fired).toHaveBeenCalledOnce();
    click(502);
    click(502);
    expect(fired).toHaveBeenCalledOnce();
    click(502);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('observes dynamically inserted click targets even when bubbling is stopped, and clears hidden-tab history', () => {
    const { fired } = start({ event: 'rage-click', rageClickCount: 2 });
    click();
    visibility(true);
    click();
    visibility(false);
    document.querySelector('#target')!.innerHTML = '<span>New target</span>';
    document
      .querySelector('#target span')!
      .addEventListener('click', (event) => event.stopPropagation());
    click();
    expect(fired).not.toHaveBeenCalled();
    click();
    expect(fired).toHaveBeenCalledOnce();
  });

  it('fires once per idle period, resets on activity, and pauses while hidden', async () => {
    const { fired, instance } = start({ event: 'inactivity', duration: 1000 });
    for (const event of [
      'pointermove',
      'pointerdown',
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'touchmove',
      'wheel',
      'scroll',
      'click',
    ]) {
      await vi.advanceTimersByTimeAsync(900);
      document.querySelector('#target')!.dispatchEvent(new Event(event, { bubbles: false }));
      expect(fired).not.toHaveBeenCalled();
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fired).toHaveBeenCalledOnce();
    document.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(900);
    visibility(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    visibility(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(fired).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(fired).toHaveBeenCalledTimes(2);
    click();
    instance.destroy();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('counts meaningful scroll reversals, ignoring jitter, nested containers, and expired groups', async () => {
    const { fired } = start({
      event: 'scroll-thrashing',
      scrollDirectionChanges: 2,
      scrollMinDistance: 50,
      scrollThrashWindow: 500,
    });
    scroll(100);
    scroll(200);
    scroll(190);
    scroll(200);
    scroll(190);
    scroll(200);
    expect(fired).not.toHaveBeenCalled();
    scroll(100);
    scroll(200, document.querySelector('#target')!);
    expect(fired).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(501);
    scroll(200);
    scroll(100);
    expect(fired).not.toHaveBeenCalled();
    scroll(200);
    expect(fired).toHaveBeenCalledOnce();
    // Detection resets: the next movement establishes a new direction.
    scroll(100);
    scroll(200);
    expect(fired).toHaveBeenCalledOnce();
    scroll(100);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('uses a rolling reversal time window even during continuous scrolling', async () => {
    const { fired } = start({
      event: 'scroll-thrashing',
      scrollDirectionChanges: 3,
      scrollThrashWindow: 500,
    });
    scroll(100);
    scroll(200);
    for (const y of [100, 200, 100, 200]) {
      await vi.advanceTimersByTimeAsync(300);
      scroll(y);
    }
    expect(fired).not.toHaveBeenCalled();
    scroll(100);
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('requires downward page scrolling and fires only once at the configured depth', () => {
    vi.stubGlobal('scrollY', 1800);
    const { fired } = start({ event: 'scroll-depth', scrollThreshold: 75 });
    expect(fired).not.toHaveBeenCalled();
    scroll(1600);
    scroll(1700, document.querySelector('#target')!);
    expect(fired).not.toHaveBeenCalled();
    scroll(1800);
    expect(fired).toHaveBeenCalledOnce();
    scroll(100);
    scroll(2000);
    expect(fired).toHaveBeenCalledOnce();
  });

  it('handles non-scrollable pages, growing content, hidden tabs, and 100% depth', () => {
    height.mockReturnValue(500);
    const { fired } = start({ event: 'scroll-depth', scrollThreshold: 100 });
    scroll(200);
    expect(fired).not.toHaveBeenCalled();
    height.mockReturnValue(1500);
    scroll(999);
    height.mockReturnValue(2500);
    scroll(1000);
    expect(fired).not.toHaveBeenCalled();
    visibility(true);
    scroll(2000);
    visibility(false);
    scroll(2000);
    expect(fired).not.toHaveBeenCalled();
    scroll(1900);
    scroll(2000);
    expect(fired).toHaveBeenCalledOnce();
  });

  it.each(configs)('removes all behavior listeners and timers on abort: $event', (config) => {
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const signal = new AbortController();
    const { fired } = start(config, signal.signal);
    signal.abort();
    for (const [add, remove] of [
      [addDocument, removeDocument],
      [addWindow, removeWindow],
    ]) {
      for (const [event, listener, options] of add.mock.calls) {
        expect(remove).toHaveBeenCalledWith(
          event,
          listener,
          typeof options === 'object' ? options.capture : options,
        );
      }
    }
    click();
    exit();
    scroll(2000);
    expect(fired).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('behavior trigger contracts and exports', () => {
  it.each(configs)('retains settings across JSON and AI editing: $event', (config) => {
    const graph = workflow(config);
    expect(validateWorkflow(graph)).toEqual([]);
    expect(isWorkflow(JSON.parse(JSON.stringify(graph)))).toBe(true);
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

  it('validates numeric bounds and malformed values in every behavioral setting', () => {
    for (const [event, { settings }] of Object.entries(triggerOptions)) {
      for (const { key, min, max } of settings) {
        for (const value of [min - 1, max + 1, 1.5, Number.NaN, Infinity, '5', null]) {
          const graph = workflow({ event, [key]: value } as StepConfig);
          expect(validateWorkflow(graph), `${event}.${key}=${value}`).not.toHaveLength(0);
          expect(() => exportWorkflow(graph)).toThrow();
        }
        for (const value of [min, max])
          expect(validateWorkflow(workflow({ event, [key]: value } as StepConfig))).toEqual([]);
      }
    }
    expect(
      isWorkflow(workflow({ event: 'rage-click', rageClickCount: '3' as unknown as number })),
    ).toBe(false);
  });

  it('ignores stale selectors for behavioral events while keeping selectors required for DOM events', () => {
    for (const config of configs)
      expect(validateWorkflow(workflow({ ...config, selector: '[' }))).toEqual([]);
    for (const event of ['click', 'mouseover', 'submit', 'change'] as const)
      expect(validateWorkflow(workflow({ event }))[0].message).toContain('target element');
  });

  it.each(configs.map(({ event }) => event!))(
    'exports dependency-free detection with defaults: %s',
    async (event) => {
      const script = exportWorkflow(workflow({ event }));
      new Function('window', 'document', script)(window, document);
      switch (event) {
        case 'exit-intent':
          exit();
          break;
        case 'rage-click':
          click();
          click();
          click();
          break;
        case 'inactivity':
          await vi.advanceTimersByTimeAsync(30000);
          break;
        case 'scroll-thrashing':
          for (const position of [100, 200, 100, 200, 100, 200]) scroll(position);
          break;
        case 'scroll-depth':
          scroll(1500);
          break;
      }
      await Promise.resolve();
      expect(document.querySelector('#result')!.textContent).toBe('Triggered');
    },
  );
});
