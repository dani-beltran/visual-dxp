// @vitest-environment jsdom

import { Position } from '@xyflow/react';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VisualDXPBuilder, {
  createActivityStore,
  type VisualDXPBuilderApi,
  type Workflow,
} from '../src';
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
  vi.useRealTimers();
});

function initialWorkflow(): Workflow {
  return {
    version: 1,
    name: 'Embedded journey',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
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
  it('renders blue data sockets and connections for chained HTTP nodes and updates receiving data ports', async () => {
    const workflow = initialWorkflow();
    workflow.nodes = [
      createNode('trigger', { x: 0, y: 0 }),
      createNode('http', { x: 300, y: 0 }),
      createNode('http', { x: 600, y: 0 }),
      createNode('dom', { x: 900, y: 0 }),
    ].map((node, index) => ({
      ...node,
      id: `node-${index}`,
      width: 220,
      height: 140,
      handles: [
        { type: 'source', position: Position.Right, x: 220, y: 70 },
        { type: 'target', position: Position.Left, x: 0, y: 70 },
      ],
    }));
    workflow.nodes[3].data.config = { selector: '#result', valueSource: 'incoming-data' };
    workflow.edges = [
      { id: 'trigger-http', source: 'node-0', target: 'node-1' },
      { id: 'http-http', source: 'node-1', target: 'node-2' },
      { id: 'http-dom', source: 'node-2', target: 'node-3' },
    ];
    await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
    for (const id of ['node-1', 'node-2']) {
      expect(
        element(`[data-id="${id}"] .react-flow__handle.target`).classList.contains(
          'dxp-handle-data',
        ),
      ).toBe(id === 'node-2');
      expect(
        element(`[data-id="${id}"] .react-flow__handle.source`).classList.contains(
          'dxp-handle-data',
        ),
      ).toBe(true);
    }
    expect(element('[data-id="http-http"]').classList.contains('dxp-edge-data')).toBe(true);
    expect(element('[data-id="http-dom"]').classList.contains('dxp-edge-data')).toBe(true);
    expect(element('[data-id="trigger-http"]').classList.contains('dxp-edge-data')).toBe(false);
    await click(element('[data-id="node-3"]'));
    expect(host.querySelector('input[role="switch"]')).toBeNull();
    const content = element<HTMLTextAreaElement>('.dxp-inspector textarea');
    expect(content.value).toBe('{{$}}');
    for (const value of ['Static text', 'Hello {{name}}']) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
          content,
          value,
        );
        content.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(element('[data-id="http-dom"]').classList.contains('dxp-edge-data')).toBe(true);
      expect(element('[data-id="http-http"]').classList.contains('dxp-edge-data')).toBe(true);
    }
  });

  it('checks typed website URLs, confirms the bridge, and shows setup only when a check fails', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await act(async () =>
      root.render(<VisualDXPBuilder initialWorkflow={initialWorkflow()} onChange={onChange} />),
    );
    await click(element('button[aria-label="Change target website"]'));
    expect(host.querySelector('.dxp-website-connection')).toBeNull();
    const input = element<HTMLInputElement>('.dxp-website-settings input:not([type="checkbox"])');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const typeUrl = async (url: string) =>
      act(async () => {
        setter.call(input, url);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    await typeUrl('https://example.com/shop/?preview=1');
    expect(host.textContent).toContain('Connecting to your website');
    expect(host.querySelector('.dxp-website-setup')).toBeNull();
    await act(async () => vi.advanceTimersByTime(499));
    expect(host.querySelector('iframe')).toBeNull();
    await act(async () => vi.advanceTimersByTime(1));
    const frame = element<HTMLIFrameElement>('iframe');
    expect(frame.src).toBe('https://example.com/shop/?preview=1');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    const target = frame.contentWindow!;
    const post = vi.spyOn(target, 'postMessage').mockImplementation(() => {});
    await act(async () => frame.dispatchEvent(new Event('load')));
    expect(host.textContent).toContain('Connecting to your website');
    const init = post.mock.calls.at(-1)![0];
    const receive = async (source: Window | null, origin: string, channel = init.channel) =>
      act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source,
            origin,
            data: { protocol: init.protocol, channel, type: 'ready' },
          }),
        );
      });
    await receive(window, 'null');
    await receive(target, 'https://example.com');
    await receive(target, 'null', 'wrong-channel');
    expect(host.textContent).toContain('Connecting to your website');
    await receive(target, 'null');
    expect(host.textContent).toContain('Website connected successfully');
    expect(host.querySelector('iframe')).toBeNull();
    expect(post.mock.calls.at(-1)![0].type).toBe('stop');
    await typeUrl('https://another.example/');
    expect(host.textContent).toContain('Connecting to your website');
    expect(host.textContent).not.toContain('Website connected successfully');
    await receive(target, 'null');
    expect(host.textContent).toContain('Connecting to your website');
    await act(async () => vi.advanceTimersByTime(500));
    await act(async () => vi.advanceTimersByTime(8000));
    expect(host.querySelector('.dxp-website-settings .dxp-website-setup')).not.toBeNull();
    const snippet = `<script src="${window.location.origin}/bridge.js" data-parent-origin="${window.location.origin}"></script>`;
    expect(host.querySelector('.dxp-website-setup-snippet')?.textContent).toBe(snippet);
    expect(host.querySelector('.dxp-website-setup a')).toBeNull();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    await click(button('Copy script'));
    expect(writeText).toHaveBeenCalledWith(snippet);

    expect(host.querySelector('iframe')).toBeNull();
    await click(button('Use the demo website'));
    expect(host.querySelector('.dxp-website-connection')).toBeNull();
    expect(onChange.mock.lastCall?.[0].websiteUrl).toBe('/demo-site.html');
  });

  it('adds a resizable frame from the library and saves its editable name with undo', async () => {
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await act(async () =>
      root.render(<VisualDXPBuilder initialWorkflow={initialWorkflow()} onChange={onChange} />),
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
      root.render(<VisualDXPBuilder initialWorkflow={workflow} onChange={onChange} />),
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
    const onReady = vi.fn<(api: VisualDXPBuilderApi | null) => void>();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    const activityStore = createActivityStore();
    await act(async () =>
      root.render(
        <StrictMode>
          <VisualDXPBuilder
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
        <VisualDXPBuilder
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
            initialWorkflow={{ ...initialWorkflow(), websiteUrl: 'https://example.com/' }}
            onChange={onChange}
            activityStore={activityStore}
          />
        </StrictMode>,
      ),
    );
    expect(button('Test workflow').closest('.dxp-builder')).toBeNull();
    expect(button('Export workflow').closest('.dxp-builder')).toBeNull();
    await click(element('button[aria-label="Add Trigger"]'));
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(1);
    await click(element('button[title^="Undo"]'));
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(0);
    await click(element('button[title^="Redo"]'));
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(1);
    expect(onChange.mock.lastCall?.[0].name).toBe('Embedded journey');

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
