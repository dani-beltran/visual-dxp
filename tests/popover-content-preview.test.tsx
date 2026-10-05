// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector';
import { createNode } from '../src/lib/catalog';
import { createRuntime } from '../src/lib/runtime/runtime';
import type { WorkflowNode } from '../src/lib/types';

let host: HTMLDivElement;
let root: Root;
let runtime: ReturnType<typeof createRuntime> | undefined;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  runtime?.destroy();
  runtime = undefined;
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function preview(node: WorkflowNode) {
  await act(async () =>
    root.render(
      <NodeInspector
        node={node}
        onChange={() => {}}
        onClose={() => {}}
        onPickElement={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onPreviewContent={() => {}}
      />,
    ),
  );
  const frame = host.querySelector('iframe')!;
  expect(frame.getAttribute('sandbox')).toBe('');
  return new DOMParser().parseFromString(frame.srcdoc, 'text/html');
}

it('matches scoped surface, arrow, and close styles with the same markup as the runtime', async () => {
  const node = createNode('popover');
  node.id = 'welcome';
  node.data.config = {
    contentType: 'html',
    position: 'anchor',
    selector: '#preview-target',
    content: `<style>
      [data-visual-dxp-popover]:has(.dxp-welcome-content) > div { background: rgb(47, 47, 47) !important; border-color: rgb(47, 47, 47) !important; }
      [data-visual-dxp-popover]:has(.dxp-welcome-content) > svg path { fill: rgb(47, 47, 47) !important; stroke: rgb(47, 47, 47) !important; }
      [data-visual-dxp-popover]:has(.dxp-welcome-content) button[aria-label="Close experience"] { color: #fff !important; }
      </style><div class="dxp-welcome-content" style="color:#fff;padding:20px">Welcome to our store!</div>`,
  };
  const doc = await preview(node);
  const panel = doc.querySelector<HTMLElement>('[data-visual-dxp-popover="welcome"]')!;
  expect(panel).not.toBeNull();
  const surface = doc.querySelector<HTMLElement>(
    '[data-visual-dxp-popover]:has(.dxp-welcome-content) > div',
  )!;
  expect(surface).toBe(panel.firstElementChild);
  expect(
    doc.querySelector('[data-visual-dxp-popover]:has(.dxp-welcome-content) > svg path'),
  ).not.toBeNull();
  expect(
    doc.querySelector(
      '[data-visual-dxp-popover]:has(.dxp-welcome-content) button[aria-label="Close experience"]',
    ),
  ).not.toBeNull();
  expect(surface.querySelector('style')?.textContent).toContain(
    'background: rgb(47, 47, 47) !important',
  );

  const target = document.createElement('button');
  target.id = 'preview-target';
  host.appendChild(target);
  const trigger = createNode('trigger');
  runtime = createRuntime({
    version: 1,
    name: 'Preview parity',
    websiteUrl: '',
    nodes: [trigger, node],
    edges: [{ id: 'edge', source: trigger.id, target: node.id }],
  });
  await runtime.run();
  const live = document.querySelector<HTMLElement>('[data-visual-dxp-popover="welcome"]')!;
  const liveSurface = live.firstElementChild as HTMLElement;
  expect(surface.innerHTML).toBe(liveSurface.innerHTML);
  expect(surface.style.padding).toBe(liveSurface.style.padding);
  expect(surface.style.border).toBe(liveSurface.style.border);
  expect(surface.style.borderRadius).toBe(liveSurface.style.borderRadius);
  expect(panel.querySelector('svg')?.innerHTML).toBe(live.querySelector('svg')?.innerHTML);
});

it('refreshes node-specific styles and removes the arrow when switching to a centered popover', async () => {
  const node = createNode('popover');
  node.data.config = { position: 'anchor', content: '<p>Original</p>' };
  expect((await preview(node)).querySelector('svg')).not.toBeNull();
  const updated = {
    ...node,
    id: 'updated',
    data: {
      ...node.data,
      config: {
        position: 'center' as const,
        width: 480,
        content:
          '<style>[data-visual-dxp-popover="updated"] > div { background: blue !important; }</style><p>Updated</p>',
      },
    },
  };
  const doc = await preview(updated);
  expect(doc.querySelector('svg')).toBeNull();
  expect(doc.body.textContent).not.toContain('Original');
  expect(doc.querySelector<HTMLElement>('[data-visual-dxp-popover="updated"]')?.style.width).toBe(
    '480px',
  );
  expect(doc.querySelector('[data-visual-dxp-popover="updated"] > div')?.textContent).toContain(
    'Updated',
  );
});
