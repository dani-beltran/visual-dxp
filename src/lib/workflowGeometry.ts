import { FRAME_HEADER_HEIGHT } from './frames';

/** Shared by the canvas renderer and the AI layout validator. No stored route cache. */
export interface Point {
  x: number;
  y: number;
}
export interface GeometryNode {
  id: string;
  position: Point;
  parentId?: string;
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  data: { kind: string; label: string };
}
export interface GeometryEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}
export interface Box extends Point {
  width: number;
  height: number;
}
export const BRANCH_PORTS = { first: 0.38, second: 0.68 };
export function dimensions(node: GeometryNode) {
  return {
    width: node.width ?? node.measured?.width ?? (node.data.kind === 'frame' ? 560 : 248),
    height:
      node.height ??
      node.measured?.height ??
      (node.data.kind === 'frame'
        ? 360
        : Math.max(220, 180 + Math.ceil(node.data.label.length / 22) * 20)),
  };
}
export function nodeBox(node: GeometryNode, nodes: GeometryNode[]): Box {
  const parent = nodes.find((item) => item.id === node.parentId);
  return {
    x: node.position.x + (parent?.position.x ?? 0),
    y: node.position.y + (parent?.position.y ?? 0),
    ...dimensions(node),
  };
}
export function branchOrder(handle?: string | null) {
  return ['false', 'b', 'done'].includes(handle ?? '') ? 1 : 0;
}
export function sourcePort(node: GeometryNode, edge: GeometryEdge, nodes: GeometryNode[]) {
  const box = nodeBox(node, nodes);
  const split = ['fork', 'experiment', 'loop'].includes(node.data.kind);
  const fraction = split
    ? branchOrder(edge.sourceHandle)
      ? BRANCH_PORTS.second
      : BRANCH_PORTS.first
    : 0.5;
  // WorkflowCard has a 1px border and 9px sockets. React Flow attaches
  // to the outer socket edge, rather than to its center or the card border.
  return { x: box.x + box.width + 4.5, y: box.y + 1 + (box.height - 2) * fraction };
}
export function targetPort(node: GeometryNode, nodes: GeometryNode[]) {
  const box = nodeBox(node, nodes);
  return { x: box.x - 4.5, y: box.y + box.height / 2 };
}

export function segmentHitsBox(a: Point, b: Point, box: Box, padding = 0) {
  const left = box.x - padding,
    right = box.x + box.width + padding;
  const top = box.y - padding,
    bottom = box.y + box.height + padding;
  if (a.x === b.x)
    return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
  if (a.y === b.y)
    return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
  return true; // Only orthogonal segments are supported.
}
export function pathHitsBox(points: Point[], box: Box, padding = 0) {
  return points.slice(1).some((b, i) => segmentHitsBox(points[i], b, box, padding));
}
/** Positive overlap, crossing or T intersection, including compressed-grid boundaries. */
export function segmentInterference(a: Point, b: Point, c: Point, d: Point) {
  const horizontal = a.y === b.y;
  if (horizontal === (c.y === d.y)) {
    if (horizontal ? a.y !== c.y : a.x !== c.x) return 0;
    const key = horizontal ? 'x' : 'y';
    return Math.max(
      0,
      Math.min(Math.max(a[key], b[key]), Math.max(c[key], d[key])) -
        Math.max(Math.min(a[key], b[key]), Math.min(c[key], d[key])),
    ) > 0
      ? 2
      : 0;
  }
  if (!horizontal) return segmentInterference(c, d, a, b);
  return c.x >= Math.min(a.x, b.x) &&
    c.x <= Math.max(a.x, b.x) &&
    a.y >= Math.min(c.y, d.y) &&
    a.y <= Math.max(c.y, d.y)
    ? 1
    : 0;
}
export function svgPath(points: Point[]) {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}

/** Coordinate-compressed orthogonal search. Penalizes bends, crossings and shared segments.
 * Source/target stubs preserve right/left handle directions. Frames containing an
 * endpoint are containers, other frames and notes are solid obstacles.
 */
