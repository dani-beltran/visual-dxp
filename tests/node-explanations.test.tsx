// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector';
import { NodeLibrary } from '../src/components/NodeLibrary';
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
