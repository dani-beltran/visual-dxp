// @vitest-environment jsdom
import { Position } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder/VisualDXPBuilder';
import type { StepConfig, Workflow } from '../src/lib/types';

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

function graph(trigger: StepConfig): Workflow {
  return {
    version: 1,
    name: 'Cart updates',
    websiteUrl: '/demo-site.html',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Cart updated', config: trigger },
      },
      {
        id: 'wait',
        type: 'workflow',
        position: { x: 400, y: 0 },
        data: { kind: 'delay', label: 'Wait', config: { duration: 500 } },
      },
      {
        id: 'dom',
        type: 'workflow',
        position: { x: 800, y: 0 },
        data: {
          kind: 'dom',
          label: 'Show item',
          config: { selector: '#result', value: '{{productId}}' },
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
    edges: [
      { id: 'detail', source: 'start', target: 'wait', type: 'smoothstep' },
      { id: 'forwarded', source: 'wait', target: 'dom', type: 'smoothstep' },
    ],
  };
}
function element(selector: string) {
  const result = host.querySelector(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
async function select(id: string) {
  await act(async () => {
    element(`[data-id="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

it('shows a custom event trigger as a data producer on the canvas and in the inspector', async () => {
  await act(async () =>
    root.render(
      <VisualDXPBuilder
        initialWorkflow={graph({ event: 'custom-event', customEventName: 'cart:updated' })}
      />,
    ),
  );
  expect(element('[data-id="start"] .dxp-node-incoming-value').textContent).toContain(
    'Produces data',
  );
  expect(element('[data-id="wait"] .dxp-node-incoming-value').textContent).toContain(
    'Forwards data',
  );
  expect(element('[data-id="dom"] .dxp-node-incoming-value').textContent).toContain(
    'Receives data',
  );
  for (const edge of ['detail', 'forwarded'])
    expect(element(`[data-id="${edge}"]`).classList.contains('dxp-edge-data')).toBe(true);
  expect(element('[data-id="start"] .react-flow__handle.source').getAttribute('aria-label')).toBe(
    'Custom event detail output',
  );
  // The footer still marks where the workflow starts, highlighted as a data output.
  expect(element('[data-id="start"] .dxp-node-data-output').textContent).toBe('START');

  await select('start');
  const outputs = element('.dxp-inspector-outputs');
  expect(outputs.querySelector('.dxp-inspector-data-output')).not.toBeNull();
  expect(outputs.textContent).toContain('Data');
  expect(outputs.textContent).toContain(
    'Runs when the custom event occurs and passes its detail to the next node',
  );
  expect(host.textContent).toContain('The event’s detail is passed to the next step as data');
});

it('keeps other triggers without data output', async () => {
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={graph({ event: 'page-load' })} />),
  );
  expect(host.querySelector('[data-id="start"] .dxp-node-incoming-value')).toBeNull();
  expect(host.querySelector('[data-id="dom"] .dxp-node-incoming-value')).toBeNull();
  expect(element('[data-id="detail"]').classList.contains('dxp-edge-data')).toBe(false);
  expect(host.querySelector('[data-id="start"] .dxp-node-data-output')).toBeNull();
  await select('start');
  const outputs = element('.dxp-inspector-outputs');
  expect(outputs.querySelector('.dxp-inspector-data-output')).toBeNull();
  expect(outputs.textContent).toContain('Runs when the selected event occurs');
});
