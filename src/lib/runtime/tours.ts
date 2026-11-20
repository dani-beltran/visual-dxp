import type { placePopover } from '../popoverPosition';
import type { WorkflowNode } from '../types';
import type { RuntimeContext } from './context';
import type { createPopoverElements, showPopover } from './popovers';

/** `replaced` means a newer run showed the same tour, or the runtime stopped. */
export interface TourResult {
  outcome: 'completed' | 'closed' | 'replaced';
  /** One-based step that was visible when the tour ended. */
  step: number;
  total: number;
}

/**
 * Show a Tour node's steps one at a time, each as a regular popover with Previous, Next and
 * Done controls, scrolling anchored steps into view. Settles once the visitor finishes or
 * closes the tour. Every step shares the tour's node ID, so each one replaces the step before it.
 */
export async function runTour(
  node: WorkflowNode,
  context: RuntimeContext,
  modules: {
    showPopover: typeof showPopover;
    createPopoverElements: typeof createPopoverElements;
    placePopover: typeof placePopover;
  },
): Promise<TourResult> {
  const config = node.data.config;
  const steps = Array.isArray(config.tourSteps) ? config.tourSteps : [];
  const total = steps.length;
  if (!total) throw new Error('Add at least one step to the tour.');
  // Literals match tourButtonDefaults; this function cannot import shared constants.
  const labels = {
    next: config.tourNextLabel?.trim() || 'Next',
    previous: config.tourPreviousLabel?.trim() || 'Previous',
    done: config.tourDoneLabel?.trim() || 'Done',
  };
  const requested = context.tourStartSteps?.[node.id] ?? 0;
  let index = Number.isInteger(requested) ? Math.max(0, Math.min(total - 1, requested)) : 0;
  let navigated = false;
  for (;;) {
    context.aborted();
    const last = index === total - 1;
    context.log(node.id, 'running', `Showing tour step ${index + 1} of ${total}`);
    const result = await modules.showPopover(
      { ...node, data: { ...node.data, config: { ...steps[index] } } },
      context,
      modules.createPopoverElements,
      modules.placePopover,
      {
        progress: `${index + 1} / ${total}`,
        actions: [
          ...(index > 0 ? [{ id: 'previous', label: labels.previous }] : []),
          last
            ? { id: 'done', label: labels.done, primary: true }
            : { id: 'next', label: labels.next, primary: true },
        ],
        focus: navigated,
        scrollToAnchor: true,
      },
    );
    // A step's own form does not collect data here; submitting it advances the tour.
    const action = result?.submitted ? (last ? 'done' : 'next') : result?.action;
    if (action === 'next' && !last) index += 1;
    else if (action === 'previous' && index > 0) index -= 1;
    else if (action === 'done') return { outcome: 'completed', step: index + 1, total };
    else if (action === 'close') return { outcome: 'closed', step: index + 1, total };
    else return { outcome: 'replaced', step: index + 1, total };
    navigated = true;
  }
}
