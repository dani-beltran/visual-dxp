import { describe, expect, it } from 'vitest';
import { applyWorkflowOperations as applyClient } from '../../src/lib/ai';
import {
  branchOrder,
  dimensions,
  nodeBox,
  pathHitsBox,
  routeEdges,
  segmentInterference,
  sourcePort,
  svgPath,
} from '../../src/lib/workflowGeometry';
import { createWorkflowTools } from '../../src/server/ai/tools';
import { applyWorkflowOperations } from '../../src/server/ai/workflow/ai';
import { layoutOperations, validateGeometry } from '../../src/server/ai/workflow/layout';
import type { Workflow, WorkflowNode } from '../../src/server/ai/workflow/types';
import { diamond, multiEntryDiamond } from '../helpers/layoutWorkflow';

function arrange(workflow: Workflow) {
  return applyWorkflowOperations(
    workflow,
    layoutOperations(workflow, new Set(['split']), new Set(), { mode: 'component' }),
  );
}
function geometry(workflow: Workflow) {
  const paths = routeEdges(workflow.nodes, workflow.edges);
  expect(paths.size).toBe(workflow.edges.length);
  for (const edge of workflow.edges) {
    const points = paths.get(edge.id)!;
    expect(svgPath(points)).toMatch(/^M /);
    const source = workflow.nodes.find((n) => n.id === edge.source)!;
    expect(points[0]).toEqual(sourcePort(source, edge, workflow.nodes));
    for (const node of workflow.nodes) {
      if (
        [
          edge.source,
          edge.target,
          source.parentId,
          workflow.nodes.find((n) => n.id === edge.target)!.parentId,
        ].includes(node.id)
      )
        continue;
      expect(
        pathHitsBox(points, nodeBox(node, workflow.nodes)),
        `${edge.id} through ${node.id}`,
      ).toBe(false);
    }
  }
  validateGeometry(
    workflow,
    new Set(
      workflow.nodes.filter((n) => !['note', 'frame'].includes(n.data.kind)).map((n) => n.id),
    ),
  );
  return paths;
}
function interference(workflow: Workflow) {
  const paths = geometry(workflow);
  let crossings = 0;
  for (let i = 0; i < workflow.edges.length; i++)
    for (const b of workflow.edges.slice(i + 1)) {
      const a = workflow.edges[i];
      if (
        a.source === b.source ||
        a.target === b.target ||
        a.target === b.source ||
        b.target === a.source
      )
        continue;
      const pa = paths.get(a.id)!,
        pb = paths.get(b.id)!;
      for (let j = 1; j < pa.length; j++)
        for (let k = 1; k < pb.length; k++)
          crossings += segmentInterference(pa[j - 1], pa[j], pb[k - 1], pb[k]);
    }
  return crossings;
}

