// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
import { PopoverPreview } from '../src/components/PopoverPreview/PopoverPreview';
import type { StepConfig, WorkflowNode } from '../src/lib/types';
import { connectPreview, mockDemoFetch } from './helpers/preview';

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mockDemoFetch();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function popover(config: StepConfig = {}): WorkflowNode {
  return {
    id: 'selected-popover',
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: {
      kind: 'popover',
      label: 'A welcome gift',
      config: {
        contentType: 'html',
        content: '<h2>Welcome to Atelier</h2><p>Enjoy your stay.</p>',
        width: 420,
        position: 'bottom-right',
        ...config,
      },
    },
  };
}

async function renderPreview(node = popover(), onClose = vi.fn(), websiteUrl = '/demo-site.html') {
  await act(async () =>
    root.render(<PopoverPreview node={node} websiteUrl={websiteUrl} onClose={onClose} />),
  );
  return onClose;
}

function websiteFrame() {
  const frame = document.querySelector<HTMLIFrameElement>(
    'iframe[title="Popover preview website"]',
  );
  if (!frame) throw new Error('Expected the preview website iframe.');
  return frame;
}

async function loadWebsite(html = '<main><h1>Atelier</h1></main>') {
  const frame = websiteFrame();
  const doc = frame.contentDocument;
  if (!doc) throw new Error('Expected the preview website document.');
  if (!doc.documentElement) doc.appendChild(doc.createElement('html'));
  if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
  doc.body.innerHTML = html;
  connectPreview(frame);
  await act(async () => frame.dispatchEvent(new Event('load')));
  return { frame, doc };
}

function panel(doc: Document) {
  const element = doc.querySelector<HTMLElement>('[data-visual-dxp-popover="selected-popover"]');
  if (!element) throw new Error('Expected the selected popover to render.');
  return element;
}

