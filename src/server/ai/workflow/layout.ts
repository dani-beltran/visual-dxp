import { Graph, layout } from '@dagrejs/dagre';
import { RecoverableToolError } from '../../../lib/aiToolErrors';
import { FRAME_HEADER_HEIGHT } from '../../../lib/frames';
import {
  branchOrder,
  dimensions,
  nodeBox,
  pathHitsBox,
  routeEdges,
} from '../../../lib/workflowGeometry';
import type { WorkflowOperation } from './ai';
import { layoutOperations as localLayout } from './localLayout';
import type { Workflow, WorkflowNode } from './types';

export { canvasPosition, insertionPosition, LAYOUT_GAP } from './localLayout';
export interface LayoutOptions {
  rankGap?: number;
  laneGap?: number;
  mode?: 'local' | 'component';
}
function fail(message: string): never {
  throw new RecoverableToolError(
    'layout_conflict',
    `${message} Revise the scope or explicit positions, or provide more space. Frames are never resized or reparented automatically.`,
  );
}
export function componentScope(workflow: Workflow, seeds: Set<string>) {
  const scope = new Set(
    [...seeds].filter((id) =>
      workflow.nodes.some((n) => n.id === id && !['frame', 'note'].includes(n.data.kind)),
    ),
  );
  for (const id of scope)
    for (const edge of workflow.edges) {
      if (edge.source === id) scope.add(edge.target);
      if (edge.target === id) scope.add(edge.source);
    }
  return scope;
}
const overlaps = (a: ReturnType<typeof nodeBox>, b: ReturnType<typeof nodeBox>, gap = 0) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;

/** Validate final positions, including pins, frames, notes and the renderer's paths. */
export function validateGeometry(workflow: Workflow, scope: Set<string>) {
  for (const node of workflow.nodes.filter((n) => scope.has(n.id))) {
    const box = nodeBox(node, workflow.nodes);
    const parent = workflow.nodes.find((n) => n.id === node.parentId);
    if (parent) {
      const bounds = nodeBox(parent, workflow.nodes);
      if (
        box.x < bounds.x ||
        box.y < bounds.y + FRAME_HEADER_HEIGHT ||
        box.x + box.width > bounds.x + bounds.width ||
        box.y + box.height > bounds.y + bounds.height
      )
        fail(`Insufficient space in frame "${parent.id}" for node "${node.id}".`);
    }
    for (const other of workflow.nodes) {
      if (
        other.id === node.id ||
        other.id === node.parentId ||
        (other.parentId && other.parentId !== node.parentId)
      )
        continue;
      if (overlaps(box, nodeBox(other, workflow.nodes), 8))
        fail(`Node "${node.id}" overlaps obstacle "${other.id}".`);
    }
  }
  const edges = workflow.edges.filter((e) => scope.has(e.source) || scope.has(e.target));
  const routes = routeEdges(workflow.nodes, workflow.edges);
  for (const edge of edges) {
    const path = routes.get(edge.id);
    if (!path) fail(`Cannot route connection "${edge.id}" around node obstacles.`);
    const source = workflow.nodes.find((n) => n.id === edge.source)!;
    const target = workflow.nodes.find((n) => n.id === edge.target)!;
    for (const node of workflow.nodes) {
      if ([edge.source, edge.target, source.parentId, target.parentId].includes(node.id)) continue;
      if (pathHitsBox(path, nodeBox(node, workflow.nodes), 6))
        fail(`Connection "${edge.id}" crosses node "${node.id}".`);
    }
  }
}

