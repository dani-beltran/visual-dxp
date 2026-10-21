import { BaseEdge, type EdgeProps, useStore } from '@xyflow/react';
import { useMemo } from 'react';
import {
  dimensions,
  type GeometryNode,
  type Point,
  routeEdges,
  svgPath,
} from '../../lib/workflowGeometry';

// Edges share one routing pass per geometry revision. Nothing is persisted in
// workflow metadata, so replay, undo, dragging and measurement cannot retain a
// stale path. Read actual handle bounds, including React Flow's socket radius.
let cachedKey = '';
let cachedRoutes = new Map<string, Point[]>();
export function WorkflowEdge(props: EdgeProps) {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const lookup = useStore((state) => state.nodeLookup);
  const paths = useMemo(() => {
    const ports = new Map<string, { start: Point; end: Point }>();

    for (const edge of edges) {
      const source = lookup.get(edge.source),
        target = lookup.get(edge.target);
      const sh = source?.internals.handleBounds?.source?.find(
        (h) => (h.id ?? null) === (edge.sourceHandle ?? null),
      );
      const th = target?.internals.handleBounds?.target?.[0];
      if (!source || !target || !sh || !th) continue;
      ports.set(edge.id, {
        start: {
          x: source.internals.positionAbsolute.x + sh.x + sh.width,
          y: source.internals.positionAbsolute.y + sh.y + sh.height / 2,
        },
        end: {
          x: target.internals.positionAbsolute.x + th.x,
          y: target.internals.positionAbsolute.y + th.y + th.height / 2,
        },
      });
    }
    if (!ports.has(props.id))
      ports.set(props.id, {
        start: { x: props.sourceX, y: props.sourceY },
        end: { x: props.targetX, y: props.targetY },
      });
    const key = JSON.stringify([
      nodes.map((n) => [
        n.id,
        n.position,
        n.parentId,
        n.width,
        n.height,
        n.measured,
        n.data.kind,
        dimensions(n as GeometryNode),
      ]),
      edges.map((e) => [e.id, e.source, e.target, e.sourceHandle]),
      [...ports],
    ]);
    if (key !== cachedKey) {
      cachedRoutes = routeEdges(nodes as GeometryNode[], edges, ports);
      cachedKey = key;
    }
    return cachedRoutes;
  }, [nodes, edges, lookup, props.id, props.sourceX, props.sourceY, props.targetX, props.targetY]);
  const points = paths.get(props.id);
  // A manually dragged invalid graph may have no route. Show a dashed direct
  // connection as an explicit invalid state; AI finalization rejects it.
  const path = points
    ? svgPath(points)
    : `M ${props.sourceX} ${props.sourceY} L ${props.targetX} ${props.targetY}`;
  let midpoint = { x: (props.sourceX + props.targetX) / 2, y: (props.sourceY + props.targetY) / 2 };
  if (points) {
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i]) {
        const fraction = lengths[i] ? remaining / lengths[i] : 0;
        midpoint = {
          x: points[i].x + (points[i + 1].x - points[i].x) * fraction,
          y: points[i].y + (points[i + 1].y - points[i].y) * fraction,
        };
        break;
      }
      remaining -= lengths[i];
    }
  }
  return (
    <BaseEdge
      id={props.id}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
      label={props.label}
      labelStyle={props.labelStyle}
      labelShowBg={props.labelShowBg}
      labelBgStyle={props.labelBgStyle}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
      path={path}
      labelX={midpoint.x}
      labelY={midpoint.y}
      style={{ ...props.style, ...(!points ? { strokeDasharray: '5 5' } : {}) }}
    />
  );
}
