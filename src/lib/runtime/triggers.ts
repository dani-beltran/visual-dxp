import type { Workflow } from '../types';
import type { startBehaviorTrigger } from './behavior-triggers';
import type { createShopifyAdapter, startCommerceTrigger } from './commerce-trigger';
import type { RuntimeContext } from './context';
import type { RunTrigger } from './execution';
import type { startSwipeTrigger } from './swipe-trigger';
import type { startZoomTrigger } from './zoom-trigger';

interface TriggerModules {
  createShopifyAdapter: typeof createShopifyAdapter;
  startCommerceTrigger: typeof startCommerceTrigger;
  startBehaviorTrigger: typeof startBehaviorTrigger;
  startZoomTrigger: typeof startZoomTrigger;
  startSwipeTrigger: typeof startSwipeTrigger;
}

export function startTriggers(
  workflow: Workflow,
  context: RuntimeContext,
  run: RunTrigger,
  modules: TriggerModules,
): void {
  const { startBehaviorTrigger, startZoomTrigger, startSwipeTrigger, startCommerceTrigger } =
    modules;
  const { doc, cleanups, log, reportFailure } = context;
  for (const node of workflow.nodes.filter((entry) => entry.data.kind === 'trigger')) {
    const config = node.data.config;
    if (config.event === 'commerce-product-added-to-cart') {
      startCommerceTrigger(node.id, config, context, run, modules);
    } else if (!config.event || config.event === 'page-load') {
      const ready = () => {
        void run(node.id).catch(reportFailure);
      };
      if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', ready, { once: true });
        cleanups.add(() => doc.removeEventListener('DOMContentLoaded', ready));
      } else {
        void Promise.resolve().then(ready);
      }
    } else if (
      ['exit-intent', 'rage-click', 'inactivity', 'scroll-thrashing', 'scroll-depth'].includes(
        config.event,
      )
    ) {
      try {
        startBehaviorTrigger(node.id, config, context, run);
      } catch (error) {
        log(node.id, 'error', error instanceof Error ? error.message : 'Invalid trigger settings.');
      }
    } else if (
      ['click', 'mouseover', 'submit', 'change', 'zoom-in', 'swipe'].includes(config.event)
    ) {
      if (typeof config.selector !== 'string' || !config.selector.trim()) {
        log(node.id, 'error', 'Choose an element for this event trigger.');
        continue;
      }
      try {
        doc.querySelector(config.selector);
      } catch {
        log(node.id, 'error', 'The trigger CSS selector is invalid.');
        continue;
      }
      const selector = config.selector;
      const event = config.event;
      if (event === 'zoom-in') {
        startZoomTrigger(node.id, selector, context, run);
        continue;
      }
      if (event === 'swipe') {
        startSwipeTrigger(node.id, selector, context, run);
        continue;
      }
      const listener = (incoming: Event) => {
        const target = incoming.target as Element | null;
        if (target?.closest?.(selector)) void run(node.id).catch(reportFailure);
      };
      doc.addEventListener(event, listener);
      cleanups.add(() => doc.removeEventListener(event, listener));
    } else {
      log(node.id, 'error', 'Choose a supported trigger event.');
    }
  }
}
