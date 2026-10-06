import { describe, expect, it } from 'vitest';
import {
  applyWorkflowOperations as applyClient,
  parseAIChatRequest as clientRequest,
} from '../../src/lib/ai';
import { createWorkflowTools } from '../../src/server/ai/tools';
import { applyWorkflowOperations, parseAIChatRequest } from '../../src/server/ai/workflow/ai';
import { layoutOperations } from '../../src/server/ai/workflow/layout';
import type { Workflow, WorkflowNode } from '../../src/server/ai/workflow/types';

function node(id: string, x: number, y = 0): WorkflowNode {
  return {
    id,
    type: 'workflow',
    position: { x, y },
    data: { kind: 'delay', label: id, config: { duration: 10 } },
  };
}
function graph(xs = [0, 300, 600]): Workflow {
  return {
    version: 1,
    name: 'Layout',
    websiteUrl: '',
    nodes: xs.map((x, i) => node(String(i), x)),
    edges: xs.slice(1).map((_, i) => ({ id: `e${i}`, source: String(i), target: String(i + 1) })),
  };
}
function insert(workflow: Workflow, args: Record<string, unknown> = {}) {
  const tools = createWorkflowTools(workflow, []);
  const result = JSON.parse(
    tools.invokePrivate('insert_node', { connectionId: 'e0', kind: 'delay', ...args }),
  );
  return { tools, result, draft: tools.getWorkflow() };
}
const at = (workflow: Workflow, id: string) => workflow.nodes.find((n) => n.id === id)!.position;

