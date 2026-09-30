import { describe, expect, it } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, workflowFingerprint } from '../src/lib/ai';
import { createNode } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { absolutePosition, duplicateNode, groupNodes, removeNodes } from '../src/lib/frames';
import { isWorkflow } from '../src/lib/serialization';
import type { Workflow, WorkflowNode } from '../src/lib/types';

function fixture(): Workflow {
  const frame = {
    ...createNode('frame', { x: 100, y: 200 }),
    id: 'frame',
    width: 700,
    height: 400,
  };
  const trigger = {
    ...createNode('trigger', { x: 130, y: 270 }),
    id: 'start',
    width: 220,
    height: 160,
  };
  const delay = { ...createNode('delay', { x: 450, y: 270 }), id: 'wait', width: 220, height: 160 };
  return {
    version: 1,
    name: 'Framed workflow',
    websiteUrl: '/demo-site.html',
    nodes: [frame, trigger, delay],
    edges: [{ id: 'connection', source: 'start', target: 'wait' }],
  };
}
function get(nodes: WorkflowNode[], id: string) {
  const node = nodes.find((node) => node.id === id);
  if (!node) throw new Error(`Missing node ${id}`);
  return node;
}
function grouped(): Workflow {
  const workflow = fixture();
  return { ...workflow, nodes: groupNodes(workflow.nodes, new Set(['start', 'wait'])) };
}

describe('frame grouping', () => {
  it('groups fully contained nodes without changing their canvas positions or connections', () => {
    const original = fixture();
    const workflow = grouped();
    expect(get(workflow.nodes, 'start')).toMatchObject({
      parentId: 'frame',
      position: { x: 30, y: 70 },
    });
    expect(get(workflow.nodes, 'wait')).toMatchObject({
      parentId: 'frame',
      position: { x: 350, y: 70 },
    });
    for (const node of original.nodes) {
      expect(absolutePosition(get(workflow.nodes, node.id), workflow.nodes)).toEqual(node.position);
    }
    expect(workflow.edges).toEqual(original.edges);
  });

  it('does not capture a partial overlap, header overlap, another frame, or an unedited node', () => {
    const workflow = fixture();
    get(workflow.nodes, 'start').position.x = 0;
    get(workflow.nodes, 'wait').position.y = 205;
    workflow.nodes.push({
      ...createNode('frame', { x: 150, y: 250 }),
      id: 'inner',
      width: 320,
      height: 240,
    });
    const result = groupNodes(workflow.nodes, new Set(workflow.nodes.map((node) => node.id)));
    expect(result.every((node) => !node.parentId)).toBe(true);
    expect(groupNodes(fixture().nodes, new Set(['frame'])).every((node) => !node.parentId)).toBe(
      true,
    );
  });

  it('releases a node dragged out, keeping its absolute position, and can transfer it to another frame', () => {
    const workflow = grouped();
    get(workflow.nodes, 'wait').position = { x: 900, y: 100 };
    const released = groupNodes(workflow.nodes, new Set(['wait']));
    expect(get(released, 'wait').parentId).toBeUndefined();
    expect(get(released, 'wait').position).toEqual({ x: 1000, y: 300 });
    released.push({ ...createNode('frame', { x: 950, y: 220 }), id: 'second' });
    const transferred = groupNodes(released, new Set(['wait']));
    expect(get(transferred, 'wait')).toMatchObject({
      parentId: 'second',
      position: { x: 50, y: 80 },
    });
  });

  it('keeps membership stable in overlapping frames and uses the smallest fit for new members', () => {
    const workflow = grouped();
    const smaller = {
      ...createNode('frame', { x: 110, y: 215 }),
      id: 'small',
      width: 300,
      height: 250,
    };
    workflow.nodes.push(smaller);
    expect(get(groupNodes(workflow.nodes, new Set(['start'])), 'start').parentId).toBe('frame');
    const ungrouped = fixture();
    ungrouped.nodes.push(smaller);
    expect(get(groupNodes(ungrouped.nodes, new Set(['start'])), 'start').parentId).toBe('small');
  });

  it('creating or resizing one frame does not regroup nodes under an unrelated frame', () => {
    const workflow = fixture();
    workflow.nodes.push({ ...createNode('frame', { x: 1200, y: 200 }), id: 'other' });
    const nodes = groupNodes(workflow.nodes, new Set(['start', 'wait']), 'other');
    expect(get(nodes, 'start').parentId).toBeUndefined();
    expect(get(nodes, 'wait').parentId).toBeUndefined();
  });

  it('deletes just the frame, releasing members at their current canvas locations', () => {
    const workflow = grouped();
    get(workflow.nodes, 'frame').position = { x: 300, y: 350 };
    const result = removeNodes(workflow.nodes, new Set(['frame']));
    expect(result.map((node) => node.id)).toEqual(['start', 'wait']);
    expect(result.every((node) => !node.parentId)).toBe(true);
    expect(get(result, 'start').position).toEqual({ x: 330, y: 420 });
    expect(get(result, 'wait').position).toEqual({ x: 650, y: 420 });
  });

  it('duplicates the group and internal connections with independent IDs and data', () => {
    const original = grouped();
    const { workflow, selectedId } = duplicateNode(original, original.nodes[0]);
    const members = workflow.nodes.filter((node) => node.parentId === selectedId);
    expect(members).toHaveLength(2);
    expect(get(workflow.nodes, selectedId).data.label).toBe('Frame copy');
    expect(workflow.edges).toHaveLength(2);
    expect(workflow.edges[1]).toMatchObject({ source: members[0].id, target: members[1].id });
    members[0].data.config.selector = 'changed';
    expect(original.nodes[1].data.config.selector).not.toBe('changed');
    expect(isWorkflow(workflow)).toBe(true);
  });
});

