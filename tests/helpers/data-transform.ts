import type { StepConfig, Workflow } from '../../src/lib/types';

/** Insert an explicit transform on a test workflow connection. */
export function insertTransform(workflow: Workflow, edgeId: string, config: StepConfig): void {
  const edge = workflow.edges.find((entry) => entry.id === edgeId)!;
  const id = `${edgeId}-transform`;
  workflow.nodes.push({
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind: 'transform', label: 'Select data', config },
  });
  workflow.edges.push({ id: `${id}-out`, source: id, target: edge.target });
  edge.target = id;
}