describe('local atomic insertion layout', () => {
  it('uses existing space and preserves unrelated positions and edge metadata through replay', () => {
    const workflow = graph([0, 1000]);
    workflow.nodes.push(node('unrelated', -200, 700));
    workflow.edges[0].label = 'Keep';
    workflow.edges[0].data = { custom: { value: 7 } };
    const { tools, result, draft } = insert(workflow);
    expect(result.ok).toBe(true);
    expect(result.node.position).toEqual({ x: 500, y: 0 });
    expect(at(draft, '0')).toEqual(at(workflow, '0'));
    expect(at(draft, '1')).toEqual(at(workflow, '1'));
    expect(at(draft, 'unrelated')).toEqual(at(workflow, 'unrelated'));
    expect(draft.edges[0]).toEqual({ ...workflow.edges[0], target: result.node.id });
    expect(applyWorkflowOperations(workflow, tools.getOperations())).toEqual(draft);
    expect(applyClient(workflow, tools.getOperations())).toEqual(draft);
    expect(workflow.nodes).toHaveLength(3);
  });

  it('shifts a crowded chain only by the missing clearance and is idempotent', () => {
    const { tools, result, draft } = insert(graph());
    expect(result.ok).toBe(true);
    expect(result.node.position.x).toBe(300);
    expect(at(draft, '1').x).toBe(600);
    expect(at(draft, '2').x).toBe(900);
    expect(layoutOperations(draft, new Set([result.node.id]))).toEqual([]);
    const operations = tools.getOperations();
    tools.finalizeLayout();
    tools.finalizeLayout();
    expect(tools.getOperations()).toEqual(operations);
  });

  it.each([
    ['fork', 'true'],
    ['experiment', 'b'],
    ['loop', 'body'],
  ] as const)('preserves %s branch handle', (kind, handle) => {
    const workflow = graph([0, 800]);
    workflow.nodes[0].data = {
      kind,
      label: kind,
      config:
        kind === 'fork'
          ? { conditionType: 'device', conditionValue: 'mobile' }
          : kind === 'loop'
            ? { iterations: 2 }
            : {},
    };
    workflow.edges[0].sourceHandle = handle;
    const { result, draft } = insert(workflow);
    expect(result.ok).toBe(true);
    expect(draft.edges[0].sourceHandle).toBe(handle);
    expect(draft.edges[1].sourceHandle).toBeUndefined();
  });

  it('moves a shared join once, accounts for every incoming predecessor, and leaves the other branch fixed', () => {
    const workflow = graph();
    workflow.nodes.push(node('other', 800, 400), node('end', 1200));
    workflow.edges.push(
      { id: 'join', source: 'other', target: '2' },
      { id: 'end', source: '2', target: 'end' },
    );
    const { result, draft } = insert(workflow);
    expect(result.ok).toBe(true);
    expect(at(draft, '2').x).toBe(1100);
    expect(at(draft, 'end').x).toBe(1400);
    expect(at(draft, 'other')).toEqual(at(workflow, 'other'));
  });

  it('treats unrelated nodes as obstacles without moving them', () => {
    const workflow = graph([0, 1000]);
    workflow.nodes.push(node('obstacle', 500));
    const { result, draft } = insert(workflow);
    expect(result.ok).toBe(true);
    expect(result.node.position.x).toBe(800);
    expect(at(draft, '1').x).toBe(1100);
    expect(at(draft, 'obstacle').x).toBe(500);
  });

  it('uses dimensions and frame-relative coordinates without changing membership', () => {
    const workflow = graph([20, 800]);
    const frame = {
      ...node('frame', 1700, 900),
      width: 1500,
      height: 500,
      data: { kind: 'frame' as const, label: 'Frame', config: {} },
    };
    workflow.nodes.forEach((n) => {
      n.parentId = frame.id;
      n.position.y = 60;
    });
    workflow.nodes[0].width = 400;
    workflow.nodes.unshift(frame);
    const { result, draft } = insert(workflow);
    expect(result.ok).toBe(true);
    expect(result.node.parentId).toBe('frame');
    expect(result.node.position).toEqual({ x: 486, y: 60 });
    expect(at(draft, '0')).toEqual({ x: 20, y: 60 });
    expect(draft.nodes[0]).toEqual(frame);
  });

  it('fails atomically when a frame cannot fit the inserted node and successor', () => {
    const workflow = graph([0, 300]);
    workflow.nodes.forEach((n) => {
      n.parentId = 'frame';
      n.position.y = 60;
    });
    workflow.nodes.unshift({
      ...node('frame', 100, 200),
      width: 600,
      height: 300,
      data: { kind: 'frame', label: '', config: {} },
    });
    const { tools, result, draft } = insert(workflow);
    expect(result).toMatchObject({ ok: false, code: 'layout_conflict' });
    expect(result.error).toContain('Insufficient space in frame');
    expect(draft).toEqual(workflow);
    expect(tools.getOperations()).toEqual([]);
  });

  it('handles cross-frame edges in absolute coordinates and inherits the predecessor frame', () => {
    const workflow = graph([0, 0]);
    const frame = (id: string, x: number) => ({
      ...node(id, x, 500),
      width: 1000,
      height: 400,
      data: { kind: 'frame' as const, label: id, config: {} },
    });
    workflow.nodes[0].parentId = 'left';
    workflow.nodes[1].parentId = 'right';
    workflow.nodes.forEach((n) => {
      n.position.y = 60;
    });
    workflow.nodes.unshift(frame('left', 100), frame('right', 1200));
    const { result, draft } = insert(workflow);
    expect(result.ok).toBe(true);
    expect(result.node.parentId).toBe('left');
    expect(result.node.position).toEqual({ x: 526, y: 60 });
    expect(at(draft, '1')).toEqual({ x: 0, y: 60 });
  });

  it('honors explicit positions, and rejects conflicts without partial rewiring', () => {
    const workflow = graph([0, 1000]);
    expect(insert(workflow, { position: { x: 400, y: 0 } }).result.node.position.x).toBe(400);
    const { tools, result, draft } = insert(workflow, { position: { x: 20, y: 0 } });
    expect(result.ok).toBe(false);
    expect(draft).toEqual(workflow);
    expect(tools.getOperations()).toEqual([]);
  });

  it('rolls back configuration, missing connection, and invalid new branch failures', () => {
    for (const args of [
      { config: { duration: -1 } },
      { connectionId: 'missing' },
      { kind: 'loop', config: { iterations: 2 } },
    ]) {
      const workflow = graph();
      const { tools, result, draft } = insert(workflow, args);
      expect(result.ok).toBe(false);
      expect(draft).toEqual(workflow);
      expect(tools.getOperations()).toEqual([]);
    }
  });

  it('validates the full operation budget before staging insertion or moves', () => {
    const tools = createWorkflowTools(graph(), []);
    for (let i = 0; i < 98; i++)
      tools.invokePrivate('update_node', { id: '0', label: `Label ${i}` });
    const before = tools.getWorkflow();
    expect(
      JSON.parse(tools.invokePrivate('insert_node', { connectionId: 'e0', kind: 'delay' })).ok,
    ).toBe(false);
    expect(tools.getWorkflow()).toEqual(before);
    expect(tools.getOperations()).toHaveLength(98);
  });

  it('does not arrange label/configuration-only changes; finalizes structural rewiring once', () => {
    const tools = createWorkflowTools(graph([0, 0, 0]), []);
    tools.invokePrivate('update_node', { id: '1', label: 'Label', config: { duration: 20 } });
    tools.invokePrivate('update_connection', { id: 'e0', label: 'Label' });
    tools.finalizeLayout();
    expect(at(tools.getWorkflow(), '1').x).toBe(0);
    tools.invokePrivate('update_connection', { id: 'e0', target: '2' });
    tools.finalizeLayout();
    expect(at(tools.getWorkflow(), '2').x).toBe(300);
    const before = tools.getOperations();
    tools.finalizeLayout();
    expect(tools.getOperations()).toEqual(before);
  });

  it('preserves measured geometry and metadata across client/server request parsing', () => {
    const workflow = graph([0, 1000]);
    Object.assign(workflow.nodes[0], { measured: { width: 420, height: 240 } });
    workflow.edges[0].data = { annotation: 'preserve' };
    const request = {
      workflow,
      selectedNodeIds: [],
      messages: [{ role: 'user', content: 'Insert' }],
    };
    const parsed = parseAIChatRequest(clientRequest(request));
    expect(parsed.workflow.nodes[0]).toMatchObject({ width: 420, height: 240 });
    expect(parsed.workflow.edges[0].data).toEqual({ annotation: 'preserve' });
    expect(insert(parsed.workflow).result.node.position.x).toBe(586);
  });
});