describe('fullscreen popover preview', () => {
  it('plays the selected animation when entering fullscreen', async () => {
    await renderPreview(popover({ popoverAnimation: 'bounce' }));
    const frame = websiteFrame();
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Expected the preview document.');
    const prototype = Object.getPrototypeOf(doc.createElement('section'));
    const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
      cancel: vi.fn(),
    }));
    Object.defineProperty(prototype, 'animate', { configurable: true, value: animate });
    try {
      await loadWebsite();
      expect(animate).toHaveBeenCalledOnce();
      expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 480 });
    } finally {
      Reflect.deleteProperty(prototype, 'animate');
    }
  });

  it('saves the animation selected in the node inspector', async () => {
    const onChange = vi.fn();
    await act(async () =>
      root.render(
        <NodeInspector
          node={popover()}
          onChange={onChange}
          onClose={vi.fn()}
          onPickElement={vi.fn()}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onPreviewContent={vi.fn()}
        />,
      ),
    );
    const label = [...document.querySelectorAll('label')].find(
      (item) => item.textContent === 'Animation',
    );
    const select = document.getElementById(label?.htmlFor ?? '');
    if (!(select instanceof HTMLSelectElement)) throw new Error('Expected the animation selector.');
    expect(select.value).toBe('none');
    for (const effect of ['fade', 'slide', 'zoom', 'bounce', 'none']) {
      await act(async () => {
        select.value = effect;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ popoverAnimation: effect }),
        }),
      );
    }
  });

  it('loads the configured external website and runs its popover through the bridge', async () => {
    const websiteUrl = 'https://shop.example/products?preview=1';
    await renderPreview(popover(), vi.fn(), websiteUrl);
    const frame = websiteFrame();
    expect(frame.src).toBe(websiteUrl);
    expect(frame.hasAttribute('srcdoc')).toBe(false);
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('.dxp-popover-preview-bar')?.textContent).toContain(websiteUrl);
    expect(document.body.textContent).not.toContain('Demo website');
    const target = frame.contentWindow!;
    const post = vi.spyOn(target, 'postMessage').mockImplementation(() => {});
    await act(async () => frame.dispatchEvent(new Event('load')));
    const init = post.mock.calls.at(-1)![0];
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: target,
          origin: 'null',
          data: { ...init, type: 'ready' },
        }),
      );
    });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run',
        workflow: expect.objectContaining({ websiteUrl }),
      }),
      '*',
    );
    expect(document.querySelector('.dxp-popover-preview-loading')).toBeNull();
  });

  it('reports a missing preview bridge instead of loading forever', async () => {
    vi.useFakeTimers();
    await renderPreview();
    await act(async () => vi.advanceTimersByTime(8000));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('bridge.js');
    expect(document.querySelector('.dxp-popover-preview-loading')).toBeNull();
  });

  it('connects when the bridge is installed after the iframe load and stops retrying', async () => {
    vi.useFakeTimers();
    await renderPreview();
    const frame = websiteFrame();
    await act(async () => frame.dispatchEvent(new Event('load')));
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Expected the website document.');
    // Populate the loaded document without scheduling a second load via doc.close().
    doc.body.innerHTML = '<h1>Website</h1>';
    connectPreview(frame);
    await act(async () => vi.advanceTimersByTime(1000));
    const original = panel(doc);
    await act(async () => vi.advanceTimersByTime(9000));
    expect(panel(doc)).toBe(original);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('uses the isolated demo website for content previews', async () => {
    await renderPreview();
    expect(websiteFrame().hasAttribute('src')).toBe(false);
    expect(websiteFrame().getAttribute('srcdoc')).toContain('Demo');
    expect(document.querySelector('.dxp-popover-preview-bar')?.textContent).toContain(
      'Demo website',
    );
    const { doc } = await loadWebsite();
    expect(panel(doc).textContent).toContain('Welcome to Atelier');
  });

  it.each([
    { contentType: 'html', content: '<h2>A welcome gift</h2>' },
    { contentType: 'html', content: '' },
    { contentType: 'iframe', url: 'https://example.com/welcome' },
  ] as const)(
    'offers fullscreen preview for $contentType content in the inspector',
    async (config) => {
      const onPreviewContent = vi.fn();
      await act(async () => {
        root.render(
          <NodeInspector
            node={popover(config)}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onPickElement={vi.fn()}
            onDelete={vi.fn()}
            onDuplicate={vi.fn()}
            onPreviewContent={onPreviewContent}
          />,
        );
      });
      const expand = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Open fullscreen content preview"]',
      );
      if (!expand) throw new Error('Expected the inspector fullscreen preview button.');
      await act(async () => expand.click());
      expect(onPreviewContent).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ['top-left', 'top', 'left'],
    ['top-right', 'top', 'right'],
    ['bottom-left', 'bottom', 'left'],
    ['bottom-right', 'bottom', 'right'],
  ] as const)(
    'automatically renders %s on the demo website at the configured width',
    async (position, vertical, horizontal) => {
      await renderPreview(popover({ position }));
      expect(
        document.querySelector('[role="dialog"][aria-label="Fullscreen popover preview"]'),
      ).not.toBeNull();
      expect(websiteFrame().getAttribute('sandbox')).toBe('allow-scripts');

      const { doc } = await loadWebsite();
      expect(doc.querySelector('main h1')?.textContent).toBe('Atelier');
      expect(panel(doc).querySelector('h2')?.textContent).toBe('Welcome to Atelier');
      expect(panel(doc).style.width).toBe('420px');
      expect(panel(doc).style[vertical]).toBe('24px');
      expect(panel(doc).style[horizontal]).toBe('24px');
      expect(doc.querySelectorAll('[data-visual-dxp-popover]')).toHaveLength(1);
    },
  );

  it('centers the popover within the website viewport', async () => {
    await renderPreview(popover({ position: 'center' }));
    const { doc } = await loadWebsite();
    expect(panel(doc).style.top).toBe('50%');
    expect(panel(doc).style.left).toBe('50%');
    expect(panel(doc).style.transform).toBe('translate(-50%, -50%)');
  });

  it.each([140, 2000])(
    'keeps the popover visible with an anchor at y=%s and follows scrolling',
    async (initialTop) => {
      await renderPreview(popover({ position: 'anchor', selector: '#shop-now' }));
      const frame = websiteFrame();
      const doc = frame.contentDocument;
      if (!doc) throw new Error('Expected the preview website document.');
      if (!doc.documentElement) doc.appendChild(doc.createElement('html'));
      if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
      doc.body.innerHTML = '<button id="shop-now">Shop the collection</button>';
      const anchor = doc.querySelector<HTMLElement>('#shop-now');
      if (!anchor) throw new Error('Expected the demo anchor.');
      let top = initialTop;
      const win = frame.contentWindow;
      if (!win) throw new Error('Expected the preview window.');
      vi.spyOn(win, 'innerHeight', 'get').mockReturnValue(768);
      vi.spyOn(
        Object.getPrototypeOf(doc.createElement('section')),
        'getBoundingClientRect',
      ).mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 420,
        bottom: 200,
        width: 420,
        height: 200,
        toJSON: () => ({}),
      });
      anchor.getBoundingClientRect = vi.fn(() => ({
        x: 180,
        y: top,
        left: 180,
        top,
        right: 280,
        bottom: top + 40,
        width: 100,
        height: 40,
        toJSON: () => ({}),
      }));
      anchor.scrollIntoView = vi.fn();

      connectPreview(frame);
      await act(async () => frame.dispatchEvent(new Event('load')));
      expect(panel(doc).style.left).toBe('180px');
      expect(panel(doc).style.top).toBe(initialTop === 140 ? '192px' : '552px');

      top = 80;
      await act(async () => frame.contentWindow?.dispatchEvent(new Event('scroll')));
      expect(panel(doc).style.top).toBe('132px');
    },
  );

  it('shows an error when the anchor does not exist on the demo website', async () => {
    await renderPreview(popover({ position: 'anchor', selector: '#missing-anchor' }));
    const { doc } = await loadWebsite();
    expect(doc.querySelector('[data-visual-dxp-popover]')).toBeNull();
    expect(document.body.textContent).toContain('No elements match');
    expect(document.body.textContent).toContain('#missing-anchor');
  });

  it('renders embedded website content using the runtime iframe sandbox', async () => {
    await renderPreview(popover({ contentType: 'iframe', url: 'https://example.com/welcome' }));
    const { doc } = await loadWebsite();
    const embedded = panel(doc).querySelector('iframe');
    if (!embedded) throw new Error('Expected an embedded website in the popover.');
    expect(embedded.getAttribute('src')).toBe('https://example.com/welcome');
    expect(embedded.getAttribute('sandbox')).toContain('allow-scripts');
    expect(embedded.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  it('replaces the popover when configuration changes and removes it on unmount', async () => {
    const onClose = await renderPreview();
    const { doc } = await loadWebsite();
    const original = panel(doc);

    await renderPreview(popover({ width: 640, content: '<h2>Updated offer</h2>' }), onClose);
    expect(original.isConnected).toBe(false);
    expect(doc.querySelectorAll('[data-visual-dxp-popover]')).toHaveLength(1);
    expect(panel(doc).style.width).toBe('640px');
    expect(panel(doc).textContent).toContain('Updated offer');

    const updated = panel(doc);
    await act(async () => root.unmount());
    mounted = false;
    expect(updated.isConnected).toBe(false);
    expect(doc.querySelector('[data-visual-dxp-popover]')).toBeNull();
  });

  it('cleans up the previous runtime when restarting the preview', async () => {
    await renderPreview();
    const { frame, doc } = await loadWebsite();
    const original = panel(doc);
    const restart = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Restart preview'),
    );
    if (!restart) throw new Error('Expected the restart preview button.');

    await act(async () => restart.click());
    expect(original.isConnected).toBe(false);
    expect(doc.querySelector('[data-visual-dxp-popover]')).toBeNull();
    expect(websiteFrame()).not.toBe(frame);

    const refreshed = await loadWebsite();
    expect(refreshed.doc.querySelectorAll('[data-visual-dxp-popover]')).toHaveLength(1);
  });

  it.each(['parent', 'website'] as const)(
    'closes on Escape from the %s without propagating to the builder',
    async (source) => {
      const onClose = await renderPreview();
      const { doc } = await loadWebsite();
      const builderEscape = vi.fn();
      window.addEventListener('keydown', builderEscape);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });

      try {
        await act(async () => {
          (source === 'parent' ? document.body : doc.body).dispatchEvent(event);
        });
        expect(onClose).toHaveBeenCalledOnce();
        expect(builderEscape).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener('keydown', builderEscape);
      }
    },
  );
});
