import { createExperimentTools } from '../../lib/experiment';
import type { Workflow } from './workflow/types';

/** Concise behavior facts take precedence over guesses and prior assistant proposals. */
export const reviewBehaviorFacts = {
  experiments: {
    defaultIdentity:
      'A missing or blank experimentKey uses the stable node ID; a custom key is optional, including for shared workflow analytics.',
    persistence:
      'Assignments use localStorage in the visitor browser and website origin, with runtime memory as the fallback when storage is unavailable. With unchanged identity, origin and readable stored assignment, returning visitors keep their variant across runtime restarts and redeployments.',
    resets:
      'Workflow schema/reporting versions and deployment do not participate in the storage key. A different node ID changes the bucket only when using the node-ID fallback. Changing the custom key selects a different bucket, without migrating or clearing the old one; an existing assignment in that bucket is reused. Clearing storage removes persistence across runtimes.',
    traffic:
      'Traffic split applies to new assignments; changing the split does not reassign stored visitors.',
    routing:
      'Each invocation selects exactly one variant, a OR b, and passes input unchanged only to edges for that variant. The two variant paths intentionally may update the same element. That shared target alone is not evidence of both branches executing or overwriting each other.',
  },
  notes:
    'Notes are non-executable canvas annotations. They never run or collect analytics, impressions or conversions; adding a note cannot implement tracking.',
  analytics:
    'Showing a headline or popover establishes exposure, not a confirmed conversion. Track event nodes can emit a milestone after a signal actually confirms it. Execution completion alone is not a conversion. Shared analytics uses workflow.analytics; do not suggest legacy per-node delivery fields.',
};

/** Derive per-node evidence from the actual draft and the runtime's own key function. */
export function experimentReviewFacts(original: Workflow, draft: Workflow) {
  const tools = createExperimentTools();
  return draft.nodes
    .filter((node) => node.data.kind === 'experiment')
    .map((node) => {
      const previous = original.nodes.find(
        (entry) => entry.id === node.id && entry.data.kind === 'experiment',
      );
      const storageKey = tools.assignmentKey(node.id, node.data.config);
      const previousStorageKey = previous
        ? tools.assignmentKey(previous.id, previous.data.config)
        : null;
      const trafficToA = node.data.config.experimentSplit ?? 50;
      return {
        nodeId: node.id,
        usesNodeId: !node.data.config.experimentKey?.trim(),
        storageKey,
        previousStorageKey,
        storageKeyChanged: previousStorageKey === null ? null : storageKey !== previousStorageKey,
        trafficPercent: { a: trafficToA, b: 100 - trafficToA },
        branchTargets: Object.fromEntries(
          ['a', 'b'].map((handle) => [
            handle,
            draft.edges
              .filter((edge) => edge.source === node.id && edge.sourceHandle === handle)
              .map((edge) => edge.target),
          ]),
        ),
      };
    });
}
