// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import { elementTriggerEvents, triggerOptions } from '../src/lib/triggers';
import type { RunLog, StepConfig, Workflow } from '../src/lib/types';

const zoomConfig: StepConfig = { event: 'zoom-in', selector: '#target' };

function workflow(config: StepConfig = zoomConfig): Workflow {
  return {
    version: 1,
    name: 'Zoom into an element',
    websiteUrl: 'https://example.com',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Zoom', config },
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
let viewport: EventTarget & { scale: number };
let originalElementFromPoint: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  viewport = Object.assign(new EventTarget(), { scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  // jsdom has no layout engine. Tests opt into a hit-test result when needed.
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: undefined });
  document.body.innerHTML =
    '<section id="target"><span class="left">Left</span><span class="right">Right</span></section>' +
    '<section id="outside">Outside</section><p id="result">Waiting</p>';
});

afterEach(() => {
  for (const instance of runtimes.splice(0)) instance.destroy();
  const exported = window as Window & { dlbDXP?: ReturnType<typeof createRuntime> };
  exported.dlbDXP?.destroy();
  delete exported.dlbDXP;
  document.body.innerHTML = '';
  if (originalElementFromPoint)
    Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
  else Reflect.deleteProperty(document, 'elementFromPoint');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function element(selector = '#target .left') {
  const match = document.querySelector(selector);
  if (!match) throw new Error(`Missing test element: ${selector}`);
  return match;
}

function start(config = zoomConfig, signal?: AbortSignal) {
  const fired = vi.fn();
  const logs: RunLog[] = [];
  const instance = createRuntime(workflow(config), {
    signal,
    onLog: (entry) => {
      logs.push(entry);
      if (entry.nodeId === 'start' && entry.status === 'running') fired();
    },
  });
  runtimes.push(instance);
  instance.start();
  instance.start();
  return { instance, fired, logs };
}

function wheel(init: WheelEventInit = {}, target: EventTarget = element()) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -10,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

interface TestTouch {
  identifier: number;
  target: EventTarget;
  clientX: number;
  clientY: number;
}

function fingers(distance: number, targets = [element(), element('#target .right')]): TestTouch[] {
  return targets.map((target, index) => ({
    identifier: index + 1,
    target,
    clientX: 200 + (index === 0 ? -distance / 2 : distance / 2),
    clientY: 100,
  }));
}

function touch(type: string, touches: TestTouch[], target: EventTarget = element()) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = Object.assign([...touches], { item: (index: number) => touches[index] ?? null });
  Object.defineProperties(event, {
    touches: { value: list },
    targetTouches: { value: list },
    changedTouches: { value: list },
  });
  target.dispatchEvent(event);
  return event;
}

function gesture(type: string, scale: number, target: EventTarget = element()) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    scale: { value: scale },
    clientX: { value: 200 },
    clientY: { value: 100 },
  });
  target.dispatchEvent(event);
  return event;
}

function scale(value: number) {
  viewport.scale = value;
  viewport.dispatchEvent(new Event('resize'));
}

