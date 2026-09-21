import type { StepConfig } from '../types';
import type { RuntimeContext } from './context';
import type { WorkflowRuntime } from './types';

export function startBehaviorTrigger(
  nodeId: string,
  config: StepConfig,
  context: RuntimeContext,
  run: WorkflowRuntime['run'],
): void {
  const { doc, win, cleanups, listen, reportFailure } = context;
  const fire = () => {
    void run(nodeId).catch(reportFailure);
  };
  // Keep these defaults and bounds aligned with ../triggers.ts. This function must
  // remain self-contained so the exported script has no module dependencies.
  const setting = (key: keyof StepConfig, fallback: number, min: number, max: number) => {
    const value = config[key] === undefined ? fallback : config[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
      throw new Error(`${key} must be a whole number between ${min} and ${max}.`);
    return value;
  };
  if (config.event === 'exit-intent') {
    let fired = false;
    listen(doc, 'mouseout', (event) => {
      const mouse = event as MouseEvent;
      if (!fired && !doc.hidden && mouse.relatedTarget === null && mouse.clientY <= 0) {
        fired = true;
        fire();
      }
    });
    return;
  }
  if (config.event === 'rage-click') {
    const count = setting('rageClickCount', 3, 2, 100);
    const windowMs = setting('rageClickWindow', 1000, 100, 60000);
    const radius = setting('rageClickRadius', 50, 1, 1000);
    let clicks: { time: number; x: number; y: number }[] = [];
    listen(
      doc,
      'click',
      (event) => {
        const mouse = event as MouseEvent;
        // Keyboard activation has detail=0 and must not count as rage clicking.
        if (doc.hidden || mouse.button !== 0 || mouse.detail === 0) return;
        const now = Date.now();
        clicks = clicks.filter((click) => now - click.time <= windowMs);
        const first = clicks[0];
        if (first && Math.hypot(mouse.clientX - first.x, mouse.clientY - first.y) > radius)
          clicks = [];
        clicks.push({ time: now, x: mouse.clientX, y: mouse.clientY });
        if (clicks.length >= count) {
          clicks = [];
          fire();
        }
      },
      true,
    );
    listen(doc, 'visibilitychange', () => {
      clicks = [];
    });
    return;
  }
  if (config.event === 'inactivity') {
    const duration = setting('duration', 30000, 1000, 86400000);
    let timer: number | undefined;
    const reset = () => {
      win.clearTimeout(timer);
      timer = undefined;
      if (!doc.hidden && !context.destroyed) {
        timer = win.setTimeout(() => {
          timer = undefined;
          if (!doc.hidden) fire();
        }, duration);
      }
    };
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
    ])
      listen(doc, event, reset, true);
    listen(win, 'scroll', reset);
    listen(doc, 'visibilitychange', reset);
    cleanups.add(() => win.clearTimeout(timer));
    reset();
    return;
  }

  const pageScroll = () => {
    const root = doc.documentElement;
    const height = Math.max(root.scrollHeight, doc.body?.scrollHeight ?? 0);
    const maximum = Math.max(0, height - (win.innerHeight || root.clientHeight));
    const offset = win.scrollY || doc.scrollingElement?.scrollTop || root.scrollTop || 0;
    return { maximum, position: Math.max(0, Math.min(maximum, offset)) };
  };
  const isPageScroll = (event: Event) =>
    event.target === doc ||
    event.target === win ||
    event.target === doc.documentElement ||
    event.target === doc.body;
  if (config.event === 'scroll-depth') {
    const threshold = setting('scrollThreshold', 75, 1, 100);
    let previous = pageScroll().position;
    let fired = false;
    listen(
      win,
      'scroll',
      (event) => {
        if (!isPageScroll(event)) return;
        const { position, maximum } = pageScroll();
        const downward = position > previous;
        previous = position;
        if (
          !fired &&
          !doc.hidden &&
          downward &&
          maximum > 0 &&
          (position / maximum) * 100 >= threshold
        ) {
          fired = true;
          fire();
        }
      },
      true,
    );
    listen(doc, 'visibilitychange', () => {
      previous = pageScroll().position;
    });
    return;
  }
  if (config.event === 'scroll-thrashing') {
    const count = setting('scrollDirectionChanges', 4, 2, 100);
    const windowMs = setting('scrollThrashWindow', 2000, 100, 60000);
    const distance = setting('scrollMinDistance', 50, 1, 1000);
    let previous = pageScroll().position;
    let extreme = previous;
    let direction = 0;
    let lastMovement = Date.now();
    let reversals: number[] = [];
    const reset = () => {
      previous = pageScroll().position;
      extreme = previous;
      direction = 0;
      reversals = [];
    };
    listen(
      win,
      'scroll',
      (event) => {
        if (!isPageScroll(event)) return;
        if (doc.hidden) {
          reset();
          return;
        }
        const current = pageScroll().position;
        if (current === previous) return;
        const now = Date.now();
        if (now - lastMovement > windowMs) {
          direction = 0;
          extreme = previous;
          reversals = [];
        }
        previous = current;
        lastMovement = now;
        reversals = reversals.filter((time) => now - time <= windowMs);
        const delta = current - extreme;
        if (direction && Math.sign(delta) === direction) {
          extreme = current;
        } else if (Math.abs(delta) >= distance) {
          if (direction) reversals.push(now);
          direction = Math.sign(delta);
          extreme = current;
          if (reversals.length >= count) {
            reset();
            fire();
          }
        }
      },
      true,
    );
    listen(doc, 'visibilitychange', reset);
  }
}
