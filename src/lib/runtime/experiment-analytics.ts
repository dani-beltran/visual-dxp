import type { createExperimentTools } from '../experiment';
import type { StepConfig } from '../types';
import type { RuntimeContext } from './context';

/** Self-contained for the standalone runtime, including minified library exports. */
export function createExperimentAnalytics(
  context: RuntimeContext,
  tools: ReturnType<typeof createExperimentTools>,
) {
  const { doc, win, log } = context;
  const browser = win as Window &
    typeof globalThis & {
      gtag?: (command: string, event: string, parameters: Record<string, string>) => void;
      dataLayer?: { push: (event: Record<string, string>) => unknown };
    };
  type Tracking = {
    nodeId: string;
    id: string;
    variant: 'a' | 'b';
    selector: string;
    interaction: 'click' | 'change';
    delivery: 'gtag' | 'gtm';
    measurementId: string;
    key: string;
  };
  const active = new Map<string, Tracking>();
  const exposures = new Set<string>();
  const interactions = new WeakMap<Event, Set<string>>();
  const observed = new Set<Element>();
  let installed = false;
  let frame: number | undefined;
  let observer: IntersectionObserver | undefined;
  let mutations: MutationObserver | undefined;
  let disposed = false;

  function emit(tracking: Tracking, event: 'experiment_view' | 'experiment_cta'): void {
    const parameters: Record<string, string> = {
      experiment_id: tracking.id,
      variant_id: tracking.variant,
      ...(event === 'experiment_cta' ? { cta_type: tracking.interaction } : {}),
    };
    const detail = `${event} ${JSON.stringify(parameters)}`;
    if (context.analyticsMode === 'simulate') {
      context.recordAnalytics?.(
        event,
        tracking.delivery,
        tracking.delivery === 'gtag'
          ? [
              'event',
              event,
              {
                ...parameters,
                ...(tracking.measurementId ? { send_to: tracking.measurementId } : {}),
              },
            ]
          : { event, ...parameters },
      );
      log(tracking.nodeId, 'success', `Simulated analytics: ${detail}`);
      return;
    }
    try {
      if (tracking.delivery === 'gtag') {
        if (typeof browser.gtag !== 'function') throw new Error('window.gtag is unavailable');
        browser.gtag('event', event, {
          ...parameters,
          ...(tracking.measurementId ? { send_to: tracking.measurementId } : {}),
        });
      } else {
        if (typeof browser.dataLayer?.push !== 'function')
          throw new Error('window.dataLayer is unavailable');
        browser.dataLayer.push({ event, ...parameters });
      }
      // These APIs can queue without a loaded tag, consent, or a configured destination.
      log(
        tracking.nodeId,
        'success',
        `Analytics queued via ${tracking.delivery}: ${detail}. Delivery is not confirmed.`,
      );
    } catch {
      log(
        tracking.nodeId,
        'success',
        `Analytics unavailable via ${tracking.delivery}: ${detail}. Event was not queued.`,
      );
    }
  }

  function visible(element: Element): boolean {
    if (!element.isConnected || doc.hidden) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    let left = Math.max(0, rect.left);
    let right = Math.min(win.innerWidth || doc.documentElement.clientWidth, rect.right);
    let top = Math.max(0, rect.top);
    let bottom = Math.min(win.innerHeight || doc.documentElement.clientHeight, rect.bottom);
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      const style = win.getComputedStyle(parent);
      if (
        parent.hasAttribute('hidden') ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.contentVisibility === 'hidden' ||
        style.opacity === '0'
      )
        return false;
      if (parent !== element) {
        const bounds = parent.getBoundingClientRect();
        if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX || style.overflow)) {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY || style.overflow)) {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
      }
    }
    return right > left && bottom > top;
  }

  function scan(): void {
    frame = undefined;
    if (disposed || context.destroyed) return;
    const targets = new Set<Element>();
    for (const tracking of active.values()) {
      for (const element of doc.querySelectorAll(tracking.selector)) {
        targets.add(element);
        if (!exposures.has(tracking.key) && visible(element)) {
          exposures.add(tracking.key);
          emit(tracking, 'experiment_view');
        }
      }
    }
    // Stop observing detached/replaced targets; discover new downstream DOM content.
    for (const element of observed) {
      if (!targets.has(element)) {
        observer?.unobserve(element);
        observed.delete(element);
      }
    }
    for (const element of targets) {
      if (!observed.has(element)) {
        observer?.observe(element);
        observed.add(element);
      }
    }
  }

  function schedule(): void {
    if (disposed || frame !== undefined) return;
    // Wait for downstream synchronous DOM changes and the next rendered frame.
    frame = win.requestAnimationFrame ? win.requestAnimationFrame(scan) : win.setTimeout(scan, 0);
  }

  function interact(event: Event): void {
    if (disposed || context.destroyed) return;
    const target = event.composedPath().find((item) => (item as Node).nodeType === 1) as
      | Element
      | undefined;
    if (!target || target.ownerDocument !== doc) return;
    let handled = interactions.get(event);
    if (!handled) {
      handled = new Set();
      interactions.set(event, handled);
    }
    for (const tracking of active.values()) {
      if (
        event.type !== tracking.interaction ||
        !exposures.has(tracking.key) ||
        handled.has(tracking.key)
      )
        continue;
      const cta = target.closest(tracking.selector);
      if (!cta || !visible(cta)) continue;
      handled.add(tracking.key);
      emit(tracking, 'experiment_cta');
    }
  }

  function install(): void {
    if (installed) return;
    installed = true;
    context.listen(doc, 'click', interact, true);
    context.listen(doc, 'change', interact, true);
    context.listen(doc, 'scroll', schedule, true);
    context.listen(win, 'resize', schedule);
    context.listen(doc, 'visibilitychange', schedule);
    context.listen(doc, 'transitionend', schedule, true);
    context.listen(doc, 'animationend', schedule, true);
    if (typeof browser.IntersectionObserver === 'function')
      observer = new browser.IntersectionObserver(schedule, { threshold: 0 });
    if (typeof browser.MutationObserver === 'function') {
      mutations = new browser.MutationObserver(schedule);
      mutations.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }
    context.cleanups.add(() => {
      disposed = true;
      observer?.disconnect();
      mutations?.disconnect();
      if (frame !== undefined) {
        if (win.cancelAnimationFrame) win.cancelAnimationFrame(frame);
        else win.clearTimeout(frame);
      }
      active.clear();
      observed.clear();
      exposures.clear();
    });
  }

  function track(nodeId: string, config: StepConfig, variant: 'a' | 'b'): void {
    if (disposed || context.destroyed) return;
    active.delete(nodeId);
    if (config.experimentAnalytics === undefined || config.experimentAnalytics === 'none') return;
    try {
      tools.validateAnalytics(config);
      const selector = config.experimentSelector?.trim() ?? '';
      doc.querySelector(selector); // Same browser CSS validation used for Trigger selectors.
      install();
      const id = config.experimentKey?.trim() ?? '';
      active.set(nodeId, {
        nodeId,
        id,
        variant,
        selector,
        interaction: config.experimentInteraction ?? 'click',
        delivery: config.experimentDelivery ?? 'gtag',
        measurementId: config.experimentMeasurementId?.trim() ?? '',
        key: JSON.stringify([id, variant]),
      });
      schedule();
    } catch {
      // Even malformed imported tracking cannot stop the assigned experience.
      log(
        nodeId,
        'success',
        'Analytics unavailable: invalid tracking configuration. Event was not queued.',
      );
    }
  }

  return { track };
}
