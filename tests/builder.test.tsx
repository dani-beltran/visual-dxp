// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivityStore, DXPBuilder, type DXPBuilderApi, type Workflow } from '../src';
import { App } from '../src/app';

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