it('uses free space before an obstacle rather than shifting a successor unnecessarily', () => {
  const workflow = graph([0, 1400]);
  workflow.nodes.push(node('obstacle', 900));
  const { result, draft } = insert(workflow);
  expect(result.ok).toBe(true);
  expect(result.node.position.x).toBe(600);
  expect(at(draft, '1').x).toBe(1400);
  expect(at(draft, 'obstacle').x).toBe(900);
});

it('respects a pinned downstream node and leaves earlier successful edits intact on failure', () => {
  const tools = createWorkflowTools(graph(), []);
  tools.invokePrivate('update_node', { id: '1', label: 'Pinned', position: { x: 300, y: 0 } });
  const before = tools.getWorkflow();
  const operations = tools.getOperations();
  const result = JSON.parse(
    tools.invokePrivate('insert_node', { connectionId: 'e0', kind: 'delay' }),
  );
  expect(result.ok).toBe(false);
  expect(tools.getWorkflow()).toEqual(before);
  expect(tools.getOperations()).toEqual(operations);
});

it('allows a branching new node with an explicit continuation handle', () => {
  const { result, draft } = insert(graph(), {
    kind: 'loop',
    config: { iterations: 2 },
    sourceHandle: 'done',
  });
  expect(result.ok).toBe(true);
  expect(draft.edges.find((edge) => edge.source === result.node.id)?.sourceHandle).toBe('done');
});

it('produces identical geometry independently of node/edge array ordering', () => {
  const workflow = graph();
  workflow.nodes.push(node('branch', 300, 400));
  workflow.edges.push(
    { id: 'branch', source: '0', target: 'branch' },
    { id: 'join', source: 'branch', target: '2' },
  );
  const seeds = new Set(['1', 'branch']);
  const reversed = {
    ...workflow,
    nodes: [...workflow.nodes].reverse(),
    edges: [...workflow.edges].reverse(),
  };
  expect(layoutOperations(reversed, seeds)).toEqual(layoutOperations(workflow, seeds));
  const placed = applyWorkflowOperations(workflow, layoutOperations(workflow, seeds));
  expect(layoutOperations(placed, seeds)).toEqual([]);
});