describe('frame persistence and execution boundaries', () => {
  it('round trips named, resized frames and member positions in JSON and AI requests', () => {
    const workflow = grouped();
    workflow.nodes[0].data.label = 'Welcome audience';
    expect(isWorkflow(JSON.parse(JSON.stringify(workflow)))).toBe(true);
    const request = parseAIChatRequest({
      workflow,
      messages: [{ role: 'user', content: 'Rename the group' }],
      selectedNodeIds: ['frame'],
    });
    expect(request.workflow.nodes[0]).toMatchObject({
      width: 700,
      height: 400,
      data: { label: 'Welcome audience' },
    });
    expect(get(request.workflow.nodes, 'start')).toMatchObject({
      parentId: 'frame',
      position: { x: 30, y: 70 },
    });
    expect(workflowFingerprint(workflow)).toBe(workflowFingerprint(request.workflow));
    const edited = applyWorkflowOperations(workflow, [
      { type: 'update_node', id: 'frame', label: 'New name' },
    ]);
    expect(edited.nodes[0].data.label).toBe('New name');
    const removed = applyWorkflowOperations(edited, [{ type: 'remove_node', id: 'frame' }]);
    expect(get(removed.nodes, 'start').position).toEqual({ x: 130, y: 270 });
    expect(removed.edges).toEqual(workflow.edges);
  });

  it('rejects missing parents, non-frame parents, nested frames, and invalid dimensions', () => {
    for (const parentId of ['missing', 'wait']) {
      const workflow = grouped();
      get(workflow.nodes, 'start').parentId = parentId;
      expect(isWorkflow(workflow)).toBe(false);
    }
    const nested = grouped();
    nested.nodes[0].parentId = 'frame';
    expect(isWorkflow(nested)).toBe(false);
    const invalid = grouped();
    invalid.nodes[0].width = -1;
    expect(isWorkflow(invalid)).toBe(false);
  });

  it('omits the frame from executable scripts while retaining its workflow steps', () => {
    const workflow = grouped();
    workflow.nodes[0].data.label = 'Private frame name';
    workflow.websiteUrl = 'https://example.com/';
    expect(validateWorkflow(workflow)).toEqual([]);
    const script = exportWorkflow(workflow);
    expect(script).not.toContain('Private frame name');
    expect(script).not.toContain('parentId');
    expect(script).toContain('"id": "start"');
    expect(script).toContain('"id": "wait"');
  });

  it('rejects workflow connections to frames in validation and AI edits', () => {
    const workflow = grouped();
    const edge = { id: 'invalid', source: 'start', target: 'frame' };
    expect(validateWorkflow({ ...workflow, edges: [edge] })).toContainEqual({
      nodeId: 'frame',
      message: 'Frames cannot have workflow connections.',
    });
    expect(() => applyWorkflowOperations(workflow, [{ type: 'add_edge', edge }])).toThrow(
      'Frames cannot have workflow connections.',
    );
  });
});
