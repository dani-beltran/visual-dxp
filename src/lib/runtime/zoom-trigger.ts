import type { RuntimeContext } from './context';
import type { WorkflowRuntime } from './types';

export function startZoomTrigger(
  nodeId: string,
  selector: string,
  context: RuntimeContext,
  run: WorkflowRuntime['run'],
): void {
  const { doc, win, cleanups, listen, reportFailure } = context;
  // Observe gestures without consuming them or changing the site's zoom behavior.
  // A small pinch dead zone avoids firing on two-finger scrolling or touch jitter.
  const pinchRatio = 1.05;
  const wheelGap = 300;
  type ZoomSession = {
    source: 'touch' | 'gesture' | 'wheel' | 'viewport';
    element: Element;
    baseline: number;
    viewportScale: number;
    fired: boolean;
    touchIds?: number[];
  };
  let session: ZoomSession | undefined;
  let lastWheel = 0;
  let suppressWheelUntil = 0;
  let pendingPinch: number | undefined;
  const viewport = win.visualViewport;
  const selected = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.(selector) ?? null;
  const reset = () => {
    win.clearTimeout(pendingPinch);
    session = undefined;
    lastWheel = 0;
    suppressWheelUntil = 0;
  };
  const begin = (source: ZoomSession['source'], element: Element, baseline: number) => {
    win.clearTimeout(pendingPinch);
    // Safari can describe the same trackpad pinch with wheel and gesture events.
    const fired =
      session?.element === element &&
      session.fired &&
      (session.source !== 'wheel' || Date.now() - lastWheel < wheelGap);
    session = {
      source,
      element,
      baseline,
      viewportScale: viewport?.scale || 1,
      fired: !!fired,
    };
    return session;
  };
  const fire = () => {
    if (
      !session ||
      session.fired ||
      doc.hidden ||
      context.destroyed ||
      !session.element.isConnected ||
      !session.element.matches(selector)
    )
      return;
    session.fired = true;
    void run(nodeId).catch(reportFailure);
  };
  const end = () => {
    win.clearTimeout(pendingPinch);
    if (session?.fired) suppressWheelUntil = Date.now() + wheelGap;
    session = undefined;
  };

  listen(
    doc,
    'wheel',
    (event) => {
      const wheel = event as WheelEvent;
      if (doc.hidden || !wheel.ctrlKey || !Number.isFinite(wheel.deltaY) || !wheel.deltaY) return;
      if (session && session.source !== 'wheel') return;
      const now = Date.now();
      if (now < suppressWheelUntil) return;
      const element = selected(wheel.target);
      if (!element) {
        session = undefined;
        return;
      }
      if (session?.element !== element || now - lastWheel >= wheelGap) begin('wheel', element, 1);
      lastWheel = now;
      // Ctrl+wheel is also emitted for trackpad pinch in supporting browsers.
      // Its delta signals direction, not a reliable percentage of magnification.
      if (wheel.deltaY < 0) fire();
    },
    true,
  );

  listen(
    doc,
    'touchstart',
    (event) => {
      const touches = Array.from((event as TouchEvent).touches);
      if (doc.hidden || touches.length !== 2) {
        end();
        return;
      }
      const [first, second] = touches;
      const midpoint = doc.elementFromPoint?.(
        (first.clientX + second.clientX) / 2,
        (first.clientY + second.clientY) / 2,
      );
      const firstTarget = selected(first.target);
      const element =
        typeof doc.elementFromPoint === 'function'
          ? selected(midpoint ?? null)
          : firstTarget === selected(second.target)
            ? firstTarget
            : null;
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      if (!element || !Number.isFinite(distance) || distance <= 0) {
        end();
        return;
      }
      begin('touch', element, distance).touchIds = [first.identifier, second.identifier];
    },
    true,
  );
  listen(
    doc,
    'touchmove',
    (event) => {
      if (doc.hidden || session?.source !== 'touch') return;
      const touches = Array.from((event as TouchEvent).touches);
      if (
        touches.length !== 2 ||
        touches.some((touch) => !session?.touchIds?.includes(touch.identifier))
      ) {
        end();
        return;
      }
      const [first, second] = touches;
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      if (Number.isFinite(distance) && distance >= session.baseline * pinchRatio) fire();
    },
    true,
  );
  listen(doc, 'touchend', () => session?.source === 'touch' && end(), true);
  listen(
    doc,
    'touchcancel',
    () => {
      if (session?.source !== 'touch') return;
      if (!viewport || doc.hidden) {
        end();
        return;
      }
      // The browser can cancel touch delivery as it takes over native pinch
      // zoom. Briefly retain its target for the following viewport resize.
      session.source = 'viewport';
      pendingPinch = win.setTimeout(end, 500);
    },
    true,
  );
  cleanups.add(() => win.clearTimeout(pendingPinch));

  listen(
    doc,
    'gesturestart',
    (event) => {
      if (doc.hidden || session?.source === 'touch') return;
      const element = selected(event.target);
      if (!element) {
        end();
        return;
      }
      begin('gesture', element, 1);
    },
    true,
  );
  listen(
    doc,
    'gesturechange',
    (event) => {
      if (doc.hidden || !session || session.source === 'wheel') return;
      const scale = (event as Event & { scale: number }).scale;
      if (Number.isFinite(scale) && scale >= pinchRatio) fire();
    },
    true,
  );
  listen(doc, 'gestureend', () => session?.source === 'gesture' && end(), true);
  if (viewport)
    listen(viewport, 'resize', () => {
      // Native pinch zoom may stop delivering touchmove once the browser takes
      // over. Only attribute scale changes to a gesture started on this target.
      if (
        session &&
        session.source !== 'wheel' &&
        viewport.scale >= session.viewportScale * pinchRatio
      )
        fire();
    });
  listen(doc, 'visibilitychange', reset);
}