export function routeEdges(
  nodes: GeometryNode[],
  edges: GeometryEdge[],
  ports?: Map<string, { start: Point; end: Point }>,
) {
  const routes = new Map<string, Point[]>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const boxes = new Map(nodes.map((node) => [node.id, nodeBox(node, nodes)]));
  const sorted = [...edges].sort((a, b) => {
    const sa = byId.get(a.source),
      sb = byId.get(b.source);
    return (
      (sa && sb
        ? boxes.get(sa.id)!.x - boxes.get(sb.id)!.x || boxes.get(sa.id)!.y - boxes.get(sb.id)!.y
        : 0) ||
      branchOrder(a.sourceHandle) - branchOrder(b.sourceHandle) ||
      a.id.localeCompare(b.id)
    );
  });
  for (const edge of sorted) {
    const source = byId.get(edge.source),
      target = byId.get(edge.target);
    if (!source || !target) continue;
    const start = ports?.get(edge.id)?.start ?? sourcePort(source, edge, nodes);
    const end = ports?.get(edge.id)?.end ?? targetPort(target, nodes);
    const a = { x: start.x + 18, y: start.y },
      b = { x: end.x - 18, y: end.y };
    const obstacles = nodes
      .filter((n) => n.id !== source.parentId && n.id !== target.parentId)
      .map((n) => ({ id: n.id, ...boxes.get(n.id)! }));
    const unrelated = obstacles.filter((n) => n.id !== source.id && n.id !== target.id);
    if (unrelated.some((box) => segmentHitsBox(start, a, box, 8) || segmentHitsBox(b, end, box, 8)))
      continue;
    const parent =
      source.parentId && source.parentId === target.parentId
        ? byId.get(source.parentId)
        : undefined;
    const frame = parent ? boxes.get(parent.id) : undefined;
    const xs = [
      ...new Set([
        a.x,
        b.x,
        (a.x + b.x) / 2,
        ...obstacles.flatMap((o) => [o.x - 12, o.x + o.width + 12]),
      ]),
    ]
      .filter((x) => !frame || (x >= frame.x && x <= frame.x + frame.width))
      .sort((x, y) => x - y);
    const ys = [
      ...new Set([a.y, b.y, ...obstacles.flatMap((o) => [o.y - 12, o.y + o.height + 12])]),
    ]
      .filter((y) => !frame || (y >= frame.y + FRAME_HEADER_HEIGHT && y <= frame.y + frame.height))
      .sort((x, y) => x - y);
    const startX = xs.indexOf(a.x),
      startY = ys.indexOf(a.y),
      endX = xs.indexOf(b.x),
      endY = ys.indexOf(b.y);
    if ([startX, startY, endX, endY].some((index) => index < 0)) continue;
    type State = {
      x: number;
      y: number;
      dir: number;
      cost: number;
      estimate: number;
      prev?: State;
    };
    // Binary heap keeps searches bounded even on large canvases.
    const queue: State[] = [];
    const push = (s: State) => {
      queue.push(s);
      let i = queue.length - 1;
      while (i) {
        const p = (i - 1) >> 1;
        if (queue[p].estimate <= s.estimate) break;
        queue[i] = queue[p];
        i = p;
      }
      queue[i] = s;
    };
    const pop = () => {
      const first = queue[0],
        last = queue.pop()!;
      if (queue.length) {
        let i = 0;
        while (i * 2 + 1 < queue.length) {
          let c = i * 2 + 1;
          if (c + 1 < queue.length && queue[c + 1].estimate < queue[c].estimate) c++;
          if (last.estimate <= queue[c].estimate) break;
          queue[i] = queue[c];
          i = c;
        }
        queue[i] = last;
      }
      return first;
    };
    const best = new Map<string, number>();
    push({ x: startX, y: startY, dir: 0, cost: 0, estimate: 0 });
    let found: State | undefined;
    for (let visits = 0; queue.length && visits < 25000; visits++) {
      const state = pop();
      const key = `${state.x},${state.y},${state.dir}`;
      if ((best.get(key) ?? Infinity) < state.cost) continue;
      if (state.x === endX && state.y === endY) {
        found = state;
        break;
      }
      const from = { x: xs[state.x], y: ys[state.y] };
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const x = state.x + dx,
          y = state.y + dy,
          dir = dx ? 0 : 1;
        if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
        const to = { x: xs[x], y: ys[y] };
        if (obstacles.some((box) => segmentHitsBox(from, to, box, 8))) continue;
        let penalty = 0;
        for (const previous of sorted) {
          const points = routes.get(previous.id);
          // A short shared stub at a common endpoint is legitimate convergence.
          if (!points) continue;
          const near = (p: Point, endpoint: Point) =>
            Math.abs(p.x - endpoint.x) + Math.abs(p.y - endpoint.y) <= 24;
          if (
            (previous.source === edge.source && near(from, start) && near(to, start)) ||
            (previous.target === edge.target && near(from, end) && near(to, end))
          )
            continue;
          for (let i = 1; i < points.length; i++)
            penalty += segmentInterference(from, to, points[i - 1], points[i]) * 500;
        }
        const cost =
          state.cost +
          Math.abs(to.x - from.x) +
          Math.abs(to.y - from.y) +
          (state.dir !== dir ? 28 : 0) +
          penalty;
        const nextKey = `${x},${y},${dir}`;
        if (cost >= (best.get(nextKey) ?? Infinity)) continue;
        best.set(nextKey, cost);
        push({
          x,
          y,
          dir,
          cost,
          estimate: cost + Math.abs(to.x - b.x) + Math.abs(to.y - b.y),
          prev: state,
        });
      }
    }
    if (!found) continue;
    const points: Point[] = [end];
    for (let s: State | undefined = found; s; s = s.prev) points.push({ x: xs[s.x], y: ys[s.y] });
    points.push(start);
    points.reverse();
    const simplified = points.filter(
      (p, i) =>
        !i ||
        i === points.length - 1 ||
        !(
          (points[i - 1].x === p.x && p.x === points[i + 1].x) ||
          (points[i - 1].y === p.y && p.y === points[i + 1].y)
        ),
    );
    routes.set(edge.id, simplified);
  }
  return routes;
}
