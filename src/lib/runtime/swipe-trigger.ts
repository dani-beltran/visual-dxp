import type { RuntimeContext } from './context';
import type { WorkflowRuntime } from './types';

export function startSwipeTrigger(
  nodeId: string,
  selector: string,
  context: RuntimeContext,
  run: WorkflowRuntime['run'],
): void {
  const { doc, win, cleanups, listen, reportFailure } = context;
  type Swipe = {
    source: 'touch' | 'pointer';
    id: number;
    element: Element;
    x: number;
    y: number;
    time: number;
  };
  let swipe: Swipe | undefined;
  const pointers = new Set<number>();
  const reset = () => {
    swipe = undefined;
    pointers.clear();
  };
  const begin = (
    source: Swipe['source'],
    id: number,
    target: EventTarget | null,
    x: number,
    y: number,
  ) => {
    swipe = undefined;
    const element = (target as Element | null)?.closest?.(selector);
    if (doc.hidden || !element || !Number.isFinite(x) || !Number.isFinite(y)) return;
    swipe = { source, id, element, x, y, time: Date.now() };
  };
  const finish = (x: number, y: number) => {
    const started = swipe;
    swipe = undefined;
    if (!started || doc.hidden || context.destroyed) return;
    const elapsed = Date.now() - started.time;
    const distance = Math.hypot(x - started.x, y - started.y);
    if (
      elapsed >= 0 &&
      elapsed <= 1000 &&
      Number.isFinite(distance) &&
      distance >= 50 &&
      started.element.isConnected &&
      started.element.matches(selector)
    )
      void run(nodeId).catch(reportFailure);
  };

  // Prefer the touch stream when both APIs describe the same contact. Native
  // scrolling may cancel pointer delivery while touch events still complete.
  listen(
    doc,
    'touchstart',
    (event) => {
      const touches = (event as TouchEvent).touches;
      if (touches.length !== 1 || pointers.size > 1) {
        swipe = undefined;
        return;
      }
      const touch = touches[0];
      begin('touch', touch.identifier, touch.target, touch.clientX, touch.clientY);
    },
    true,
  );
  listen(
    doc,
    'touchmove',
    (event) => {
      if (swipe?.source !== 'touch') return;
      const touches = (event as TouchEvent).touches;
      if (touches.length !== 1 || touches[0].identifier !== swipe.id) swipe = undefined;
    },
    true,
  );
  listen(
    doc,
    'touchend',
    (event) => {
      if (swipe?.source !== 'touch') return;
      const touchEvent = event as TouchEvent;
      const touch = Array.from(touchEvent.changedTouches).find(
        (touch) => touch.identifier === swipe?.id,
      );
      if (touchEvent.touches.length || !touch) {
        swipe = undefined;
        return;
      }
      finish(touch.clientX, touch.clientY);
    },
    true,
  );
  listen(
    doc,
    'touchcancel',
    () => {
      swipe = undefined;
    },
    true,
  );

  listen(
    doc,
    'pointerdown',
    (event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') return;
      pointers.add(pointer.pointerId);
      if (!pointer.isPrimary || pointer.button !== 0 || pointers.size !== 1) {
        swipe = undefined;
        return;
      }
      begin('pointer', pointer.pointerId, pointer.target, pointer.clientX, pointer.clientY);
    },
    true,
  );
  listen(
    doc,
    'pointerup',
    (event) => {
      const pointer = event as PointerEvent;
      pointers.delete(pointer.pointerId);
      if (swipe?.source === 'pointer' && swipe.id === pointer.pointerId)
        finish(pointer.clientX, pointer.clientY);
    },
    true,
  );
  listen(
    doc,
    'pointercancel',
    (event) => {
      const pointer = event as PointerEvent;
      pointers.delete(pointer.pointerId);
      if (swipe?.source === 'pointer' && swipe.id === pointer.pointerId) swipe = undefined;
    },
    true,
  );
  listen(doc, 'visibilitychange', reset);
  listen(win, 'blur', reset);
  cleanups.add(reset);
}
