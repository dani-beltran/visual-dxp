// @vitest-environment jsdom
import { Position } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DataTransformInspector } from '../src/components/DataTransformInspector/DataTransformInspector';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder/VisualDXPBuilder';
import type { Workflow } from '../src/lib/types';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const createElementNS = document.createElementNS.bind(document);
  vi.spyOn(document, 'createElementNS').mockImplementation((namespace, name, options) => {
    const element = createElementNS(namespace, name, options);
    if (name === 'text')
      Object.assign(element, { getBBox: () => ({ x: 0, y: 0, width: 180, height: 14 }) });
    return element;
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function graph(): Workflow {
  return {
    version: 1,
    name: 'Mappings',
    websiteUrl: '/demo-site.html',
    nodes: [
      {
        id: 'http',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'http', label: 'Customer', config: { url: 'https://example.com/customer' } },
      },
      {
        id: 'dom',
        type: 'workflow',
        position: { x: 400, y: 0 },
        data: {
          kind: 'dom',
          label: 'Greeting',
          config: { selector: '#result', value: '{{$}}' },
        },
      },
    ].map((node) => ({
      ...node,
      width: 220,
      height: 140,
      handles: [
        { type: 'source', position: Position.Right, x: 220, y: 70 },
        { type: 'target', position: Position.Left, x: 0, y: 70 },
      ],
    })) as Workflow['nodes'],
    edges: [{ id: 'mapping', source: 'http', target: 'dom', type: 'smoothstep' }],
  };
}
function element(selector: string) {
  const result = host.querySelector(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
async function click(selector: string) {
  await act(async () => {
    element(selector).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}
function pathField() {
  return element('.dxp-data-transform input') as HTMLInputElement;
}

it.each(['delay', 'fork', 'loop', 'experiment'] as const)(
  'updates data badges and sockets through %s when connections change',
  async (kind) => {
    const workflow = graph();
    workflow.nodes.push({
      ...workflow.nodes[1],
      id: 'delay',
      position: { x: 250, y: 180 },
      data: { kind, label: 'Intermediate step', config: { duration: 100 } },
      handles: [
        { type: 'target', position: Position.Left, x: 0, y: 70 },
        ...(kind === 'delay'
          ? [{ type: 'source' as const, position: Position.Right, x: 220, y: 70 }]
          : (kind === 'experiment'
              ? ['a', 'b']
              : kind === 'fork'
                ? ['true', 'false']
                : ['body', 'done']
            ).map((id, index) => ({
              id,
              type: 'source' as const,
              position: Position.Right,
              x: 220,
              y: index === 0 ? 52 : 102,
            }))),
      ],
    });
    workflow.edges = [
      { id: 'source', source: 'http', target: 'delay', type: 'smoothstep' },
      {
        id: 'destination',
        source: 'delay',
        target: 'dom',
        type: 'smoothstep',
        sourceHandle:
          kind === 'experiment'
            ? 'a'
            : kind === 'fork'
              ? 'true'
              : kind === 'loop'
                ? 'body'
                : undefined,
      },
    ];
    await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
    expect(element('[data-id="http"] .dxp-node-incoming-value').textContent).toContain(
      'Produces data',
    );
    expect(element('[data-id="delay"] .dxp-node-incoming-value').textContent).toContain(
      'Forwards data',
    );
    expect(element('[data-id="dom"] .dxp-node-incoming-value').textContent).toContain(
      'Receives data',
    );
    expect(element('[data-id="source"]').classList.contains('dxp-edge-data')).toBe(true);
    expect(element('[data-id="destination"]').classList.contains('dxp-edge-data')).toBe(true);
    expect(
      element('[data-id="delay"] .react-flow__handle.target').classList.contains('dxp-handle-data'),
    ).toBe(true);
    for (const handle of host.querySelectorAll('[data-id="delay"] .react-flow__handle.source')) {
      const connected = workflow.edges.some(
        (edge) =>
          edge.source === 'delay' &&
          (edge.sourceHandle ?? null) === handle.getAttribute('data-handleid'),
      );
      expect(handle.classList.contains('dxp-handle-connected')).toBe(connected);
      expect(handle.classList.contains('dxp-handle-data')).toBe(connected);
    }
    if (kind === 'fork') {
      await click('[data-id="delay"]');
      const outputs = element('.dxp-inspector-branches');
      expect(outputs.textContent).toContain('TrueForwards data when the condition matches');
      expect(outputs.textContent).toContain('FalseForwards data when the condition does not match');
      expect(
        [...outputs.querySelectorAll('.dxp-inspector-branch-letter')].map(
          (label) => label.textContent,
        ),
      ).toEqual(['T', 'F']);
    }
    expect(
      element('[data-id="dom"] .react-flow__handle.target').classList.contains('dxp-handle-data'),
    ).toBe(true);
    expect(
      element('[data-id="dom"] .react-flow__handle.source').classList.contains('dxp-handle-data'),
    ).toBe(false);
    await click('[data-id="destination"]');
    await click('.dxp-inspector-delete');
    expect(element('[data-id="delay"] .dxp-node-incoming-value').textContent).toContain(
      'Receives data',
    );
    expect(host.querySelector('[data-id="dom"] .dxp-node-incoming-value')).toBeNull();
    expect(
      host.querySelector('[data-id="delay"] .react-flow__handle.source.dxp-handle-data'),
    ).toBeNull();
    expect(
      element('[data-id="delay"] .react-flow__handle.target').classList.contains('dxp-handle-data'),
    ).toBe(true);
    await click('button[title^="Undo"]');
    expect(element('[data-id="delay"] .dxp-node-incoming-value').textContent).toContain(
      'Forwards data',
    );
    expect(element('[data-id="dom"] .dxp-node-incoming-value').textContent).toContain(
      'Receives data',
    );
    await click('[data-id="source"]');
    await click('.dxp-inspector-delete');
    expect(host.querySelector('[data-id="delay"] .dxp-node-incoming-value')).toBeNull();
    expect(host.querySelector('[data-id="dom"] .dxp-node-incoming-value')).toBeNull();
    expect(element('[data-id="destination"]').classList.contains('dxp-edge-data')).toBe(false);
    expect(host.querySelector('[data-id="delay"] .dxp-handle-data')).toBeNull();
    expect(host.querySelector('[data-id="dom"] .dxp-handle-data')).toBeNull();
    if (kind === 'fork') {
      await click('[data-id="delay"]');
      const outputs = element('.dxp-inspector-branches');
      expect(outputs.textContent).toContain('TrueCondition matches');
      expect(outputs.textContent).toContain('FalseCondition does not match');
      expect(outputs.textContent).not.toContain('Forwards data');
    }
  },
);
async function setPath(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      pathField(),
      value,
    );
    pathField().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('edits a Data Transform through history and saves its configuration without connection controls', async () => {
  const workflow = graph();
  workflow.nodes.push({
    ...workflow.nodes[1],
    id: 'transform',
    type: 'workflow',
    position: { x: 200, y: 180 },
    data: { kind: 'transform', label: 'Name', config: { dataPath: '', transformations: [] } },
  });
  workflow.edges = [
    { id: 'source', source: 'http', target: 'transform' },
    { id: 'result', source: 'transform', target: 'dom' },
  ];
  const onChange = vi.fn<(workflow: Workflow) => void>();
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={workflow} onChange={onChange} />),
  );
  await click('[data-id="dom"]');
  expect(host.textContent).not.toContain('Incoming mappings');
  await click('[data-id="result"]');
  expect(host.querySelector('.dxp-data-transform')).toBeNull();
  expect(host.textContent).not.toContain('Destination input');
  await click('[data-id="transform"]');
  expect(host.textContent).not.toContain('Latest test run');
  expect(host.textContent).not.toContain('No sample available');
  await setPath('user.name');
  expect(
    onChange.mock.lastCall?.[0].nodes.find((node) => node.id === 'transform')?.data.config.dataPath,
  ).toBe('user.name');
  await click('[data-id="dom"]');
  await click('[data-id="transform"]');
  await setPath('user.nickname');
  await click('[data-id="dom"]');
  await click('button[title^="Undo"]');
  await click('[data-id="transform"]');
  expect(pathField().value).toBe('user.name');
  await click('button[title^="Redo"]');
  await click('[data-id="transform"]');
  expect(pathField().value).toBe('user.nickname');
  const saved = JSON.parse(JSON.stringify(onChange.mock.lastCall![0]));
  expect(saved.edges.every((edge: Workflow['edges'][number]) => !edge.data?.mapping)).toBe(true);
});

it('offers transformation-specific controls and reorders operations', async () => {
  let config: Workflow['nodes'][number]['data']['config'] = {
    transformations: [{ type: 'prefix', value: 'a' }, { type: 'uppercase' }],
  };
  const render = () =>
    root.render(
      <DataTransformInspector
        config={config}
        onChange={(patch) => {
          config = { ...config, ...patch };
          render();
        }}
      />,
    );
  await act(async () => render());
  expect(host.textContent).toContain('Text to add');
  expect(host.textContent).not.toContain('Replace with');
  await click('button[aria-label="Move transformation 1 down"]');
  expect(config.transformations).toEqual([{ type: 'uppercase' }, { type: 'prefix', value: 'a' }]);
  await click('button[aria-label="Remove transformation 2"]');
  expect(host.textContent).not.toContain('Text to add');
});

it.each(['Hello {{name}}', 'Static text'])(
  'keeps the receiving badge and data socket for a page customization with %s',
  async (value) => {
    const workflow = graph();
    workflow.nodes[1].data.config = { changes: [{ selector: '#result', action: 'text', value }] };
    await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
    await click('[data-id="dom"]');
    expect(element('[data-id="http"] .dxp-node-incoming-value').textContent).toContain(
      'Produces data',
    );
    expect(element('[data-id="dom"] .dxp-node-incoming-value').textContent).toContain(
      'Receives data',
    );
    expect(
      host.querySelector('[data-id="dom"] .react-flow__handle.target.dxp-handle-data'),
    ).not.toBeNull();
    expect(element('.dxp-page-changes').textContent).toContain(value);
    expect(host.querySelector('[role="switch"]')).toBeNull();
  },
);
