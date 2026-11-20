import type { Workflow } from '../types';
import type { startBehaviorTrigger } from './behavior-triggers';
import type { RuntimeContext } from './context';
import type { startSwipeTrigger } from './swipe-trigger';
import type { WorkflowRuntime } from './types';
import type { startZoomTrigger } from './zoom-trigger';

interface TriggerModules {
  startBehaviorTrigger: typeof startBehaviorTrigger;
  startZoomTrigger: typeof startZoomTrigger;
  startSwipeTrigger: typeof startSwipeTrigger;
}

export function startTriggers(
  workflow: Workflow,
  context: RuntimeContext,
  run: WorkflowRuntime['run'],
  { startBehaviorTrigger, startZoomTrigger, startSwipeTrigger }: TriggerModules,
): void {
  const { doc, win, cleanups, listen, log, reportFailure } = context;
  for (const node of workflow.nodes.filter((entry) => entry.data.kind === 'trigger')) {
    const config = node.data.config;
    if (!config.event || config.event === 'page-load') {
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
    } else if (config.event === 'custom-event') {
      // Surrounding whitespace is not part of the name, including in imported or AI-edited JSON.
      const name = typeof config.customEventName === 'string' ? config.customEventName.trim() : '';
      if (!name) {
        log(node.id, 'error', 'Enter a custom event name for this trigger.');
        continue;
      }
      // The trimmed name matches event types exactly and case-sensitively. A capture listener on the window sees
      // each dispatch once, whether the page dispatches on window, document, or any element,
      // and whether or not the event bubbles. The type tag, unlike instanceof, also works for
      // events created in another realm. Built-in browser events sharing the name are ignored.
      listen(
        win,
        name,
        (incoming) => {
          if (Object.prototype.toString.call(incoming) !== '[object CustomEvent]') return;
          // The detail (null when omitted) becomes the next step's incoming data. A snapshot
          // keeps later changes to the page's object from affecting this run, for example
          // during a delay; values that cannot be cloned, such as functions, pass unchanged.
          let detail: unknown = (incoming as CustomEvent).detail;
          try {
            detail = structuredClone(detail);
          } catch {
            /* Keep the original value. */
          }
          void run(node.id, { exists: true, value: detail }).catch(reportFailure);
        },
        true,
      );
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