describe('Dagre component layout and rendered orthogonal paths', () => {
  it.each(['fork', 'experiment', 'loop'] as const)(
    'separates multiple entry points feeding a shared %s without losing branch order',
    (kind) => {
      const graph = multiEntryDiamond(kind);
      const placed = arrange(graph);
      geometry(placed);
      const entries = placed.nodes
        .filter((n) => n.data.kind === 'trigger')
        .sort((a, b) => a.position.y - b.position.y);
      expect(entries[0].position.y + dimensions(entries[0]).height + 72).toBeLessThanOrEqual(
        entries[1].position.y,
      );
      expect(placed.nodes.find((n) => n.id === 'z-first')!.position.y).toBeLessThan(
        placed.nodes.find((n) => n.id === 'a-second')!.position.y,
      );
      expect(
        layoutOperations(placed, new Set(['split']), new Set(), { mode: 'component' }),
      ).toEqual([]);
      graph.nodes.reverse();
      graph.edges.reverse();
      expect(Object.fromEntries(arrange(graph).nodes.map((n) => [n.id, n.position]))).toEqual(
        Object.fromEntries(placed.nodes.map((n) => [n.id, n.position])),
      );
    },
  );

  it('separates three differently sized entry points using the requested lane gap', () => {
    const graph = multiEntryDiamond();
    graph.nodes[0].width = 330;
    graph.nodes[0].height = 310;
    graph.nodes.at(-1)!.width = 200;
    graph.nodes.at(-1)!.height = 120;
    graph.nodes.push({
      ...structuredClone(graph.nodes[0]),
      id: 'third-start',
      height: 240,
      position: { x: 0, y: 1000 },
      data: { kind: 'trigger', label: 'Third start', config: { event: 'page-load' } },
    });
    graph.edges.push({ id: 'third-entry', source: 'third-start', target: 'split' });
    const options = { mode: 'component' as const, laneGap: 110 };
    const placed = applyWorkflowOperations(
      graph,
      layoutOperations(graph, new Set(['split']), new Set(), options),
    );
    geometry(placed);
    const entries = placed.nodes
      .filter((n) => n.data.kind === 'trigger')
      .sort((a, b) => a.position.y - b.position.y);
    for (let i = 1; i < entries.length; i++)
      expect(
        entries[i - 1].position.y + dimensions(entries[i - 1]).height + 110,
      ).toBeLessThanOrEqual(entries[i].position.y);
    expect(layoutOperations(placed, new Set(['split']), new Set(), options)).toEqual([]);
  });

  it('finalizes explicit and automatic multi-entry arrangements as stable replayable transactions', () => {
    for (const explicit of [true, false]) {
      const graph = multiEntryDiamond();
      if (!explicit) graph.edges = graph.edges.filter((e) => e.id !== 'second-entry');
      const tools = createWorkflowTools(graph, []);
      const result = explicit
        ? tools.invokePrivate('arrange_workflow', { scope: 'components', nodeIds: ['split'] })
        : tools.invokePrivate('add_connection', { source: 'second-start', target: 'split' });
      expect(JSON.parse(result).ok).toBe(true);
      tools.finalizeLayout();
      geometry(tools.getWorkflow());
      const batch = tools.getOperations();
      expect(applyClient(graph, batch)).toEqual(tools.getWorkflow());
      expect(applyWorkflowOperations(graph, batch)).toEqual(tools.getWorkflow());
      tools.finalizeLayout();
      expect(tools.getOperations()).toEqual(batch);
    }
  });

  it.each(['fork', 'experiment', 'loop'] as const)(
    'separates %s lanes in semantic order and converges downstream',
    (kind) => {
      const placed = arrange(diamond(kind));
      const first = placed.nodes.find((n) => n.id === 'z-first')!,
        second = placed.nodes.find((n) => n.id === 'a-second')!,
        join = placed.nodes.find((n) => n.id === 'join')!;
      expect(first.position.y + dimensions(first).height).toBeLessThan(second.position.y);
      expect(join.position.x).toBeGreaterThan(
        Math.max(
          first.position.x + dimensions(first).width,
          second.position.x + dimensions(second).width,
        ),
      );
      expect(interference(placed)).toBe(0);
      expect(
        layoutOperations(placed, new Set(['split']), new Set(), { mode: 'component' }),
      ).toEqual([]);
      const reverse = diamond(kind);
      reverse.nodes.reverse();
      reverse.edges.reverse();
      expect(Object.fromEntries(arrange(reverse).nodes.map((n) => [n.id, n.position]))).toEqual(
        Object.fromEntries(placed.nodes.map((n) => [n.id, n.position])),
      );
    },
  );

  it('handles unequal lengths, skip ranks, nested forks, experiments, loops and shared joins', () => {
    const graph = diamond();
    const nested = diamond('experiment');
    nested.nodes = nested.nodes
      .filter((n) => n.id !== 'start')
      .map((n) => ({ ...n, id: `nested-${n.id}` }));
    nested.edges = nested.edges
      .filter((e) => e.source !== 'start')
      .map((e) => ({
        ...e,
        id: `nested-${e.id}`,
        source: `nested-${e.source}`,
        target: `nested-${e.target}`,
      }));
    graph.nodes.push(...nested.nodes);
    graph.edges.find((e) => e.id === 'first-join')!.target = 'nested-split';
    graph.edges.push(...nested.edges, { id: 'skip', source: 'nested-join', target: 'join' });
    graph.nodes.find((n) => n.id === 'a-second')!.data = {
      kind: 'loop',
      label: 'Loop',
      config: { iterations: 3 },
    };
    graph.edges.find((e) => e.id === 'second-join')!.sourceHandle = 'done';
    graph.edges.push({ id: 'body', source: 'a-second', target: 'join', sourceHandle: 'body' });
    const placed = arrange(graph);
    expect(interference(placed)).toBe(0);
    expect(placed.nodes.find((n) => n.id === 'nested-z-first')!.position.y).toBeLessThan(
      placed.nodes.find((n) => n.id === 'nested-a-second')!.position.y,
    );
    expect(layoutOperations(placed, new Set(['split']), new Set(), { mode: 'component' })).toEqual(
      [],
    );
  });

  it('routes a long skip edge around intervening nodes and notes using actual socket positions', () => {
    const graph = arrange(diamond());
    graph.nodes.push({
      id: 'note',
      type: 'workflow',
      position: { x: 650, y: 1200 },
      width: 300,
      height: 250,
      data: { kind: 'note', label: 'Note', config: {} },
    });
    graph.edges.push({ id: 'long', source: 'start', target: 'join' });
    const paths = geometry(graph);
    expect(paths.get('long')!.length).toBeGreaterThan(2);
    const source = graph.nodes[0],
      target = graph.nodes.at(-2)!;
    const start = {
      x: nodeBox(source, graph.nodes).x + dimensions(source).width + 5.5,
      y: source.position.y + 113,
    };
    const end = { x: target.position.x - 5.5, y: target.position.y + 117 };
    const actual = routeEdges(graph.nodes, graph.edges, new Map([['long', { start, end }]])).get(
      'long',
    )!;
    expect(actual[0]).toEqual(start);
    expect(actual.at(-1)).toEqual(end);
    for (const n of graph.nodes.filter((n) => !['start', 'join'].includes(n.id)))
      expect(pathHitsBox(actual, nodeBox(n, graph.nodes))).toBe(false);
  });

  it('uses measured sizes and reroutes when nodes resize without moving the graph', () => {
    const graph = diamond();
    graph.nodes[2].width = 430;
    graph.nodes[2].height = 310;
    graph.nodes[3].width = 200;
    graph.nodes[3].height = 120;
    const placed = arrange(graph);
    const positions = placed.nodes.map((n) => n.position);
    geometry(placed);
    const before = routeEdges(placed.nodes, placed.edges);
    placed.nodes[1].height = 260;
    const after = routeEdges(placed.nodes, placed.edges);
    expect(after.get('first')).not.toEqual(before.get('first'));
    expect(placed.nodes.map((n) => n.position)).toEqual(positions);
    geometry(placed);
  });

  it('keeps unrelated components and notes fixed as obstacles', () => {
    const graph = diamond();
    const note: WorkflowNode = {
      ...graph.nodes[2],
      id: 'note',
      position: { x: 500, y: 220 },
      data: { kind: 'note', label: 'Obstacle', config: {} },
    };
    graph.nodes.push(note, { ...graph.nodes[2], id: 'unrelated', position: { x: -500, y: 220 } });
    const placed = arrange(graph);
    expect(placed.nodes.find((n) => n.id === 'note')).toEqual(note);
    expect(placed.nodes.find((n) => n.id === 'unrelated')!.position).toEqual({ x: -500, y: 220 });
    geometry(placed);
  });

  it('preserves pins, rejects incompatible pins atomically, and never restores them over invalid geometry', () => {
    const graph = diamond();
    const tools = createWorkflowTools(graph, []);
    tools.invokePrivate('update_node', { id: 'start', position: { x: 50, y: 700 } });
    expect(
      JSON.parse(
        tools.invokePrivate('arrange_workflow', { scope: 'components', nodeIds: ['split'] }),
      ).ok,
    ).toBe(true);
    tools.finalizeLayout();
    expect(tools.getWorkflow().nodes.find((n) => n.id === 'start')!.position).toEqual({
      x: 50,
      y: 700,
    });
    geometry(tools.getWorkflow());
    const bad = createWorkflowTools(graph, []);
    bad.invokePrivate('update_node', { id: 'z-first', position: { x: 20, y: 220 } });
    bad.invokePrivate('update_node', { id: 'a-second', position: { x: 30, y: 220 } });
    const before = bad.getWorkflow(),
      operations = bad.getOperations();
    expect(JSON.parse(bad.invokePrivate('arrange_workflow', { scope: 'workflow' })).ok).toBe(false);
    expect(bad.getWorkflow()).toEqual(before);
    expect(bad.getOperations()).toEqual(operations);
  });

  it('respects frame membership, rejects overflow and cross-frame arrangement atomically', () => {
    const graph = diamond();
    const frame: WorkflowNode = {
      id: 'frame',
      type: 'workflow',
      position: { x: 100, y: 100 },
      width: 2400,
      height: 1400,
      data: { kind: 'frame', label: 'Frame', config: {} },
    };
    graph.nodes.forEach((n) => {
      n.parentId = frame.id;
      n.position.y = 80;
    });
    graph.nodes.unshift(frame);
    const placed = arrange(graph);
    expect(placed.nodes[0]).toEqual(frame);
    expect(placed.nodes.slice(1).every((n) => n.parentId === frame.id)).toBe(true);
    geometry(placed);
    const before = structuredClone(graph);
    graph.nodes[0].width = 500;
    expect(() => arrange(graph)).toThrow(/Insufficient space in frame/);
    expect(graph.nodes[1]).toEqual(before.nodes[1]);
    graph.nodes[0].width = 2400;
    delete graph.nodes[2].parentId;
    expect(() => arrange(graph)).toThrow(/across frame boundaries/);
  });

  it('arranges generated workflows at finalization and replays one stable transaction on client/server', () => {
    const empty: Workflow = { version: 1, name: 'Generated', websiteUrl: '', nodes: [], edges: [] };
    const tools = createWorkflowTools(empty, []);
    const ids = new Map<string, string>();
    for (const node of diamond().nodes) {
      const result = JSON.parse(
        tools.invokePrivate('add_node', {
          kind: node.data.kind,
          label: node.data.label,
          config: node.data.config,
        }),
      );
      expect(result.ok).toBe(true);
      ids.set(node.id, result.node.id);
    }
    for (const edge of diamond().edges)
      expect(
        JSON.parse(
          tools.invokePrivate('add_connection', {
            source: ids.get(edge.source),
            target: ids.get(edge.target),
            sourceHandle: edge.sourceHandle,
          }),
        ).ok,
      ).toBe(true);
    tools.finalizeLayout();
    geometry(tools.getWorkflow());
    const batch = tools.getOperations();
    expect(applyClient(empty, batch)).toEqual(tools.getWorkflow());
    expect(applyWorkflowOperations(empty, batch)).toEqual(tools.getWorkflow());
    tools.finalizeLayout();
    expect(tools.getOperations()).toEqual(batch);
    const final = tools.getWorkflow();
    tools.invokePrivate('update_node', { id: ids.get('z-first'), label: 'Small edit' });
    tools.finalizeLayout();
    expect(tools.getWorkflow().nodes.map((n) => n.position)).toEqual(
      final.nodes.map((n) => n.position),
    );
  });

  it('enforces operation limits before publishing an explicit arrangement', () => {
    const tools = createWorkflowTools(diamond(), []);
    for (let i = 0; i < 98; i++)
      tools.invokePrivate('update_node', { id: 'start', label: `Start ${i}` });
    const before = tools.getWorkflow(),
      operations = tools.getOperations();
    expect(JSON.parse(tools.invokePrivate('arrange_workflow', { scope: 'workflow' })).ok).toBe(
      false,
    );
    expect(tools.getWorkflow()).toEqual(before);
    expect(tools.getOperations()).toEqual(operations);
  });

  it('supports separate disconnected components with stable spacing and rejects invalid spacing', () => {
    const graph = diamond();
    graph.nodes.push({ ...graph.nodes[0], id: 'separate', position: { x: -500, y: 1000 } });
    const tools = createWorkflowTools(graph, []);
    expect(
      JSON.parse(
        tools.invokePrivate('arrange_workflow', { scope: 'workflow', rankGap: 120, laneGap: 100 }),
      ).ok,
    ).toBe(true);
    tools.finalizeLayout();
    geometry(tools.getWorkflow());
    const before = tools.getOperations();
    tools.finalizeLayout();
    expect(tools.getOperations()).toEqual(before);
    expect(() =>
      layoutOperations(graph, new Set(['split']), new Set(), { mode: 'component', rankGap: 1 }),
    ).toThrow(/spacing/);
    expect(branchOrder('true')).toBeLessThan(branchOrder('false'));
  });
  it('rolls back finalization if derived moves exceed the complete transaction budget', () => {
    const graph = diamond();
    graph.edges = graph.edges.filter((e) => e.id !== 'first-join');
    const tools = createWorkflowTools(graph, []);
    for (let i = 0; i < 98; i++)
      tools.invokePrivate('update_node', { id: 'start', label: `Start ${i}` });
    tools.invokePrivate('add_connection', { source: 'z-first', target: 'join' });
    const before = tools.getWorkflow(),
      operations = tools.getOperations();
    expect(() => tools.finalizeLayout()).toThrow(/100/);
    expect(tools.getWorkflow()).toEqual(before);
    expect(tools.getOperations()).toEqual(operations);
  });

  it('fails finalization without publishing any moves when staged pins conflict', () => {
    const graph = diamond();
    graph.edges = graph.edges.filter((e) => e.id !== 'first-join');
    const tools = createWorkflowTools(graph, []);
    tools.invokePrivate('update_node', { id: 'z-first', position: { x: 30, y: 220 } });
    tools.invokePrivate('update_node', { id: 'a-second', position: { x: 40, y: 220 } });
    tools.invokePrivate('add_connection', { source: 'z-first', target: 'join' });
    const before = tools.getWorkflow(),
      operations = tools.getOperations();
    expect(() => tools.finalizeLayout()).toThrow(/Explicitly positioned/);
    expect(tools.getWorkflow()).toEqual(before);
    expect(tools.getOperations()).toEqual(operations);
  });

  it('is stable with fractional measurements, long new labels and different UUIDs', () => {
    const graph = diamond();
    graph.nodes[2].width = 225.37;
    graph.nodes[2].height = 267.125;
    graph.nodes[3].data.label = 'A long generated branch label '.repeat(6);
    const placed = arrange(graph);
    geometry(placed);
    expect(layoutOperations(placed, new Set(['split']), new Set(), { mode: 'component' })).toEqual(
      [],
    );
    const renamed = structuredClone(graph);
    const ids = new Map(renamed.nodes.map((n, i) => [n.id, `uuid-${10 - i}`]));
    renamed.nodes.forEach((n) => {
      n.id = ids.get(n.id)!;
    });
    renamed.edges.forEach((e, i) => {
      e.id = `random-${20 - i}`;
      e.source = ids.get(e.source)!;
      e.target = ids.get(e.target)!;
    });
    const other = applyWorkflowOperations(
      renamed,
      layoutOperations(renamed, new Set([ids.get('split')!]), new Set(), { mode: 'component' }),
    );
    expect(other.nodes.map((n) => n.position)).toEqual(placed.nodes.map((n) => n.position));
  });
  it('routes around a pinned note on the direct path without moving any nodes', () => {
    const graph = diamond();
    graph.nodes = [
      graph.nodes[0],
      { ...graph.nodes[4], position: { x: 1100, y: 220 } },
      {
        id: 'note',
        type: 'workflow',
        position: { x: 500, y: 250 },
        width: 250,
        height: 250,
        data: { kind: 'note', label: 'Obstacle', config: {} },
      },
    ];
    graph.edges = [{ id: 'skip-note', source: 'start', target: 'join' }];
    const before = structuredClone(graph);
    const path = geometry(graph).get('skip-note')!;
    expect(path.length).toBeGreaterThan(4);
    expect(pathHitsBox(path, nodeBox(graph.nodes[2], graph.nodes), 6)).toBe(false);
    expect(graph).toEqual(before);
  });

  it.each(['fork', 'loop'] as const)(
    'supports a %s output that skips directly to the shared join',
    (kind) => {
      const graph = diamond(kind);
      graph.nodes = graph.nodes.filter((n) => n.id !== 'a-second');
      graph.edges = graph.edges.filter((e) => e.id !== 'second-join');
      graph.edges.find((e) => e.id === 'second')!.target = 'join';
      const placed = arrange(graph);
      expect(interference(placed)).toBe(0);
      expect(placed.nodes.find((n) => n.id === 'join')!.position.x).toBeGreaterThan(
        placed.nodes.find((n) => n.id === 'z-first')!.position.x,
      );
    },
  );

  it('keeps multiple successors on one output in distinct lanes until their join', () => {
    const graph = diamond();
    graph.nodes[1].data = { kind: 'delay', label: 'Fan out', config: { duration: 10 } };
    graph.edges.forEach((edge) => {
      delete edge.sourceHandle;
    });
    const placed = arrange(graph);
    expect(interference(placed)).toBe(0);
    const first = placed.nodes.find((n) => n.id === 'z-first')!,
      second = placed.nodes.find((n) => n.id === 'a-second')!;
    expect(Math.abs(first.position.y - second.position.y)).toBeGreaterThanOrEqual(292);
  });
  it('validates explicit position edits even when no structural layout was requested', () => {
    const graph = arrange(diamond());
    const tools = createWorkflowTools(graph, []);
    tools.invokePrivate('update_node', {
      id: 'z-first',
      position: graph.nodes.find((n) => n.id === 'a-second')!.position,
    });
    const before = tools.getWorkflow(),
      operations = tools.getOperations();
    expect(() => tools.finalizeLayout()).toThrow(/overlaps obstacle/);
    expect(tools.getWorkflow()).toEqual(before);
    expect(tools.getOperations()).toEqual(operations);
  });
});
