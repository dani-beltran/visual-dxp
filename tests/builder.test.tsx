// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivityStore, DXPBuilder, type DXPBuilderApi, type Workflow } from '../src';
import { App } from '../src/app';
import { createNode } from '../src/lib/catalog';

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;
const persistenceKey = 'builder-boundary-test';

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
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
  localStorage.removeItem(persistenceKey);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function initialWorkflow(): Workflow {
  return {
    version: 1,
    name: 'Embedded journey',
    websiteUrl: '/demo-site.html',
    nodes: [],
    edges: [],
  };
}

function element<T extends HTMLElement>(selector: string) {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

function button(text: string) {
  const found = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
}

describe('builder and host boundary', () => {
  it('adds a resizable frame from the library and saves its editable name with undo', async () => {
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await act(async () =>
      root.render(<DXPBuilder initialWorkflow={initialWorkflow()} onChange={onChange} />),
    );
    await click(element('button[aria-label="Add Frame"]'));
    const frame = onChange.mock.lastCall?.[0].nodes[0];
    expect(frame).toMatchObject({
      data: { kind: 'frame', label: 'Frame' },
      width: 560,
      height: 360,
    });
    expect(host.querySelector('.dxp-frame-card .react-flow__resize-control')).not.toBeNull();
    expect(host.querySelector('.dxp-frame-card .react-flow__handle')).toBeNull();
    const input = element<HTMLInputElement>('[aria-label="Frame configuration"] input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing input value setter');
    await act(async () => {
      setter.call(input, 'Onboarding');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(element('.dxp-frame-header strong').textContent).toBe('Onboarding');
    expect(onChange.mock.lastCall?.[0].nodes[0].data.label).toBe('Onboarding');
    await click(element('button[title^="Undo"]'));
    expect(element('.dxp-frame-header strong').textContent).toBe('Frame');
  });

  it('moves frame members together, undoes the move, and preserves members when deleting the frame', async () => {
    const workflow: Workflow = {
      ...initialWorkflow(),
      nodes: [
        { ...createNode('frame', { x: 100, y: 100 }), id: 'frame' },
        {
          ...createNode('delay', { x: 30, y: 70 }),
          id: 'child',
          parentId: 'frame',
          width: 220,
          height: 140,
        },
        { ...createNode('trigger', { x: -300, y: 100 }), id: 'outside', width: 220, height: 140 },
      ],
      edges: [{ id: 'edge', source: 'outside', target: 'child' }],
    };
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await act(async () =>
      root.render(<DXPBuilder initialWorkflow={workflow} onChange={onChange} />),
    );
    const before = element('[data-id="child"]').style.transform;
    const frame = element('[data-id="frame"]');
    await click(frame);
    await act(async () =>
      frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    await act(async () =>
      frame.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true })),
    );
    const moved = onChange.mock.lastCall?.[0];
    expect(moved?.nodes[0].position.x).toBeGreaterThan(100);
    expect(moved?.nodes[1].position).toEqual({ x: 30, y: 70 });
    expect(element('[data-id="child"]').style.transform).not.toBe(before);
    expect(moved?.nodes[2].position).toEqual({ x: -300, y: 100 });
    await click(element('button[title^="Undo"]'));
    expect(element('[data-id="child"]').style.transform).toBe(before);

    await click(frame);
    await act(async () =>
      frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })),
    );
    await act(async () =>
      host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true })),
    );
    const deleted = onChange.mock.lastCall?.[0];
    expect(deleted?.nodes.map((node) => node.id)).toEqual(['child', 'outside']);
    expect(deleted?.nodes[0]).toMatchObject({ position: { x: 130, y: 170 } });
    expect(deleted?.nodes[0].parentId).toBeUndefined();
    expect(deleted?.edges).toHaveLength(1);
    await click(element('button[title^="Undo"]'));
    expect(onChange.mock.lastCall?.[0].nodes[1].parentId).toBe('frame');
    await click(element('[data-id="frame"]'));
    await click(element('button[title="Delete frame"]'));
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual(['child', 'outside']);
    expect(onChange.mock.lastCall?.[0].edges).toHaveLength(1);
  });

  it('runs independently, exposes current JSON and preview actions, and detaches its API', async () => {
    const onReady = vi.fn<(api: DXPBuilderApi | null) => void>();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    const activityStore = createActivityStore();
    await act(async () =>
      root.render(
        <StrictMode>
          <DXPBuilder
            initialWorkflow={initialWorkflow()}
            onReady={onReady}
            onChange={onChange}
            activityStore={activityStore}
          />
        </StrictMode>,
      ),
    );
    expect(host.querySelector('.dxp-toolbar')).not.toBeNull();
    expect(host.querySelector('.dxp-work-area')).not.toBeNull();
    expect(host.querySelector('.dxp-footer')).not.toBeNull();
    expect(host.querySelector('.dxp-sidebar, .dxp-header, .dxp-export-modal')).toBeNull();
    expect(host.textContent).not.toContain('Test workflow');
    expect(host.textContent).not.toContain('Export workflow');
    expect(onChange.mock.lastCall?.[0]).toEqual(initialWorkflow());
    const api = onReady.mock.lastCall?.[0];
    if (!api) throw new Error('Builder API should be ready');
    const readyCalls = onReady.mock.calls.length;

    await act(async () => api.renameWorkflow('Latest journey'));
    await click(element('button[aria-label="Add Trigger"]'));
    const latest = onChange.mock.lastCall?.[0];
    expect(latest?.name).toBe('Latest journey');
    expect(latest?.nodes).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(latest))).toEqual(latest);
    expect(onReady).toHaveBeenCalledTimes(readyCalls);

    await act(async () => api.testWorkflow());
    const preview = element('[aria-label="Preview workflow"]');
    expect(preview.closest('.dxp-builder')).not.toBeNull();
    expect(activityStore.getSnapshot().at(-1)?.action).toContain('Latest journey');
    await click(element('button[aria-label="Close preview"]'));
    expect(host.querySelector('[aria-label="Preview workflow"]')).toBeNull();

    await click(element('button[title^="Undo"]'));
    expect(onChange.mock.lastCall?.[0].nodes).toEqual([]);
    await act(async () => root.unmount());
    mounted = false;
    expect(onReady.mock.lastCall?.[0]).toBeNull();
  });

  it('exposes restored workflow JSON to the host on mount', async () => {
    const restored = { ...initialWorkflow(), name: 'Saved journey' };
    localStorage.setItem(persistenceKey, JSON.stringify(restored));
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await act(async () =>
      root.render(
        <DXPBuilder
          initialWorkflow={initialWorkflow()}
          persistenceKey={persistenceKey}
          onChange={onChange}
        />,
      ),
    );
    expect(onChange.mock.lastCall?.[0]).toEqual(restored);
  });

  it('keeps test/export buttons and export JSON in the host while preview stays in the builder', async () => {
    const onChange = vi.fn<(workflow: Workflow) => void>();
    const activityStore = createActivityStore();
    await act(async () =>
      root.render(
        <StrictMode>
          <App
            initialWorkflow={initialWorkflow()}
            onChange={onChange}
            activityStore={activityStore}
          />
        </StrictMode>,
      ),
    );
    expect(button('Test workflow').closest('.dxp-builder')).toBeNull();
    expect(button('Export workflow').closest('.dxp-builder')).toBeNull();
    await click(element('button[aria-label="Add Trigger"]'));
    const input = element<HTMLInputElement>('input[aria-label="Workflow name"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing input value setter');
    await act(async () => {
      setter.call(input, 'Renamed by host');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].name).toBe('Renamed by host');
    await click(element('button[title^="Undo"]'));
    expect(input.value).toBe('Embedded journey');
    await click(element('button[title^="Redo"]'));
    expect(input.value).toBe('Renamed by host');

    await click(button('Test workflow'));
    expect(element('[aria-label="Preview workflow"]').closest('.dxp-builder')).not.toBeNull();
    await click(element('button[aria-label="Close preview"]'));
    await click(button('Export workflow'));
    expect(element('[aria-label="Export workflow"]').closest('.dxp-builder')).toBeNull();
    await click(button('Workflow JSON'));
    expect(JSON.parse(element('pre code').textContent ?? '')).toEqual(onChange.mock.lastCall?.[0]);

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await click(button('Copy'));
    expect(JSON.parse(writeText.mock.lastCall?.[0])).toEqual(onChange.mock.lastCall?.[0]);
    expect(activityStore.getSnapshot().at(-1)?.action).toBe('Copied the workflow as JSON');
    await act(async () =>
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(host.querySelector('[aria-label="Export workflow"]')).toBeNull();
  });
});
