import { RecoverableToolError } from '../../../lib/aiToolErrors';
import { FRAME_HEADER_HEIGHT } from '../../../lib/frames';
import { dimensions } from '../../../lib/workflowGeometry';
import type { WorkflowOperation } from './ai';
import type { Workflow, WorkflowNode } from './types';

export const LAYOUT_GAP = 52;
const size = dimensions;
export function canvasPosition(node: WorkflowNode, workflow: Workflow) {
  const parent = workflow.nodes.find((item) => item.id === node.parentId);
  return {
    x: node.position.x + (parent?.position.x ?? 0),
    y: node.position.y + (parent?.position.y ?? 0),
  };
}
function fail(message: string): never {
  throw new RecoverableToolError(
    'layout_conflict',
    `${message} Provide more space or revise the explicit position; frames are never resized or reparented automatically.`,
  );
}

/** Local, monotone left-to-right constraint solving. No input objects are mutated. */
export function layoutOperations(
  workflow: Workflow,
  seeds: Set<string>,
  pinned = new Set<string>(),
): WorkflowOperation[] {
  if (!seeds.size) return [];
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const affected = new Set([...seeds].filter((id) => nodes.has(id)));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }
  for (const id of affected) for (const target of outgoing.get(id) ?? []) affected.add(target);
  const positions = new Map(
    workflow.nodes.map((node) => [node.id, canvasPosition(node, workflow)]),
  );
  const remaining = new Set(nodes.keys());
  const order: string[] = [];
  while (remaining.size) {
    const ready = [...remaining]
      .filter((id) => !(incoming.get(id) ?? []).some((source) => remaining.has(source)))
      .sort();
    if (!ready.length) fail('Cannot lay out a circular graph.');
    for (const id of ready) {
      remaining.delete(id);
      order.push(id);
    }
  }
  const settled = new Set<string>();
  const changes: WorkflowOperation[] = [];
  for (const id of order) {
    const node = nodes.get(id)!;
    if (!affected.has(id) || node.data.kind === 'frame') {
      settled.add(id);
      continue;
    }
    const original = positions.get(id)!;
    const location = { ...original };
    const bounds = size(node);
    for (const source of incoming.get(id) ?? []) {
      location.x = Math.max(
        location.x,
        positions.get(source)!.x + size(nodes.get(source)!).width + LAYOUT_GAP,
      );
    }
    // Fixed unrelated nodes and already placed branches are obstacles. Future
    // descendants will resolve against this node when their turn arrives.
    const obstacles = workflow.nodes
      .filter(
        (other) =>
          other.id !== id &&
          other.id !== node.parentId &&
          (!affected.has(other.id) || pinned.has(other.id) || settled.has(other.id)),
      )
      .sort((a, b) => positions.get(a.id)!.x - positions.get(b.id)!.x || a.id.localeCompare(b.id));
    for (const other of obstacles) {
      // Members of a different frame are covered by that frame's rectangle.
      if (other.parentId && other.parentId !== node.parentId) continue;
      const at = positions.get(other.id)!;
      const dimensions = size(other);
      if (
        location.y < at.y + dimensions.height + LAYOUT_GAP &&
        location.y + bounds.height + LAYOUT_GAP > at.y &&
        location.x < at.x + dimensions.width + LAYOUT_GAP &&
        location.x + bounds.width + LAYOUT_GAP > at.x
      ) {
        location.x = at.x + dimensions.width + LAYOUT_GAP;
      }
    }
    if (pinned.has(id) && (location.x !== original.x || location.y !== original.y))
      fail(`Explicitly positioned node "${id}" blocks layout.`);
    const parent = node.parentId ? nodes.get(node.parentId)! : undefined;
    const origin = parent ? positions.get(parent.id)! : { x: 0, y: 0 };
    const relative = { x: location.x - origin.x, y: location.y - origin.y };
    if (
      parent &&
      (relative.x < 0 ||
        relative.y < FRAME_HEADER_HEIGHT ||
        relative.x + bounds.width > size(parent).width ||
        relative.y + bounds.height > size(parent).height)
    ) {
      fail(`Insufficient space in frame "${parent.id}" for node "${id}".`);
    }
    if (location.x !== original.x || location.y !== original.y)
      changes.push({ type: 'update_node', id, position: relative });
    positions.set(id, location);
    settled.add(id);
  }
  return changes;
}

/** Prefer the center of available horizontal space, on the successor's branch lane. */
export function insertionPosition(workflow: Workflow, source: WorkflowNode, target: WorkflowNode) {
  const a = canvasPosition(source, workflow);
  const b = canvasPosition(target, workflow);
  const left = a.x + size(source).width + LAYOUT_GAP;
  const parent = workflow.nodes.find((node) => node.id === source.parentId);
  const origin = parent?.position ?? { x: 0, y: 0 };
  const right = Math.min(
    b.x - 248 - LAYOUT_GAP,
    parent ? origin.x + size(parent).width - 248 : Infinity,
  );
  const y = parent
    ? Math.max(origin.y + FRAME_HEADER_HEIGHT, Math.min(b.y, origin.y + size(parent).height - 220))
    : b.y;
  const downstream = new Set([target.id]);
  for (const id of downstream)
    for (const edge of workflow.edges) if (edge.source === id) downstream.add(edge.target);
  const obstacles = workflow.nodes
    .filter(
      (node) =>
        node.id !== source.parentId &&
        !downstream.has(node.id) &&
        (!node.parentId || node.parentId === source.parentId),
    )
    .map((node) => ({ ...canvasPosition(node, workflow), ...size(node) }))
    .filter((box) => y < box.y + box.height + LAYOUT_GAP && y + 220 + LAYOUT_GAP > box.y);
  const center = (left + right) / 2;
  // Try every free interval boundary as well as the preferred midpoint. This
  // uses a gap before a fixed obstacle instead of needlessly pushing the tail.
  const candidates = [
    center,
    left,
    right,
    ...obstacles.flatMap((box) => [box.x - 248 - LAYOUT_GAP, box.x + box.width + LAYOUT_GAP]),
  ]
    .filter(
      (x) =>
        x >= left &&
        x <= right &&
        obstacles.every(
          (box) => x >= box.x + box.width + LAYOUT_GAP || x + 248 + LAYOUT_GAP <= box.x,
        ),
    )
    .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
  return { x: (candidates[0] ?? left) - origin.x, y: y - origin.y };
}
