import type { Workflow } from '../types';
import type { CapturedAnalyticsEvent, createAnalyticsCaptureTools } from './analytics-capture';
import type { RuntimeContext } from './context';

/** Self-contained so exported scripts and the preview bridge use the same hooks. */
export function installAnalyticsInterception(
  workflow: Workflow,
  context: RuntimeContext,
  captureTools: ReturnType<typeof createAnalyticsCaptureTools>,
): void {
  if (workflow.analytics?.provider !== 'ga4') return;
  if (context.signal.aborted) return;
  type Sink = { references: number; record: (event: CapturedAnalyticsEvent) => void };
  type Hub = { sinks: Map<string, Sink>; dispose: () => void };
  const browser = context.win as unknown as Record<PropertyKey, unknown>;
  const hubKey = Symbol.for('visual-dxp.analytics-interception.v2');
  const storageKey =
    context.analyticsMode === 'simulate'
      ? 'visual-dxp:analytics:preview:v1'
      : 'visual-dxp:analytics:v1';

  let hub = browser[hubKey] as Hub | undefined;
  if (!hub) {
    const sinks = new Map<string, Sink>();
    const cleanups: (() => void)[] = [];
    const refreshers: (() => void)[] = [];
    const layers = new WeakSet<object>();
    let active = true;
    const pendingItems = new Set<unknown>();
    const tagCalls: unknown[][] = [];
    const record = (name: unknown, source: CapturedAnalyticsEvent['source'], raw: unknown) => {
      if (!active) return;
      const event = captureTools.capture(name, source, raw);
      if (event) for (const sink of sinks.values()) sink.record(event);
    };

    // Observe ordinary assignments immediately, including tags loaded after us.
    // Locked/accessor properties keep their descriptors; writable locked methods
    // are refreshed periodically (there can be a short gap after replacement).
    function watch(
      target: Record<PropertyKey, unknown>,
      key: string,
      wrap: (value: unknown) => unknown,
      enumerable = true,
    ) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor && 'value' in descriptor && !descriptor.writable) return;
      if (descriptor && (!descriptor.configurable || !('value' in descriptor))) {
        if (!('value' in descriptor) || !descriptor.writable) return;
        let raw = target[key];
        let wrapped = wrap(raw);
        const refresh = () => {
          try {
            if (target[key] !== wrapped) {
              raw = target[key];
              wrapped = wrap(raw);
            }
            target[key] = wrapped;
          } catch {
            /* A site may lock its analytics APIs after initialization. */
          }
        };
        refreshers.push(refresh);
        refresh();
        cleanups.push(() => {
          if (target[key] === wrapped) target[key] = raw;
        });
        return;
      }
      const initial = target[key];
      let raw = initial;
      let wrapped = wrap(raw);
      const get = () => wrapped;
      const set = (value: unknown) => {
        raw = value;
        wrapped = wrap(value);
      };
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? enumerable,
        get,
        set,
      });
      let watching = true;
      refreshers.push(() => {
        if (watching && Object.getOwnPropertyDescriptor(target, key)?.get !== get) {
          watching = false;
          try {
            watch(target, key, wrap, enumerable);
          } catch {
            /* The host may replace descriptors. */
          }
        }
      });
      cleanups.push(() => {
        if (Object.getOwnPropertyDescriptor(target, key)?.get !== get) return;
        if (descriptor) Object.defineProperty(target, key, { ...descriptor, value: raw });
        else {
          delete target[key];
          if (raw !== undefined && raw !== initial)
            Object.defineProperty(target, key, {
              configurable: true,
              enumerable: true,
              writable: true,
              value: raw,
            });
        }
      });
    }

    function hookLayer(value: unknown): unknown {
      if (!value || typeof value !== 'object' || layers.has(value)) return value;
      layers.add(value);
      try {
        watch(
          value as Record<PropertyKey, unknown>,
          'push',
          (original) => {
            if (typeof original !== 'function') return original;
            return function (this: unknown, ...items: unknown[]) {
              const added = items.filter((item) => !pendingItems.has(item));
              for (const item of added) {
                try {
                  if (!item || typeof item !== 'object') continue;
                  const event = item as Record<string | number, unknown>;
                  if (event[0] === 'event') {
                    const forwarded = tagCalls.some(
                      (args) =>
                        args.length === event.length &&
                        args.every((arg, index) => arg === event[index]),
                    );
                    if (!forwarded) record(event[1], 'dataLayer', item);
                  } else record(event.event, 'dataLayer', item);
                } catch {
                  /* Observation must never prevent the original call. */
                }
              }
              for (const item of added) pendingItems.add(item);
              try {
                return Reflect.apply(original, this, items);
              } finally {
                for (const item of added) pendingItems.delete(item);
              }
            };
          },
          false,
        );
      } catch {
        /* Frozen data layers cannot be intercepted. */
      }
      return value;
    }

    try {
      watch(browser, 'dataLayer', hookLayer);
      watch(browser, 'gtag', (original) => {
        if (typeof original !== 'function') return original;
        return function (this: unknown, ...args: unknown[]) {
          if (args[0] === 'event') {
            const forwarded = tagCalls.some(
              (call) =>
                call.length === args.length && call.every((arg, index) => arg === args[index]),
            );
            if (!forwarded) record(args[1], 'gtag', args);
          }
          tagCalls.push(args);
          try {
            return Reflect.apply(original, this, args);
          } finally {
            tagCalls.pop();
          }
        };
      });
    } catch {
      /* Unavailable hooks must not stop the workflow. */
    }
    const timer = context.win.setInterval(() => {
      for (const refresh of refreshers) refresh();
      // Also discover a replaced data layer when its window property is locked.
      try {
        hookLayer(browser.dataLayer);
      } catch {
        /* Inaccessible host property. */
      }
    }, 250);
    hub = {
      sinks,
      dispose() {
        active = false;
        context.win.clearInterval(timer);
        for (const cleanup of cleanups.reverse()) {
          try {
            cleanup();
          } catch {
            /* Preserve later changes made by the host. */
          }
        }
        if (browser[hubKey] === hub) delete browser[hubKey];
      },
    };
    browser[hubKey] = hub;
  }

  let sink = hub.sinks.get(storageKey);
  if (!sink) {
    sink = {
      references: 0,
      record(event) {
        captureTools.store(storageKey, event);
      },
    };
    hub.sinks.set(storageKey, sink);
  }
  sink.references++;
  context.recordAnalytics = (name, delivery, data) => {
    const event = captureTools.capture(
      name,
      delivery === 'gtag' ? 'gtag' : 'dataLayer',
      data,
      true,
    );
    if (event) sink.record(event);
  };
  const currentHub = hub;
  const currentSink = sink;
  context.cleanups.add(() => {
    context.recordAnalytics = undefined;
    if (--currentSink.references === 0) currentHub.sinks.delete(storageKey);
    if (currentHub.sinks.size === 0) currentHub.dispose();
  });
}
