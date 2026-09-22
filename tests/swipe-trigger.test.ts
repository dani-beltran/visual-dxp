// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, StepConfig, Workflow } from '../src/lib/types';

const config: StepConfig = { event: 'swipe', selector: '#target' };
function workflow(trigger = config): Workflow {
  return {
    version: 1,
    name: 'Swipe an element',
    websiteUrl: 'https://example.com',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Swipe', config: trigger },
      },
      {
        id: 'result',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: { kind: 'dom', label: 'Result', config: { selector: '#result', value: 'Swiped' } },
      },
    ],
    edges: [{ id: 'edge', source: 'start', target: 'result' }],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
let hidden: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  document.body.innerHTML =
    '<section id="target"><span>Swipe here</span></section><div id="outside">Outside</div><p id="result">Waiting</p>';
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  const exported = window as Window & { MrDXP?: ReturnType<typeof createRuntime> };
  exported.MrDXP?.destroy();
  delete exported.MrDXP;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function element(selector = '#target span') {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Missing test element: ${selector}`);
  return target;
}
function start(trigger = config, signal?: AbortSignal) {
  const fired = vi.fn();
  const logs: RunLog[] = [];
  const runtime = createRuntime(workflow(trigger), {
    signal,
    onLog: (entry) => {
      logs.push(entry);
      if (entry.nodeId === 'start' && entry.status === 'running') fired();
    },
  });
  runtimes.push(runtime);
  runtime.start();
  runtime.start();
  return { runtime, fired, logs };
}
function finger(x = 100, y = 100, identifier = 1, target = element()) {
  return { identifier, target, clientX: x, clientY: y };
}
function touch(
  type: string,
  touches: ReturnType<typeof finger>[],
  changedTouches = touches,
  target: EventTarget = element(),
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: changedTouches },
  });
  target.dispatchEvent(event);
  return event;
}
function pointer(type: string, init: PointerEventInit = {}, target: EventTarget = element()) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100,
    button: 0,
    ...init,
  });
  Object.defineProperties(event, {
    pointerType: { value: init.pointerType ?? 'touch' },
    pointerId: { value: init.pointerId ?? 1 },
    isPrimary: { value: init.isPrimary ?? true },
  });
  target.dispatchEvent(event);
  return event;
}

describe('element swipe detection', () => {
  it.each([
    [50, 0],
    [-50, 0],
    [0, 50],
    [0, -50],
    [30, 40],
  ])('detects a completed swipe with displacement %s, %s', async (x, y) => {
    const { fired } = start();
    touch('touchstart', [finger()]);
    touch('touchmove', [finger(100 + x, 100 + y)]);
    expect(fired).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    const event = touch('touchend', [], [finger(100 + x, 100 + y)]);
    expect(event.defaultPrevented).toBe(false);
    expect(fired).toHaveBeenCalledOnce();
    touch('touchend', [], [finger(100 + x, 100 + y)]);
    expect(fired).toHaveBeenCalledOnce();
    touch('touchstart', [finger()]);
    touch('touchend', [], [finger(200)]);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('ignores taps, short motion, slow drags, wheel scrolling, and mouse dragging', async () => {
    const { fired } = start();
    for (const x of [100, 149]) {
      touch('touchstart', [finger()]);
      touch('touchend', [], [finger(x)]);
    }
    touch('touchstart', [finger()]);
    await vi.advanceTimersByTimeAsync(1001);
    touch('touchend', [], [finger(200)]);
    pointer('pointerdown', { pointerType: 'mouse' });
    pointer('pointerup', { pointerType: 'mouse', clientX: 200 });
    element().dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaX: 200 }));
    element().dispatchEvent(new Event('swipe', { bubbles: true }));
    expect(fired).not.toHaveBeenCalled();
  });

  it('uses the starting target, accepts descendants, and allows finishing outside it', () => {
    const { fired } = start();
    touch('touchstart', [finger(100, 100, 1, element('#outside'))], undefined, element('#outside'));
    touch('touchend', [], [finger(200)]);
    expect(fired).not.toHaveBeenCalled();
    touch('touchstart', [finger()]);
    touch('touchend', [], [finger(200)], element('#outside'));
    expect(fired).toHaveBeenCalledOnce();
  });

  it('supports dynamic elements and capture listeners even when the host stops propagation', () => {
    const { fired } = start();
    element('#target').remove();
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<div id="target"><span>New target</span></div>',
    );
    for (const type of ['touchstart', 'touchend'])
      element().addEventListener(type, (event) => event.stopPropagation());
    touch('touchstart', [finger()]);
    touch('touchend', [], [finger(200)]);
    expect(fired).toHaveBeenCalledOnce();
  });

  it('ignores detached targets and elements that no longer match the selector', () => {
    const { fired } = start();
    touch('touchstart', [finger()]);
    const target = element();
    element('#target').remove();
    touch('touchend', [], [finger(200, 100, 1, target)], document);
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<div id="target"><span>New target</span></div>',
    );
    touch('touchstart', [finger()]);
    const renamed = element();
    element('#target').id = 'renamed';
    touch('touchend', [], [finger(200, 100, 1, renamed)], document);
    expect(fired).not.toHaveBeenCalled();
  });

  it('rejects multitouch and never resumes a pinch as a one-finger swipe', () => {
    const { fired } = start();
    touch('touchstart', [finger()]);
    touch('touchstart', [finger(), finger(200, 100, 2)]);
    touch('touchend', [finger()], [finger(200, 100, 2)]);
    touch('touchend', [], [finger(250)]);
    expect(fired).not.toHaveBeenCalled();
    touch('touchstart', [finger()]);
    touch('touchmove', [finger(), finger(200, 100, 2)]);
    touch('touchend', [], [finger(250)]);
    expect(fired).not.toHaveBeenCalled();
  });

  it('tracks touch identifiers and ignores replaced or cancelled contacts', () => {
    const { fired } = start();
    touch('touchstart', [finger()]);
    touch('touchend', [], [finger(200, 100, 2)]);
    touch('touchstart', [finger()]);
    touch('touchmove', [finger(200, 100, 2)]);
    touch('touchend', [], [finger(200)]);
    touch('touchstart', [finger()]);
    touch('touchcancel', []);
    touch('touchend', [], [finger(200)]);
    expect(fired).not.toHaveBeenCalled();
  });

  it.each(['touch', 'pen'])('supports %s pointer events without a touch stream', (pointerType) => {
    const { fired } = start();
    pointer('pointerdown', { pointerType });
    pointer('pointerup', { pointerType, pointerId: 2, clientX: 200 });
    expect(fired).not.toHaveBeenCalled();
    expect(pointer('pointerup', { pointerType, clientX: 200 }).defaultPrevented).toBe(false);
    pointer('pointerup', { pointerType, clientX: 200 });
    expect(fired).toHaveBeenCalledOnce();
  });

  it('ignores secondary, multiple, and cancelled pointers', () => {
    const { fired } = start();
    pointer('pointerdown', { isPrimary: false });
    pointer('pointerup', { clientX: 200 });
    pointer('pointerdown', { pointerType: 'pen', button: 2 });
    pointer('pointerup', { pointerType: 'pen', clientX: 200 });
    pointer('pointerdown');
    pointer('pointerdown', { pointerId: 2, isPrimary: false });
    pointer('pointerup', { pointerId: 2, clientX: 200 });
    pointer('pointerup', { clientX: 200 });
    pointer('pointerdown');
    pointer('pointercancel');
    pointer('pointerup', { clientX: 200 });
    expect(fired).not.toHaveBeenCalled();
  });

  it('deduplicates pointer/touch reports and allows completed touch swipes after native pointer cancellation', () => {
    const { fired } = start();
    pointer('pointerdown');
    touch('touchstart', [finger()]);
    pointer('pointerup', { clientX: 200 });
    touch('touchend', [], [finger(200)]);
    expect(fired).toHaveBeenCalledOnce();
    pointer('pointerdown');
    touch('touchstart', [finger()]);
    pointer('pointercancel');
    touch('touchend', [], [finger(200)]);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('drops active gestures on visibility changes and window blur', () => {
    const { fired } = start();
    touch('touchstart', [finger()]);
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    touch('touchend', [], [finger(200)]);
    touch('touchstart', [finger()]);
    touch('touchend', [], [finger(200)]);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    touch('touchend', [], [finger(200)]);
    pointer('pointerdown');
    window.dispatchEvent(new Event('blur'));
    pointer('pointerup', { clientX: 200 });
    expect(fired).not.toHaveBeenCalled();
    pointer('pointerdown');
    pointer('pointerup', { clientX: 200 });
    expect(fired).toHaveBeenCalledOnce();
  });

  it.each(['destroy', 'abort'] as const)(
    'removes listeners and pending gesture state on %s',
    (method) => {
      const observers = [document, window].map((target) => ({
        add: vi.spyOn(target, 'addEventListener'),
        remove: vi.spyOn(target, 'removeEventListener'),
      }));
      const controller = new AbortController();
      const { runtime, fired } = start(config, controller.signal);
      touch('touchstart', [finger()]);
      if (method === 'abort') controller.abort();
      else runtime.destroy();
      for (const { add, remove } of observers)
        for (const [event, listener, options] of add.mock.calls)
          expect(remove).toHaveBeenCalledWith(
            event,
            listener,
            typeof options === 'object' ? options.capture : options,
          );
      touch('touchend', [], [finger(200)]);
      pointer('pointerdown');
      pointer('pointerup', { clientX: 200 });
      expect(fired).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});

describe('swipe contracts and exports', () => {
  it('requires a valid selector in validation, exports, and direct runtime use', () => {
    for (const selector of [undefined, '', ' ', '[']) {
      const trigger: StepConfig = { event: 'swipe', selector };
      expect(validateWorkflow(workflow(trigger))).toHaveLength(1);
      expect(() => exportWorkflow(workflow(trigger))).toThrow();
      const { logs, fired } = start(trigger);
      touch('touchstart', [finger()]);
      touch('touchend', [], [finger(200)]);
      expect(fired).not.toHaveBeenCalled();
      expect(logs.some((entry) => entry.status === 'error')).toBe(true);
    }
  });
  it('retains swipe selection through JSON and AI editing', () => {
    const graph = workflow();
    expect(validateWorkflow(graph)).toEqual([]);
    expect(isWorkflow(JSON.parse(JSON.stringify(graph)))).toBe(true);
    expect(
      parseAIChatRequest({
        workflow: graph,
        messages: [{ role: 'user', content: 'Swipe' }],
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
  it.each(['touch', 'pointer'])('exports dependency-free %s swipe detection', async (source) => {
    new Function('window', 'document', exportWorkflow(workflow()))(window, document);
    if (source === 'touch') {
      touch('touchstart', [finger()]);
      touch('touchend', [], [finger(200)]);
    } else {
      pointer('pointerdown', { pointerType: 'pen' });
      pointer('pointerup', { pointerType: 'pen', clientX: 200 });
    }
    await Promise.resolve();
    expect(element('#result').textContent).toBe('Swiped');
  });
});