/** Small Dagre adapter: dimensions in, React Flow top-left positions out. */
export function dagrePositions(
  nodes: WorkflowNode[],
  edges: Workflow['edges'],
  options: LayoutOptions = {},
) {
  const rankGap = options.rankGap ?? 80,
    laneGap = options.laneGap ?? 72;
  if (![rankGap, laneGap].every((n) => Number.isFinite(n) && n >= 52 && n <= 500))
    fail('Layout spacing must be between 52 and 500 pixels.');
  const graph = new Graph({ multigraph: true });
  graph.setGraph({ rankdir: 'LR', ranksep: rankGap, nodesep: laneGap, edgesep: 24 });
  graph.setDefaultEdgeLabel(() => ({}));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Semantic traversal keys are independent of generated UUIDs. ID is only a
  // final tie-break for semantically indistinguishable nodes on the same port.
  const compare = (a: WorkflowNode, b: WorkflowNode) =>
    a.data.kind.localeCompare(b.data.kind) ||
    a.data.label.localeCompare(b.data.label) ||
    a.id.localeCompare(b.id);
  const outgoing = (id: string) =>
    edges
      .filter((e) => e.source === id)
      .sort(
        (a, b) =>
          branchOrder(a.sourceHandle) - branchOrder(b.sourceHandle) ||
          compare(byId.get(a.target)!, byId.get(b.target)!),
      );
  const order: WorkflowNode[] = [];
  const remaining = new Set(nodes.map((n) => n.id));
  const keys = new Map<string, number[]>();
  const edgePath = (edge: Workflow['edges'][number]) => {
    const key = [...(keys.get(edge.source) ?? [])];
    const outputs = outgoing(edge.source);
    if (['fork', 'experiment', 'loop'].includes(byId.get(edge.source)!.data.kind)) {
      key.push(branchOrder(edge.sourceHandle));
      const peers = outputs.filter((e) => e.sourceHandle === edge.sourceHandle);
      if (peers.length > 1) key.push(peers.findIndex((e) => e.id === edge.id));
    } else if (outputs.length > 1) key.push(outputs.findIndex((e) => e.id === edge.id));
    return key;
  };
  while (remaining.size) {
    const ready = nodes
      .filter(
        (n) =>
          remaining.has(n.id) && !edges.some((e) => e.target === n.id && remaining.has(e.source)),
      )
      .sort(compare);
    if (!ready.length) fail('Cannot arrange a circular graph.');
    for (const node of ready) {
      const inputs = edges.filter((e) => e.target === node.id).map(edgePath);
      const common = [...(inputs[0] ?? [])];
      for (const key of inputs.slice(1)) {
        let i = 0;
        while (i < common.length && common[i] === key[i]) i++;
        common.length = i;
      }
      keys.set(node.id, common);
      remaining.delete(node.id);
      order.push(node);
    }
  }
  // Stable graph insertion follows semantic paths rather than ID ordering.
  const keyCompare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  };
  order.sort((a, b) => keyCompare(keys.get(a.id)!, keys.get(b.id)!) || compare(a, b));
  for (const node of order) graph.setNode(node.id, dimensions(node));
  for (const node of order)
    for (const edge of outgoing(node.id)) graph.setEdge(edge.source, edge.target, {}, edge.id);
  layout(graph);
  const positions = new Map(
    order.map((node) => {
      const placed = graph.node(node.id),
        size = dimensions(node);
      return [node.id, { x: placed.x! - size.width / 2, y: placed.y! - size.height / 2 }];
    }),
  );
  // Dagre's crossing optimizer may reverse port order. Pack semantic lanes
  // explicitly after ranking, then verify the actual output below. Joins use
  // their incoming paths' common prefix and sit between converging lanes.
  const paths = [...keys.values(), ...edges.map(edgePath)];
  const leaves = [
    ...new Map(
      paths
        .filter(
          (path) => !paths.some((p) => p.length > path.length && path.every((v, i) => p[i] === v)),
        )
        .map((p) => [p.join('.'), p]),
    ).values(),
  ].sort(keyCompare);
  if (leaves.length > 1) {
    const stride = Math.max(...nodes.map((n) => dimensions(n).height)) + laneGap;
    for (const node of nodes) {
      const path = keys.get(node.id)!;
      const indices = leaves.flatMap((p, i) => (path.every((v, j) => p[j] === v) ? [i] : []));
      positions.get(node.id)!.y =
        ((indices[0] + indices[indices.length - 1]) / 2) * stride +
        (stride - laneGap - dimensions(node).height) / 2;
    }
  }
  for (const node of nodes) {
    const outputs = outgoing(node.id);
    const first = outputs.filter((e) => branchOrder(e.sourceHandle) === 0),
      second = outputs.filter((e) => branchOrder(e.sourceHandle) === 1);
    for (const a of first)
      for (const b of second) {
        if (
          a.target !== b.target &&
          positions.get(a.target)!.y + dimensions(byId.get(a.target)!).height / 2 >=
            positions.get(b.target)!.y + dimensions(byId.get(b.target)!).height / 2
        )
          fail(`Cannot preserve semantic branch order at "${node.id}".`);
      }
  }
  return positions;
}

