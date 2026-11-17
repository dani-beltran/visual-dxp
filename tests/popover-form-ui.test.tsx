// @vitest-environment jsdom
import { Position } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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

function graph(content: string): Workflow {
  return {
    version: 1,
    name: 'Signup',
    websiteUrl: '/demo-site.html',
    nodes: [
      {
        id: 'signup',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'popover', label: 'Signup', config: { contentType: 'html', content } },
      },
      {
        id: 'dom',
        type: 'workflow',
        position: { x: 400, y: 0 },
        data: {
          kind: 'dom',
          label: 'Greeting',
          config: { selector: '#result', value: '{{email}}' },
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
    edges: [{ id: 'submission', source: 'signup', target: 'dom', type: 'smoothstep' }],
  };
}
function element(selector: string) {
  const result = host.querySelector(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}

it('shows a popover with a form as a data producer on the canvas and in the inspector', async () => {
  await act(async () =>
    root.render(
      <VisualDXPBuilder
        initialWorkflow={graph('<form><input name="email"><button>Join</button></form>')}
      />,
    ),
  );
  expect(element('[data-id="signup"] .dxp-node-incoming-value').textContent).toContain(
    'Produces data',
  );
  expect(element('[data-id="dom"] .dxp-node-incoming-value').textContent).toContain(
    'Receives data',
  );
  expect(element('[data-id="submission"]').classList.contains('dxp-edge-data')).toBe(true);
  expect(element('[data-id="signup"] .react-flow__handle.source').getAttribute('aria-label')).toBe(
    'Submitted form data output',
  );
  expect(element('[data-id="signup"] .dxp-node-data-output').textContent).toBe('DATA OUT');

  await act(async () => {
    element('[data-id="signup"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const outputs = element('.dxp-inspector-outputs');
  expect(outputs.querySelector('.dxp-inspector-data-output')).not.toBeNull();
  expect(outputs.textContent).toContain(
    'Waits for the form to be submitted, then passes its fields to the next node',
  );
  expect(host.textContent).toContain('Collects form data');
  expect(host.textContent).toContain('This popover contains a form');
});

it('keeps a popover without a form as an ordinary step', async () => {
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={graph('<h2>Hello</h2>')} />),
  );
  expect(host.querySelector('[data-id="signup"] .dxp-node-incoming-value')).toBeNull();
  expect(element('[data-id="submission"]').classList.contains('dxp-edge-data')).toBe(false);
  await act(async () => {
    element('[data-id="signup"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const outputs = element('.dxp-inspector-outputs');
  expect(outputs.querySelector('.dxp-inspector-data-output')).toBeNull();
  expect(outputs.textContent).toContain('Runs after the popover is displayed');
  expect(host.textContent).not.toContain('Collects form data');
});
