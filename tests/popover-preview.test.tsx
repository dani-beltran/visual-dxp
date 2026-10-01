// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector';
import { PopoverPreview } from '../src/components/PopoverPreview';
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

async function renderPreview(node = popover(), onClose = vi.fn()) {
  await act(async () => root.render(<PopoverPreview node={node} onClose={onClose} />));
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
  it('reports a missing preview bridge instead of loading forever', async () => {
    vi.useFakeTimers();
    await renderPreview(popover(), vi.fn(), 'https://example.com');
    await act(async () => vi.advanceTimersByTime(8000));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('preview-bridge.js');
    expect(document.querySelector('.dxp-popover-preview-loading')).toBeNull();
  });

  it('connects when the bridge is installed after the iframe load and stops retrying', async () => {
    vi.useFakeTimers();
    await renderPreview(popover(), vi.fn(), 'https://example.com');
    const frame = websiteFrame();
    await act(async () => frame.dispatchEvent(new Event('load')));
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Expected the website document.');
    doc.open();
    doc.write('<html><body><h1>Website</h1></body></html>');
    doc.close();
    connectPreview(frame);
    await act(async () => vi.advanceTimersByTime(1000));
    const original = panel(doc);
    await act(async () => vi.advanceTimersByTime(9000));
    expect(panel(doc)).toBe(original);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(['', '   ', '/demo-site.html'])('uses the demo when the site is %j', async (url) => {
    await renderPreview(popover(), vi.fn(), url);
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

  it('positions relative to the selected website element and follows scrolling', async () => {
    await renderPreview(popover({ position: 'anchor', selector: '#shop-now' }));
    const frame = websiteFrame();
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Expected the preview website document.');
    if (!doc.documentElement) doc.appendChild(doc.createElement('html'));
    if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
    doc.body.innerHTML = '<button id="shop-now">Shop the collection</button>';
    const anchor = doc.querySelector<HTMLElement>('#shop-now');
    if (!anchor) throw new Error('Expected the demo anchor.');
    let top = 140;
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
    expect(panel(doc).style.top).toBe('192px');

    top = 80;
    await act(async () => frame.contentWindow?.dispatchEvent(new Event('scroll')));
    expect(panel(doc).style.top).toBe('132px');
  });

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