function visibility(value: boolean) {
  hidden.mockReturnValue(value);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('element zoom-in detection', () => {
  it('ignores scrolling, zooming out, and zoom gestures outside the selected element', () => {
    const { fired } = start();
    wheel({ ctrlKey: false });
    wheel({ ctrlKey: false, metaKey: true });
    wheel({ deltaY: 10 });
    wheel({ deltaY: 0 });
    wheel({}, element('#outside'));
    scale(1.5);
    element().dispatchEvent(new Event('zoom-in', { bubbles: true }));
    expect(fired).not.toHaveBeenCalled();
    expect(wheel().defaultPrevented).toBe(false);
    expect(fired).toHaveBeenCalledOnce();
  });

  it('fires once per wheel gesture and rearms after 300 ms without zoom-wheel activity', async () => {
    const { fired } = start();
    wheel();
    await vi.advanceTimersByTimeAsync(200);
    wheel();
    await vi.advanceTimersByTimeAsync(200);
    wheel();
    expect(fired).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300);
    wheel();
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('observes newly inserted descendants before propagation is stopped', () => {
    const { fired } = start();
    element('#target').remove();
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<section id="target"><b>New target</b></section>',
    );
    const target = element('#target b');
    target.addEventListener('wheel', (event) => event.stopPropagation());
    wheel({}, target);
    expect(fired).toHaveBeenCalledOnce();
  });

  it('requires a two-finger pinch to widen by 5% and fires once until the fingers lift', () => {
    const { fired } = start();
    touch('touchstart', fingers(100).slice(0, 1));
    touch('touchmove', fingers(200).slice(0, 1));
    expect(fired).not.toHaveBeenCalled();
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(80));
    touch('touchmove', fingers(104));
    expect(fired).not.toHaveBeenCalled();
    expect(touch('touchmove', fingers(105)).defaultPrevented).toBe(false);
    touch('touchmove', fingers(180));
    expect(fired).toHaveBeenCalledOnce();
    touch('touchend', []);
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(110));
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('uses the pinch midpoint hit test and rejects a midpoint outside the selected element', () => {
    const hitTest = vi.fn().mockReturnValue(element('#outside'));
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: hitTest });
    const { fired } = start();
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(120));
    expect(hitTest).toHaveBeenCalledWith(200, 100);
    expect(fired).not.toHaveBeenCalled();
    touch('touchend', []);
    hitTest.mockReturnValue(element());
    const targets = [element('#outside'), element('#outside')];
    touch('touchstart', fingers(100, targets), element('#outside'));
    touch('touchmove', fingers(120, targets), element('#outside'));
    expect(fired).toHaveBeenCalledOnce();
  });

  it('requires both touch targets to belong to the same selected element without hit testing', () => {
    const { fired } = start({ event: 'zoom-in', selector: '.zoom-target' });
    element('#target').className = 'zoom-target';
    element('#outside').className = 'zoom-target';
    const targets = [element(), element('#outside')];
    touch('touchstart', fingers(100, targets));
    touch('touchmove', fingers(120, targets));
    expect(fired).not.toHaveBeenCalled();
    touch('touchend', []);
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(120));
    expect(fired).toHaveBeenCalledOnce();
  });

  it('tracks touch identities and cancels incomplete pinches', () => {
    const { fired } = start();
    touch('touchstart', fingers(100));
    const replacement = fingers(200);
    replacement[1].identifier = 3;
    touch('touchmove', replacement);
    expect(fired).not.toHaveBeenCalled();
    touch('touchcancel', []);
    touch('touchmove', fingers(220));
    expect(fired).not.toHaveBeenCalled();
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(110).reverse());
    expect(fired).toHaveBeenCalledOnce();
  });

  it('detects native viewport zoom during an active pinch without duplicate touch or gesture events', () => {
    const { fired } = start();
    touch('touchstart', fingers(100));
    gesture('gesturestart', 1);
    scale(1.04);
    expect(fired).not.toHaveBeenCalled();
    scale(1.05);
    touch('touchmove', fingers(120));
    gesture('gesturechange', 1.2);
    scale(1.3);
    expect(fired).toHaveBeenCalledOnce();
    gesture('gestureend', 1.2);
    touch('touchend', []);
    touch('touchstart', fingers(100));
    scale(1.3 * 1.06);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it('supports Safari gesture events and rearms after gestureend', () => {
    const { fired } = start();
    gesture('gesturestart', 1, element('#outside'));
    gesture('gesturechange', 1.2, element('#outside'));
    gesture('gestureend', 1.2, element('#outside'));
    gesture('gesturestart', 1);
    gesture('gesturechange', 0.8);
    gesture('gesturechange', 1.04);
    expect(fired).not.toHaveBeenCalled();
    expect(gesture('gesturechange', 1.06).defaultPrevented).toBe(false);
    gesture('gesturechange', 1.3);
    expect(fired).toHaveBeenCalledOnce();
    gesture('gestureend', 1.3);
    gesture('gesturestart', 1);
    gesture('gesturechange', 1.1);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it.each(['wheel', 'gesture'] as const)(
    'counts overlapping Safari and wheel events once when %s arrives first',
    async (first) => {
      const { fired } = start();
      if (first === 'wheel') wheel();
      gesture('gesturestart', 1);
      gesture('gesturechange', 1.1);
      wheel();
      gesture('gestureend', 1.1);
      wheel();
      expect(fired).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(300);
      wheel();
      expect(fired).toHaveBeenCalledTimes(2);
    },
  );

  it('detects native pinch zoom when the browser cancels touch delivery before viewport resize', () => {
    const { fired } = start();
    touch('touchstart', fingers(100));
    touch('touchcancel', []);
    scale(1.04);
    expect(fired).not.toHaveBeenCalled();
    scale(1.05);
    scale(1.2);
    expect(fired).toHaveBeenCalledOnce();
  });

  it('expires cancelled native pinches and drops them when another touch begins', async () => {
    const { fired } = start();
    touch('touchstart', fingers(100));
    touch('touchcancel', []);
    await vi.advanceTimersByTimeAsync(500);
    scale(1.2);
    expect(fired).not.toHaveBeenCalled();
    touch('touchstart', fingers(100));
    touch('touchcancel', []);
    touch('touchstart', fingers(100).slice(0, 1));
    scale(1.5);
    expect(fired).not.toHaveBeenCalled();
  });

  it('finishes cancelled pinches immediately when native viewport detection is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);
    const { fired } = start();
    touch('touchstart', fingers(100));
    touch('touchcancel', []);
    touch('touchmove', fingers(120));
    expect(fired).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(120));
    expect(fired).toHaveBeenCalledOnce();
  });

  it('clears gesture history on visibility changes and ignores activity while hidden', () => {
    const { fired } = start();
    touch('touchstart', fingers(100));
    visibility(true);
    touch('touchmove', fingers(120));
    wheel();
    gesture('gesturestart', 1);
    gesture('gesturechange', 1.2);
    scale(1.5);
    expect(fired).not.toHaveBeenCalled();
    visibility(false);
    touch('touchmove', fingers(140));
    gesture('gesturechange', 1.4);
    scale(1.7);
    expect(fired).not.toHaveBeenCalled();
    wheel();
    expect(fired).toHaveBeenCalledOnce();
    visibility(true);
    visibility(false);
    wheel();
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it.each(['destroy', 'abort'] as const)('removes listeners and pending timers on %s', (method) => {
    const observers = [document, window, viewport].map((target) => ({
      add: vi.spyOn(target, 'addEventListener'),
      remove: vi.spyOn(target, 'removeEventListener'),
    }));
    const controller = new AbortController();
    const { instance, fired } = start(zoomConfig, controller.signal);
    wheel();
    touch('touchstart', fingers(100));
    touch('touchcancel', []);
    expect(vi.getTimerCount()).toBe(1);
    if (method === 'abort') controller.abort();
    else instance.destroy();
    for (const { add, remove } of observers) {
      for (const [event, listener, options] of add.mock.calls) {
        expect(remove).toHaveBeenCalledWith(
          event,
          listener,
          typeof options === 'object' ? options.capture : options,
        );
      }
    }
    expect(vi.getTimerCount()).toBe(0);
    wheel();
    touch('touchstart', fingers(100));
    touch('touchmove', fingers(140));
    gesture('gesturestart', 1);
    gesture('gesturechange', 1.3);
    scale(2);
    expect(fired).toHaveBeenCalledOnce();
  });
});

describe('element zoom-in contracts and exports', () => {
  it('requires a valid selector and reports invalid runtime configuration without firing', () => {
    for (const selector of [undefined, '', ' ', '[']) {
      const config: StepConfig = { event: 'zoom-in', selector };
      const issues = validateWorkflow(workflow(config));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toMatch(/target element|CSS selector/i);
      expect(() => exportWorkflow(workflow(config))).toThrow();
      const { fired, logs } = start(config);
      wheel();
      expect(fired).not.toHaveBeenCalled();
      expect(logs.some((entry) => entry.nodeId === 'start' && entry.status === 'error')).toBe(true);
    }
  });

  it('preserves the selected element through JSON and AI operations without public settings', () => {
    const graph = workflow();
    expect(elementTriggerEvents).toContain('zoom-in');
    expect(triggerOptions['zoom-in'].settings).toEqual([]);
    expect(validateWorkflow(graph)).toEqual([]);
    expect(isWorkflow(JSON.parse(JSON.stringify(graph)))).toBe(true);
    expect(
      parseAIChatRequest({
        workflow: graph,
        messages: [{ role: 'user', content: 'Zoom into the target' }],
        selectedNodeIds: [],
      }).workflow.nodes[0].data.config,
    ).toEqual(zoomConfig);
    const response = parseAIChatResponse({
      message: 'Updated',
      operations: [{ type: 'update_node', id: 'start', config: zoomConfig }],
    });
    expect(applyWorkflowOperations(workflow({}), response.operations).nodes[0].data.config).toEqual(
      zoomConfig,
    );
  });

  it.each(['wheel', 'touch', 'viewport', 'gesture'] as const)(
    'exports dependency-free %s zoom detection',
    async (source) => {
      const script = exportWorkflow(workflow());
      new Function('window', 'document', script)(window, document);
      if (source === 'wheel') wheel();
      else if (source === 'gesture') {
        gesture('gesturestart', 1);
        gesture('gesturechange', 1.1);
      } else {
        touch('touchstart', fingers(100));
        if (source === 'touch') touch('touchmove', fingers(110));
        else scale(1.1);
      }
      await Promise.resolve();
      expect(element('#result').textContent).toBe('Triggered');
    },
  );
});
