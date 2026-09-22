import type { Workflow, WorkflowNode } from './types';

export const FRAME_WIDTH = 560;
export const FRAME_HEIGHT = 360;
export const FRAME_MIN_WIDTH = 300;
export const FRAME_MIN_HEIGHT = 220;
export const FRAME_HEADER_HEIGHT = 44;

export function nodeSize(node: WorkflowNode) {
  const frame = node.data.kind === 'frame';
  return {
    width: node.width ?? node.measured?.width ?? (frame ? FRAME_WIDTH : 248),
    height: node.height ?? node.measured?.height ?? (frame ? FRAME_HEIGHT : 180),
  };
}

/** Frames are top-level containers; their members use positions relative to the frame. */
export function absolutePosition(node: WorkflowNode, nodes: WorkflowNode[]) {
  const parent = nodes.find((entry) => entry.id === node.parentId);
  return {
    x: node.position.x + (parent?.position.x ?? 0),
    y: node.position.y + (parent?.position.y ?? 0),
  };
}

export function framesFirst(nodes: WorkflowNode[]) {
  return [
    ...nodes.filter((node) => node.data.kind === 'frame'),
    ...nodes.filter((node) => node.data.kind !== 'frame'),
  ];
}

/** Reparent only the edited nodes, keeping their canvas positions unchanged. */
export function groupNodes(
  nodes: WorkflowNode[],
  ids: Set<string>,
  frameId?: string,
): WorkflowNode[] {
  const frames = nodes.filter(
    (node) => node.data.kind === 'frame' && (!frameId || node.id === frameId),
  );
  return framesFirst(
    nodes.map((node) => {
      if (node.data.kind === 'frame' || !ids.has(node.id)) return node;
      const position = absolutePosition(node, nodes);
      const size = nodeSize(node);
      const contains = (frame: WorkflowNode) => {
        const bounds = nodeSize(frame);
        return (
          position.x >= frame.position.x &&
          position.y >= frame.position.y + FRAME_HEADER_HEIGHT &&
          position.x + size.width <= frame.position.x + bounds.width &&
          position.y + size.height <= frame.position.y + bounds.height
        );
      };
      // Keep an existing group when frames overlap; otherwise use the smallest fit.
      const parent =
        frames.find((frame) => frame.id === node.parentId && contains(frame)) ??
        frames.filter(contains).sort((a, b) => {
          const first = nodeSize(a);
          const second = nodeSize(b);
          return first.width * first.height - second.width * second.height;
        })[0];
      if (parent?.id === node.parentId) return node;
      const { parentId: _parentId, extent: _extent, expandParent: _expandParent, ...rest } = node;
      return parent
        ? {
            ...rest,
            parentId: parent.id,
            position: { x: position.x - parent.position.x, y: position.y - parent.position.y },
          }
        : { ...rest, position };
    }),
  );
}

/** Removing a frame releases its contents without deleting them or their connections. */
export function removeNodes(nodes: WorkflowNode[], ids: Set<string>): WorkflowNode[] {
  return nodes
    .filter((node) => !ids.has(node.id))
    .map((node) => {
      if (!node.parentId || !ids.has(node.parentId)) return node;
      const { parentId: _parentId, extent: _extent, expandParent: _expandParent, ...rest } = node;
      return { ...rest, position: absolutePosition(node, nodes) };
    });
}

export function duplicateNode(workflow: Workflow, selected: WorkflowNode) {
  const originals = workflow.nodes.filter(
    (node) => node.id === selected.id || node.parentId === selected.id,
  );
  const ids = new Map(originals.map((node) => [node.id, crypto.randomUUID()]));
  const copyId = (id: string) => {
    const copy = ids.get(id);
    if (!copy) throw new Error('Cannot duplicate a missing node.');
    return copy;
  };
  const copies = originals.map((node) => {
    const copy = structuredClone(node);
    copy.id = copyId(node.id);
    copy.selected = false;
    if (node.id === selected.id) {
      const position = absolutePosition(node, workflow.nodes);
      delete copy.parentId;
      copy.position = {
        x: position.x + 40,
        y: position.y + (selected.data.kind === 'frame' ? nodeSize(selected).height + 40 : 190),
      };
      copy.data.label = `${node.data.label} copy`;
    } else {
      copy.parentId = copyId(selected.id);
    }
    return copy;
  });
  const edges = workflow.edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({
      ...structuredClone(edge),
      id: crypto.randomUUID(),
      source: copyId(edge.source),
      target: copyId(edge.target),
      selected: false,
    }));
  return {
    workflow: {
      ...workflow,
      nodes: groupNodes([...workflow.nodes, ...copies], new Set([copyId(selected.id)])),
      edges: [...workflow.edges, ...edges],
    },
    selectedId: copyId(selected.id),
  };
}