export function layoutOperations(
  workflow: Workflow,
  seeds: Set<string>,
  pinned = new Set<string>(),
  options: LayoutOptions = {},
): WorkflowOperation[] {
  if (!seeds.size) return [];
  if (options.mode !== 'component') {
    const moves = localLayout(workflow, seeds, pinned);
    const affected = new Set(seeds);
    for (const id of affected)
      for (const edge of workflow.edges) if (edge.source === id) affected.add(edge.target);
    const positioned = {
      ...workflow,
      nodes: workflow.nodes.map((node) => {
        const move = moves.find((m) => m.type === 'update_node' && m.id === node.id);
        return move?.type === 'update_node' ? { ...node, position: move.position! } : node;
      }),
    };
    validateGeometry(positioned, affected);
    return moves;
  }
  const scope = componentScope(workflow, seeds);
  const groups: Set<string>[] = [];
  const unseen = new Set(scope);
  while (unseen.size) {
    const group = componentScope(workflow, new Set([unseen.values().next().value!]));
    groups.push(group);
    for (const id of group) unseen.delete(id);
  }
  if (groups.length > 1) {
    let candidate = workflow;
    const moves: WorkflowOperation[] = [];
    for (const group of groups.sort((a, b) => {
      const key = (ids: Set<string>) =>
        workflow.nodes
          .filter((n) => ids.has(n.id))
          .map((n) => `${n.data.kind}:${n.data.label}`)
          .sort()
          .join('|');
      return key(a).localeCompare(key(b));
    })) {
      const changes = layoutOperations(candidate, group, pinned, options);
      moves.push(...changes);
      candidate = {
        ...candidate,
        nodes: candidate.nodes.map((n) => {
          const change = changes.find((m) => m.type === 'update_node' && m.id === n.id);
          return change?.type === 'update_node' ? { ...n, position: change.position! } : n;
        }),
      };
    }
    return moves;
  }
  const nodes = workflow.nodes.filter((n) => scope.has(n.id));
  if (!nodes.length) return [];
  if (new Set(nodes.map((n) => n.parentId)).size > 1)
    fail(
      'Component arrangement across frame boundaries is unsupported. Use a local insertion or arrange each disconnected component separately.',
    );
  const edges = workflow.edges.filter((e) => scope.has(e.source) && scope.has(e.target));
  const positions = dagrePositions(nodes, edges, options);
  const locks = nodes.filter((n) => pinned.has(n.id));
  const anchor =
    locks[0] ??
    [...nodes].sort(
      (a, b) =>
        a.position.x - b.position.x ||
        a.position.y - b.position.y ||
        a.data.label.localeCompare(b.data.label),
    )[0];
  const parent = workflow.nodes.find((n) => n.id === anchor.parentId);
  const minX = Math.min(...[...positions.values()].map((p) => p.x));
  const minY = Math.min(...[...positions.values()].map((p) => p.y));
  let dx = anchor.position.x - positions.get(anchor.id)!.x;
  let dy = anchor.position.y - positions.get(anchor.id)!.y;
  if (!locks.length) {
    dx = Math.min(...nodes.map((n) => n.position.x)) - minX;
    dy =
      Math.max(parent ? FRAME_HEADER_HEIGHT : 0, Math.min(...nodes.map((n) => n.position.y))) -
      minY;
  }
  for (const node of locks) {
    const p = positions.get(node.id)!;
    if (
      Math.abs(p.x + dx - node.position.x) > 0.000001 ||
      Math.abs(p.y + dy - node.position.y) > 0.000001
    )
      fail(`Explicitly positioned node "${node.id}" conflicts with component arrangement.`);
  }
  const positioned = () => ({
    ...workflow,
    nodes: workflow.nodes.map((node) => {
      const p = positions.get(node.id);
      if (!p) return node;
      const round = (value: number) => Math.round(value * 100) / 100;
      return {
        ...node,
        position: pinned.has(node.id) ? node.position : { x: round(p.x + dx), y: round(p.y + dy) },
      };
    }),
  });
  // Translate the entire unpinned component past fixed obstacles. Membership
  // never changes. A frame or pin blocks this translation and fails atomically.
  if (!locks.length && !parent) {
    for (let attempt = 0; attempt <= workflow.nodes.length; attempt++) {
      const candidate = positioned();
      const obstacle = candidate.nodes.find(
        (other) =>
          !scope.has(other.id) &&
          !other.parentId &&
          candidate.nodes.some(
            (n) =>
              scope.has(n.id) &&
              overlaps(nodeBox(n, candidate.nodes), nodeBox(other, candidate.nodes), 52),
          ),
      );
      if (!obstacle) break;
      dy +=
        nodeBox(obstacle, candidate.nodes).y +
        dimensions(obstacle).height +
        72 -
        Math.min(...candidate.nodes.filter((n) => scope.has(n.id)).map((n) => n.position.y));
    }
  }
  const candidate = positioned();
  validateGeometry(candidate, scope);
  return candidate.nodes
    .filter(
      (node) =>
        scope.has(node.id) &&
        workflow.nodes.some(
          (n) =>
            n.id === node.id &&
            (n.position.x !== node.position.x || n.position.y !== node.position.y),
        ),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ type: 'update_node', id: n.id, position: n.position }));
}
