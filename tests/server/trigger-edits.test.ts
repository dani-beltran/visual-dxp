import { describe, expect, it } from 'vitest';
import {
  applyWorkflowOperations as applyClient,
  parseAIChatResponse as parseClient,
} from '../../src/lib/ai';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations as applyServer,
  parseAIChatRequest,
  parseAIChatResponse,
} from '../../src/server/ai/workflow/ai';
import type { Workflow } from '../../src/server/ai/workflow/types';

function workflow(): Workflow {
  return {
    version: 1,
    name: 'Rage click offer',
    websiteUrl: 'https://example.test',
    nodes: [
      {
        id: 'trigger',
        type: 'workflow',
        position: { x: 10, y: 20 },
        data: {
          kind: 'trigger',
          label: 'Start',
          description: 'Keep this',
          config: {
            event: 'rage-click',
            selector: '#old',
            rageClickCount: 3,
            rageClickWindow: 1000,
            rageClickRadius: 50,
          },
        },
      },
      {
        id: 'offer',
        type: 'workflow',
        position: { x: 310, y: 20 },
        data: {
          kind: 'popover',
          label: 'Offer',
          config: {
            contentType: 'html',
            content: '<p>Keep me</p>',
            position: 'center',
            width: 360,
          },
        },
      },
    ],
    edges: [{ id: 'connection', source: 'trigger', target: 'offer', label: 'Continue' }],
  };
}

// The client adds ReactFlow presentation types; these fixtures use the shared transport subset.
const applications = [
  ['server', applyServer],
  ['client', (graph: Workflow, changes: unknown) => applyClient(graph, changes) as Workflow],
] as const;

const malformed = {
  event: 'scroll-thrashing',
  selector: '',
  conditionType: 'selector',
  conditionValue: '',
  iterations: 3,
  contentType: 'html',
  content: '<p>Wrong node</p>',
  position: 'center',
  width: 360,
};

describe('AI configuration ownership', () => {
  it('exposes catalog defaults that can be passed directly to add_node', () => {
    const catalog = JSON.parse(
      createWorkflowTools(workflow(), []).invokePrivate('read_node_catalog', {}),
    );
    for (const { kind, defaults } of catalog) {
      const toolkit = createWorkflowTools(workflow(), []);
      expect(
        JSON.parse(toolkit.invokePrivate('add_node', { kind, config: defaults })),
        kind,
      ).toMatchObject({ ok: true });
    }
  });

  it.each(['add_node', 'update_node'])(
    'rejects cross-kind %s payloads without staging changes',
    (name) => {
      const original = workflow();
      const toolkit = createWorkflowTools(original, ['trigger']);
      const result = JSON.parse(
        toolkit.invokePrivate(name, {
          ...(name === 'add_node' ? { kind: 'trigger' } : { id: 'trigger' }),
          config: malformed,
        }),
      );
      expect(result.ok).toBe(false);
      for (const field of [
        'selector',
        'conditionType',
        'conditionValue',
        'iterations',
        'contentType',
        'content',
        'position',
        'width',
      ])
        expect(result.error).toContain(field);
      expect(result.error).toContain('trigger');
      expect(result.error).toContain('scroll-thrashing');
      expect(toolkit.getWorkflow()).toEqual(original);
      expect(toolkit.getOperations()).toEqual([]);
    },
  );

  it.each(applications)(
    '%s rejects new inactive and cross-kind fields, while keeping historical workflows editable',
    (_name, apply) => {
      const original = workflow();
      original.nodes[0].data.config.content = 'Historical inactive field';
      const parsed = parseAIChatRequest({
        workflow: original,
        selectedNodeIds: [],
        messages: [{ role: 'user', content: 'Rename' }],
      });
      expect(parsed.workflow.nodes[0].data.config.content).toBe('Historical inactive field');
      expect(
        apply(original, [{ type: 'update_node', id: 'trigger', label: 'Renamed' }]).nodes[0].data
          .config,
      ).toEqual(original.nodes[0].data.config);
      expect(
        apply(original, [{ type: 'update_node', id: 'trigger', config: { rageClickCount: 5 } }])
          .nodes[0].data.config,
      ).toEqual({ ...original.nodes[0].data.config, rageClickCount: 5 });
      for (const config of [
        { scrollThreshold: 60 },
        { iterations: 5 },
        { content: 'New invalid write' },
      ])
        expect(() => apply(original, [{ type: 'update_node', id: 'trigger', config }])).toThrow(
          /Invalid configuration fields.*trigger.*rage-click/,
        );
      expect(() =>
        apply(original, [
          {
            type: 'add_node',
            node: {
              ...original.nodes[1],
              id: 'new',
              data: { kind: 'delay', label: 'Delay', config: { duration: 500, content: 'Wrong' } },
            },
          },
        ]),
      ).toThrow(/content.*delay/);
      expect(original.nodes[0].data.label).toBe('Start');
    },
  );
});

