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
import { App } from '../src/components/App/App';
import { BRANDING_PROTOCOL, readBrandingProfile } from '../src/lib/branding';
import { createNode } from '../src/lib/catalog';
import { brandingProfile } from './helpers/branding';
import { mockDemoFetch } from './helpers/preview';

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
  it('saves fullscreen popover edits as one workflow change and reopens saved settings', async () => {
    mockDemoFetch();
    const workflow = initialWorkflow();
    const node = createNode('popover');
    workflow.nodes = [node];
    let latest = workflow;
    await act(async () =>
      root.render(
        <VisualDXPBuilder
          initialWorkflow={workflow}
          onChange={(value) => {
            latest = value;
          }}
        />,
      ),
    );
    await click(element(`[data-id="${node.id}"]`));
    await click(button('Edit popover'));
    const width = element<HTMLInputElement>('.dxp-popover-editor-panel input[type="number"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(width, '640');
      width.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(latest.nodes[0].data.config.width).toBe(node.data.config.width);
    await click(button('Save changes'));
    expect(host.querySelector('.dxp-popover-preview')).toBeNull();
    expect(latest.nodes[0].data.config.width).toBe(640);
    await click(button('Edit popover'));
    expect(element<HTMLInputElement>('.dxp-popover-editor-panel input[type="number"]').value).toBe(
      '640',
    );
    await click(element('.dxp-website-preview-header button[aria-label="Cancel"]'));
    await click(button('Undo'));
    expect(latest.nodes[0].data.config).toEqual(node.data.config);
    expect(workflow.nodes[0]).toEqual(node);
  });

  it('selects a website element into an element-exists condition', async () => {
    const workflow = initialWorkflow();
    workflow.websiteUrl = 'https://preview.test';
    const condition = createNode('fork', { x: 0, y: 0 });
    condition.data.config = { condition: '#existing', selector: '#untouched' };
    workflow.nodes = [condition];
    const onChange = vi.fn();
    await act(async () =>
      root.render(<VisualDXPBuilder initialWorkflow={workflow} onChange={onChange} />),
    );
    await click(element(`[data-id="${condition.id}"]`));
    await click(element('.dxp-inspector-pick'));
    expect(host.querySelector('.dxp-picker-backdrop-fullscreen')).not.toBeNull();
    const input = element<HTMLInputElement>('.dxp-picker-selector-field input');
    expect(input.value).toBe('#existing');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing input setter');
    await act(async () => {
      setter.call(input, '#chosen');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(element('.dxp-picker-confirm'));
    expect(host.querySelector('.dxp-picker-dialog')).toBeNull();
    expect(onChange.mock.calls.at(-1)?.[0].nodes[0].data.config).toMatchObject({
      condition: '#chosen',
      selector: '#untouched',
    });
  });

  it('offers node actions for the right-clicked node and suppresses other canvas menus', async () => {
    const workflow = initialWorkflow();
    workflow.nodes = ['first', 'second'].map((id, index) => ({
      ...createNode('delay', { x: index * 300, y: 0 }),
      id,
    }));
    workflow.edges = [{ id: 'connection', source: 'first', target: 'second' }];
    await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
    await click(element('[data-id="first"]'));
    const contextMenu = async (selector: string) => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      });
      await act(async () => {
        element(selector).dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
    };
    await contextMenu('[data-id="second"]');
    expect([...host.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual(
      ['Edit', 'Duplicate', 'Delete'],
    );
    await click(element('[role="menuitem"]'));
    expect(document.activeElement).toBe(element('.dxp-inspector input'));
    expect(element('[data-id="second"]').classList.contains('selected')).toBe(true);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    await contextMenu('[data-id="second"]');
    await click(element('[role="menuitem"]:nth-child(2)'));
    expect(host.querySelectorAll('.react-flow__node')).toHaveLength(3);
    await contextMenu('[data-id="second"]');
    await click(element('[role="menuitem"]:nth-child(3)'));
    expect(host.querySelector('[data-id="second"]')).toBeNull();
    expect(host.querySelector('[data-id="first"]')).not.toBeNull();
    expect(host.querySelector('[data-id="connection"]')).toBeNull();
    await contextMenu('[data-id="first"]');
    await contextMenu('.react-flow__pane');
    expect(host.querySelector('[role="menu"]')).toBeNull();
    await contextMenu('.dxp-node-library-panel');
    expect(host.querySelector('[role="menu"]')).toBeNull();
    await contextMenu('[data-id="first"]');
    await act(async () => {
      element('[role="menuitem"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });

  it('shows only one inspector when a connection and nodes are selected together', async () => {
    const workflow = initialWorkflow();
    workflow.nodes = ['first', 'second', 'third'].map((id, index) => ({
      ...createNode('delay', { x: index * 300, y: 0 }),
      id,
      width: 220,
      height: 140,
      handles: [
        { type: 'source', position: Position.Right, x: 220, y: 70 },
        { type: 'target', position: Position.Left, x: 0, y: 70 },
      ],
    }));
    workflow.edges = [{ id: 'connection', source: 'first', target: 'second' }];
    await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
    await act(async () => {
      element('[data-id="connection"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelectorAll('.dxp-inspector')).toHaveLength(1);
    expect(element('.dxp-inspector').getAttribute('aria-label')).toBe('Connection configuration');
    for (const [index, id] of ['first', 'second', 'third'].entries()) {
      await act(async () => {
        host.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }),
        );
      });
      await act(async () => {
        element(`[data-id="${id}"]`).dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
        );
      });
      await act(async () => {
        element(`[data-id="${id}"]`).dispatchEvent(
          new KeyboardEvent('keyup', { key: 'Enter', shiftKey: true, bubbles: true }),
        );
      });
      expect(host.querySelectorAll('.react-flow__node.selected')).toHaveLength(index);
      await act(async () => {
        element('[data-id="connection"]').dispatchEvent(
          new MouseEvent('click', { shiftKey: true, bubbles: true }),
        );
      });
      await act(async () => {
        host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
      });
      expect(element('[data-id="connection"]').classList.contains('selected')).toBe(false);
      expect(host.querySelectorAll('.dxp-inspector')).toHaveLength(1);
      expect(host.querySelector('[aria-label="Connection configuration"]')).toBeNull();
      if (index > 0)
        expect(element('.dxp-inspector h2').textContent).toBe(`${index + 1} nodes selected`);
    }
    await act(async () => {
      host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    });
  });

  it.each(['metaKey', 'ctrlKey'] as const)(
    'pans on mouse movement alone with %s and stops on release',
    async (modifier) => {
      const workflow = initialWorkflow();
      workflow.nodes = [{ ...createNode('delay', { x: 0, y: 0 }), id: 'step' }];
      await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
      const viewport = element('.react-flow__viewport');
      const move = async (
        x: number,
        y: number,
        held: boolean,
        target = element('[data-id="step"]'),
      ) => {
        await act(async () => {
          target.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              clientX: x,
              clientY: y,
              buttons: 0,
              [modifier]: held,
            }),
          );
        });
      };
      const before = viewport.style.transform;
      await move(100, 100, false);
      await move(180, 150, true);
      expect(viewport.style.transform).not.toBe(before);
      const panned = viewport.style.transform;
      await move(220, 180, false);
      expect(viewport.style.transform).toBe(panned);
      await move(250, 200, true, element('.react-flow__panel button'));
      expect(viewport.style.transform).toBe(panned);
      await act(async () => window.dispatchEvent(new Event('blur')));
      await move(400, 400, true);
      expect(viewport.style.transform).toBe(panned);
      await move(420, 410, true);
      expect(viewport.style.transform).not.toBe(panned);
      expect(element('[data-id="step"]').classList.contains('selected')).toBe(false);
    },
  );

  it.each(['Meta', 'Control', ' ', null])(
    'pans by dragging with %s and preserves unmodified dragging',
    async (key) => {
      await act(async () => root.render(<VisualDXPBuilder initialWorkflow={initialWorkflow()} />));
      const viewport = element('.react-flow__viewport');
      const before = viewport.style.transform;
      const modifiers = { metaKey: key === 'Meta', ctrlKey: key === 'Control' };
      if (key) {
        await act(async () => {
          host.dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              code: key === ' ' ? 'Space' : key,
              bubbles: true,
              ...modifiers,
            }),
          );
        });
      }
      const mouseEvent = (type: string, options: MouseEventInit) => {
        const event = new MouseEvent(type, options);
        Object.defineProperty(event, 'view', { value: window });
        return event;
      };
      await act(async () => {
        element('.react-flow__pane').dispatchEvent(
          mouseEvent('mousedown', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
            buttons: 1,
            ...modifiers,
          }),
        );
        window.dispatchEvent(
          mouseEvent('mousemove', {
            bubbles: true,
            clientX: 180,
            clientY: 150,
            buttons: 1,
            ...modifiers,
          }),
        );
        window.dispatchEvent(
          mouseEvent('mouseup', {
            bubbles: true,
            clientX: 180,
            clientY: 150,
            ...modifiers,
          }),
        );
      });
      expect(viewport.style.transform).not.toBe(before);
      if (key) {
        await act(async () => {
          host.dispatchEvent(
            new KeyboardEvent('keyup', { key, code: key === ' ' ? 'Space' : key, bubbles: true }),
          );
        });
      }
    },
  );

  it('toggles nodes with Shift-click, resets selection, and deletes the selected group', async () => {
    const workflow = initialWorkflow();
    workflow.nodes = ['first', 'second', 'third'].map((id, index) => ({
      ...createNode('delay', { x: index * 300, y: 0 }),
      id,
    }));
    workflow.edges = [{ id: 'connection', source: 'first', target: 'third' }];
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await act(async () =>
      root.render(<VisualDXPBuilder initialWorkflow={workflow} onChange={onChange} />),
    );
    const selected = () =>
      [...host.querySelectorAll('.react-flow__node.selected')].map((node) =>
        node.getAttribute('data-id'),
      );
    const shiftClick = async (id: string) => {
      const before = selected();
      await act(async () => {
        host.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }),
        );
      });
      await act(async () => {
        element(`[data-id="${id}"]`).dispatchEvent(
          new MouseEvent('click', { shiftKey: true, bubbles: true }),
        );
      });
      expect(selected()).toEqual(before);
      await act(async () => {
        host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
      });
    };
    await click(element('[data-id="first"]'));
    await shiftClick('second');
    expect(selected()).toEqual(['first', 'second']);
    expect(element('.dxp-inspector h2').textContent).toBe('2 nodes selected');
    expect(button('Delete nodes')).toBeTruthy();
    await shiftClick('third');
    expect(element('.dxp-inspector h2').textContent).toBe('3 nodes selected');
    await shiftClick('third');
    await shiftClick('first');
    expect(selected()).toEqual(['second']);
    expect(host.querySelector('aside[aria-label="Selected nodes"]')).toBeNull();
    await shiftClick('third');
    await click(element('[data-id="second"]'));
    expect(selected()).toEqual(['second']);
    await shiftClick('first');
    await click(element('.react-flow__pane'));
    expect(selected()).toEqual([]);
    await click(element('[data-id="first"]'));
    await shiftClick('third');
    await act(async () => {
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await act(async () => {
      host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    });
    expect(selected()).toEqual([]);
    await click(element('[data-id="first"]'));
    await shiftClick('second');
    await act(async () => {
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });
    await act(async () => {
      host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual(['third']);
    await click(element('button[title^="Undo"]'));
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
    await click(element('[data-id="first"]'));
    await shiftClick('second');
    await click(element('button[aria-label="Close selection details"]'));
    expect(selected()).toEqual([]);
    expect(host.querySelector('.dxp-inspector')).toBeNull();
    await click(element('[data-id="first"]'));
    await shiftClick('second');
    await click(button('Delete nodes'));
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual(['third']);
    expect(onChange.mock.lastCall?.[0].edges).toEqual([]);
    expect(host.querySelector('.dxp-inspector')).toBeNull();
    await click(element('button[title^="Undo"]'));
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(onChange.mock.lastCall?.[0].edges).toEqual(workflow.edges);
  });

  it.each([
    ['fork', 'true', 'false', false],
    ['loop', 'body', 'done', false],
    ['experiment', 'a', 'b', false],
    ['fork', 'true', 'false', true],
    ['loop', 'body', 'done', true],
    ['experiment', 'a', 'b', true],
  ] as const)(
    'tracks each %s output socket connection independently',
    async (kind, first, second, withData) => {
      const workflow = initialWorkflow();
      workflow.nodes = [
        { ...createNode(kind, { x: 0, y: 0 }), id: 'split' },
        { ...createNode('dom', { x: 300, y: 0 }), id: 'target' },
      ];
      workflow.edges = [{ id: 'branch', source: 'split', sourceHandle: first, target: 'target' }];
      if (withData) {
        workflow.nodes.push({ ...createNode('http', { x: -300, y: 0 }), id: 'data' });
        workflow.edges.push({ id: 'incoming', source: 'data', target: 'split' });
      }
      await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
      expect(
        element(`[data-id="split"] [data-handleid="${first}"]`).classList.contains(
          'dxp-handle-connected',
        ),
      ).toBe(true);
      expect(
        element(`[data-id="split"] [data-handleid="${second}"]`).classList.contains(
          'dxp-handle-connected',
        ),
      ).toBe(false);
      expect(
        element('[data-id="split"] .react-flow__handle.target').classList.contains(
          'dxp-handle-connected',
        ),
      ).toBe(withData);
      for (const selector of [
        `[data-id="split"] [data-handleid="${first}"]`,
        '[data-id="split"] .react-flow__handle.target',
        '[data-id="target"] .react-flow__handle.target',
      ]) {
        expect(element(selector).classList.contains('dxp-handle-data')).toBe(withData);
      }
      expect(
        element(`[data-id="split"] [data-handleid="${second}"]`).classList.contains(
          'dxp-handle-data',
        ),
      ).toBe(false);
      expect(
        element('[data-id="target"] .react-flow__handle.target').classList.contains(
          'dxp-handle-connected',
        ),
      ).toBe(true);
    },
  );

  it('styles sockets by connection state while preserving data connections for chained HTTP nodes', async () => {
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
    workflow.nodes[3].data.config = { selector: '#result', value: '{{$}}' };
    workflow.edges = [
      { id: 'trigger-http', source: 'node-0', target: 'node-1' },
      { id: 'http-http', source: 'node-1', target: 'node-2' },
      { id: 'http-dom', source: 'node-2', target: 'node-3' },
    ];
    await act(async () => root.render(<VisualDXPBuilder initialWorkflow={workflow} />));
    for (const id of ['node-1', 'node-2']) {
      expect(
        element(`[data-id="${id}"] .react-flow__handle.target`).classList.contains(
          'dxp-handle-connected',
        ),
      ).toBe(true);
      expect(
        element(`[data-id="${id}"] .react-flow__handle.source`).classList.contains(
          'dxp-handle-connected',
        ),
      ).toBe(true);
    }
    for (const id of ['node-1', 'node-2']) {
      expect(
        element(`[data-id="${id}"] .react-flow__handle.source`).classList.contains(
          'dxp-handle-data',
        ),
      ).toBe(true);
      expect(
        element(`[data-id="${id}"] .react-flow__handle.target`).classList.contains(
          'dxp-handle-data',
        ),
      ).toBe(id === 'node-2');
    }
    expect(
      element('[data-id="node-3"] .react-flow__handle.source').classList.contains(
        'dxp-handle-data',
      ),
    ).toBe(false);
    expect(
      element('[data-id="node-3"] .react-flow__handle.source').classList.contains(
        'dxp-handle-connected',
      ),
    ).toBe(false);
    expect(element('[data-id="http-http"]').classList.contains('dxp-edge-data')).toBe(true);
    expect(element('[data-id="http-dom"]').classList.contains('dxp-edge-data')).toBe(true);
    expect(element('[data-id="trigger-http"]').classList.contains('dxp-edge-data')).toBe(false);
    await click(element('[data-id="node-3"]'));
    expect(host.querySelector('input[role="switch"]')).toBeNull();
    expect(element('.dxp-page-changes').textContent).toContain('{{$}}');
    expect(element('.dxp-page-editor-open').textContent).toBe('Edit page');
    expect(host.querySelector('.dxp-inspector textarea')).toBeNull();
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
    expect(host.textContent).toContain('Reading website branding');
    expect(host.querySelector('iframe')).toBe(frame);
    expect(post.mock.calls.at(-1)![0]).toEqual({
      protocol: BRANDING_PROTOCOL,
      channel: init.channel,
      type: 'extract',
    });
    await act(async () =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source: target,
          origin: 'null',
          data: {
            protocol: BRANDING_PROTOCOL,
            channel: init.channel,
            type: 'profile',
            profile: brandingProfile(frame.src),
          },
        }),
      ),
    );
    expect(readBrandingProfile(frame.src)?.colors.primary).toBe('rgb(38, 116, 86)');
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

it.each([
  ['example.com/shop?preview=1', 'https://example.com/shop?preview=1'],
  ['http://example.com/shop', 'http://example.com/shop'],
  ['https://example.com/shop', 'https://example.com/shop'],
  ['localhost:3000/shop', 'https://localhost:3000/shop'],
  ['//example.com/shop', 'https://example.com/shop'],
])('configures website input %s as %s', async (inputUrl, expected) => {
  const onChange = vi.fn<(workflow: Workflow) => void>();
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={initialWorkflow()} onChange={onChange} />),
  );
  await click(element('button[aria-label="Change target website"]'));
  const input = element<HTMLInputElement>('.dxp-website-settings input:not([type="checkbox"])');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, inputUrl);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelector('.dxp-website-scope')?.textContent).toContain(expected.split('?')[0]);
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  expect(onChange.mock.lastCall?.[0].websiteUrl).toBe(expected);
  expect(host.querySelector('.dxp-website-settings')).toBeNull();
});
