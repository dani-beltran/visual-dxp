// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
import { NodeLibrary } from '../src/components/NodeLibrary/NodeLibrary';
import { catalog, createNode } from '../src/lib/catalog';
import { nodeDescriptions } from '../src/lib/nodeDescriptions';
import type { NodeKind } from '../src/lib/types';
import { catalog as serverCatalog } from '../src/server/ai/workflow/catalog';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('covers every node kind exactly once in the library and keeps server explanations aligned', () => {
  expect(catalog.map(({ kind }) => kind).sort()).toEqual(Object.keys(nodeDescriptions).sort());
  for (const entry of serverCatalog) {
    expect(entry.description).toBe(nodeDescriptions[entry.kind]);
  }
});

it.each(Object.keys(nodeDescriptions) as NodeKind[])(
  'shows the same explanation for %s in its inspector and accessible library tooltip',
  async (kind) => {
    const node = createNode(kind);
    const onAdd = vi.fn();
    await act(async () =>
      root.render(
        <>
          <NodeLibrary onAdd={onAdd} />
          <NodeInspector
            node={node}
            onChange={() => {}}
            onClose={() => {}}
            onPickElement={() => {}}
            onDelete={() => {}}
            onDuplicate={() => {}}
            onPreviewContent={() => {}}
          />
        </>,
      ),
    );
    const description = host.querySelector('.dxp-inspector-description');
    expect(description?.textContent).toBe(nodeDescriptions[kind]);
    expect(description?.textContent?.trim().length).toBeGreaterThan(0);
    const button = host.querySelector<HTMLButtonElement>(
      `button[aria-label="Add ${node.data.label}"]`,
    );
    if (!button) throw new Error(`Missing library button for ${kind}`);

    await act(async () => button.focus());
    const tooltip = host.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toBe(node.data.label + description?.textContent);
    expect(button.getAttribute('aria-describedby')).toBe(tooltip?.id);
    expect(tooltip?.getAttribute('aria-hidden')).not.toBe('true');

    await act(async () =>
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(host.querySelector('[role="tooltip"]')).toBeNull();
    expect(button.hasAttribute('aria-describedby')).toBe(false);

    await act(async () => button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(host.querySelector('[role="tooltip"]')?.textContent).toContain(nodeDescriptions[kind]);
    await act(async () => button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    expect(host.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => button.click());
    expect(onAdd).toHaveBeenCalledExactlyOnceWith(kind);
  },
);

it('moves vertically overflowing nodes into a submenu and restores them after resizing', async () => {
  let resize = () => {};
  let availableHeight = 110;
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => availableHeight);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const onAdd = vi.fn();
  try {
    await act(async () => root.render(<NodeLibrary onAdd={onAdd} />));
    expect(host.querySelectorAll('.dxp-node-library > button')).toHaveLength(3);
    const more = host.querySelector<HTMLButtonElement>('[aria-label="More nodes"]')!;
    await act(async () => more.click());
    const overflow = host.querySelector('.dxp-node-library-overflow')!;
    expect(overflow.querySelectorAll('button')).toHaveLength(catalog.length - 2);
    const node = overflow.querySelector<HTMLButtonElement>('button')!;
    const setData = vi.fn();
    const drag = new Event('dragstart', { bubbles: true });
    Object.defineProperty(drag, 'dataTransfer', { value: { setData } });
    await act(async () => node.dispatchEvent(drag));
    expect(setData).toHaveBeenCalledWith('application/visual-dxp-node', catalog[2].kind);
    await act(async () => node.click());
    expect(onAdd).toHaveBeenCalledWith(catalog[2].kind);
    expect(host.querySelector('.dxp-node-library-overflow')).toBeNull();
    expect(document.activeElement).toBe(more);
    await act(async () => more.click());
    await act(async () =>
      more.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(host.querySelector('.dxp-node-library-overflow')).toBeNull();
    availableHeight = 600;
    await act(async () => resize());
    expect(host.querySelector('[aria-label="More nodes"]')).toBeNull();
    expect(host.querySelectorAll('.dxp-node-library > button')).toHaveLength(catalog.length);
  } finally {
    vi.restoreAllMocks();
  }
});