describe('AI trigger event conversion', () => {
  const scroll = {
    event: 'scroll-thrashing' as const,
    scrollDirectionChanges: 4,
    scrollThrashWindow: 2000,
    scrollMinDistance: 50,
  };

  it('cleans obsolete settings and preserves the selected node, connected popover and edges through transport and replay', () => {
    const original = workflow();
    const snapshot = structuredClone(original);
    const toolkit = createWorkflowTools(original, ['trigger']);
    expect(
      JSON.parse(toolkit.invokePrivate('update_node', { id: 'trigger', config: scroll })).ok,
    ).toBe(true);
    const draft = toolkit.getWorkflow();
    expect(draft.nodes[0]).toEqual({
      ...original.nodes[0],
      data: { ...original.nodes[0].data, config: scroll },
    });
    expect(draft.nodes[1]).toEqual(original.nodes[1]);
    expect(draft.edges).toEqual(original.edges);
    const response = parseAIChatResponse({
      message: 'Changed the selected trigger.',
      operations: toolkit.getOperations(),
    });
    const transported = JSON.parse(JSON.stringify(response));
    expect(applyServer(original, response.operations)).toEqual(draft);
    expect(applyClient(original, parseClient(transported).operations)).toEqual(draft);
    expect(original).toEqual(snapshot);
  });

  it.each(applications)(
    '%s keeps same-event patches partial and requires element selectors after conversion',
    (_name, apply) => {
      const original = workflow();
      const converted = apply(original, [{ type: 'update_node', id: 'trigger', config: scroll }]);
      const partial = apply(converted, [
        {
          type: 'update_node',
          id: 'trigger',
          config: { event: 'scroll-thrashing', scrollMinDistance: 75 },
        },
      ]);
      expect(partial.nodes[0].data.config).toEqual({ ...scroll, scrollMinDistance: 75 });
      expect(() =>
        apply(converted, [{ type: 'update_node', id: 'trigger', config: { event: 'click' } }]),
      ).toThrow(/target element/);
      const click = apply(converted, [
        { type: 'update_node', id: 'trigger', config: { event: 'click', selector: '#new' } },
      ]);
      expect(click.nodes[0].data.config).toEqual({ event: 'click', selector: '#new' });
      expect(
        apply(click, [{ type: 'update_node', id: 'trigger', config: { event: 'swipe' } }]).nodes[0]
          .data.config,
      ).toEqual({ event: 'swipe', selector: '#new' });
      expect(
        apply(original, [
          { type: 'update_node', id: 'trigger', config: { event: 'scroll-thrashing' } },
        ]).nodes[0].data.config,
      ).toEqual({ event: 'scroll-thrashing' });
    },
  );
});

describe('mutation progress results', () => {
  it('reports changed state and returns the target node without staging repeated updates', () => {
    const toolkit = createWorkflowTools(workflow(), ['trigger']);
    const config = {
      event: 'scroll-thrashing',
      scrollDirectionChanges: 4,
      scrollThrashWindow: 2000,
      scrollMinDistance: 50,
    };
    const first = JSON.parse(toolkit.invokePrivate('update_node', { id: 'trigger', config }));
    expect(first).toMatchObject({
      ok: true,
      changed: true,
      operation: { type: 'update_node', id: 'trigger', config },
      node: toolkit.getWorkflow().nodes[0],
    });
    const before = toolkit.getWorkflow();
    const repeated = JSON.parse(
      toolkit.invokePrivate('update_node', {
        config: {
          scrollMinDistance: 50,
          scrollThrashWindow: 2000,
          scrollDirectionChanges: 4,
          event: 'scroll-thrashing',
        },
        id: 'trigger',
      }),
    );
    expect(repeated).toMatchObject({ ok: true, changed: false, node: before.nodes[0] });
    expect(repeated.workflow).toBeUndefined();
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(toolkit.getWorkflow()).toEqual(before);
    expect(
      JSON.parse(
        toolkit.invokePrivate('update_connection', { id: 'connection', label: 'Continue' }),
      ),
    ).toMatchObject({ ok: true, changed: false, edge: before.edges[0] });
    expect(toolkit.getOperations()).toHaveLength(1);
  });

  it('compares nested object keys semantically and retains meaningful note formatting, metadata and position changes', () => {
    const original = workflow();
    original.nodes.push({
      id: 'transform',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: {
        kind: 'transform',
        label: 'Data',
        config: { transformations: [{ type: 'fallback', value: { a: 1, b: { c: 2, d: 3 } } }] },
      },
    });
    original.nodes.push({
      id: 'note',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: {
        kind: 'note',
        label: 'Note',
        config: { noteText: 'Hello', noteMarks: [{ start: 0, end: 5, bold: true }] },
      },
    });
    const toolkit = createWorkflowTools(original, []);
    expect(
      JSON.parse(
        toolkit.invokePrivate('update_node', {
          id: 'transform',
          config: { transformations: [{ value: { b: { d: 3, c: 2 }, a: 1 }, type: 'fallback' }] },
        }),
      ),
    ).toMatchObject({ ok: true, changed: false });
    expect(toolkit.getOperations()).toEqual([]);
    for (const patch of [
      { config: { noteMarks: [{ start: 0, end: 5, italic: true }] } },
      { description: 'New description' },
      { position: { x: 1, y: 2 } },
      { label: 'New label' },
      { config: { noteText: 'Hello' } },
    ]) {
      expect(
        JSON.parse(toolkit.invokePrivate('update_node', { id: 'note', ...patch })),
      ).toMatchObject({ ok: true, changed: true });
    }
    expect(toolkit.getOperations()).toHaveLength(5);
    expect(toolkit.getWorkflow().nodes.at(-1)).toMatchObject({
      position: { x: 1, y: 2 },
      data: {
        label: 'New label',
        description: 'New description',
        config: { noteMarks: [], noteItalic: false },
      },
    });
  });
});
