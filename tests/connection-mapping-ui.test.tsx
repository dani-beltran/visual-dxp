// @vitest-environment jsdom
import { Position } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectionMappingEditor } from '../src/components/ConnectionMappingEditor';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder';
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
          config: { selector: '#result', valueSource: 'incoming-data' },
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
  return element('.dxp-connection-mapping input') as HTMLInputElement;
}
async function setPath(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      pathField(),
      value,
    );
    pathField().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('edits the same connection from both inspectors and preserves mapping through undo/redo and save', async () => {
  const onChange = vi.fn<(workflow: Workflow) => void>();
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={graph()} onChange={onChange} />),
  );
  await click('[data-id="mapping"]');
  expect(host.textContent).toContain('No sample available');
  await setPath('user.name');
  expect(onChange.mock.lastCall?.[0].edges[0].data?.mapping).toEqual({
    sourcePath: 'user.name',
    targetInput: 'value',
  });
  expect(element('.react-flow__edge-text').textContent).toContain('user.name → Element value');
  await click('[data-id="dom"]');
  expect(pathField().value).toBe('user.name');
  await setPath('user.nickname');
  await click('[data-id="mapping"]');
  expect(pathField().value).toBe('user.nickname');
  await click('button[title^="Undo"]');
  await click('[data-id="mapping"]');
  expect(pathField().value).toBe('user.name');
  await click('button[title^="Redo"]');
  await click('[data-id="mapping"]');
  expect(pathField().value).toBe('user.nickname');
  const saved = JSON.parse(JSON.stringify(onChange.mock.lastCall![0]));
  expect(saved.nodes[1].data.config.valueDataPath).toBeUndefined();
  expect(saved.edges[0].data).toEqual({
    mapping: { sourcePath: 'user.nickname', targetInput: 'value' },
  });
});

it('shows missing, null, incompatible and unavailable preview states separately', async () => {
  const workflow = graph();
  const edge = workflow.edges[0];
  const target = workflow.nodes[1];
  target.data.config.action = 'add-class';
  for (const [sourcePath, expected] of [
    ['missing', 'Missing —'],
    ['nil', 'null (explicit value)'],
    ['object', 'Incompatible with the destination:'],
  ] as const) {
    await act(async () =>
      root.render(
        <ConnectionMappingEditor
          edge={{ ...edge, data: { mapping: { sourcePath, targetInput: 'value' } } }}
          source={workflow.nodes[0]}
          target={target}
          preview={{
            source: { exists: true, value: { nil: null, object: {} } },
            jsonResponse: true,
          }}
          onChange={() => {}}
          onBlur={() => {}}
        />,
      ),
    );
    expect(host.textContent).toContain(expected);
    expect(host.textContent).not.toContain('No sample available');
  }
  await act(async () =>
    root.render(
      <ConnectionMappingEditor edge={edge} target={target} onChange={() => {}} onBlur={() => {}} />,
    ),
  );
  expect(host.textContent).toContain('No sample available');
});

it('updates the canvas incoming-data badge as variables are added and removed, including undo', async () => {
  const workflow = graph();
  workflow.nodes[1].data.config = { selector: '#result', value: 'Static text' };
  const onChange = vi.fn<(workflow: Workflow) => void>();
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={workflow} onChange={onChange} />),
  );
  await click('[data-id="dom"]');
  expect(host.querySelector('[data-id="dom"] .dxp-node-incoming-value')).toBeNull();
  expect(host.querySelector('[role="switch"]')).toBeNull();
  for (const value of ['Hello {{name}}', 'Static again']) {
    const textarea = element('.dxp-inspector textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing textarea setter');
    await act(async () => {
      setter.call(textarea, value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(Boolean(host.querySelector('[data-id="dom"] .dxp-node-incoming-value'))).toBe(
      value.includes('{{'),
    );
    expect(onChange.mock.lastCall?.[0].nodes[1].data.config).toEqual({
      selector: '#result',
      value,
    });
    // End this editing session so undo restores the previous content.
    await click('[data-id="http"]');
    await click('[data-id="dom"]');
  }
  await click('button[title^="Undo"]');
  expect(element('[data-id="dom"] .dxp-node-incoming-value').textContent).toContain(
    'Uses incoming data',
  );
});
