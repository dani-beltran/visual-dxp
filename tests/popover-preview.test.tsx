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

async function renderPreview(
  node = popover(),
  onClose = vi.fn(),
  websiteUrl = '/demo-site.html',
  onSave = vi.fn(),
) {
  await act(async () =>
    root.render(
      <PopoverPreview node={node} websiteUrl={websiteUrl} onClose={onClose} onSave={onSave} />,
    ),
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

function field(name: string) {
  const element = host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[id$="-${name}"]`,
  );
  if (!element) throw new Error(`Missing field ${name}`);
  return element;
}
async function editField(name: string, value: string) {
  const element = field(name);
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}
function button(name: string) {
  const element = [...host.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === name,
  );
  if (!element) throw new Error(`Missing button ${name}`);
  return element;
}
async function clickButton(name: string) {
  await act(async () => button(name).click());
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

  it('saves the animation selected in the editor sidebar only on Save', async () => {
    const onSave = vi.fn();
    await renderPreview(popover(), vi.fn(), '/demo-site.html', onSave);
    expect(field('popover-animation').value).toBe('none');
    for (const effect of ['fade', 'slide', 'zoom', 'bounce', 'none']) {
      await editField('popover-animation', effect);
      expect(field('popover-animation').value).toBe(effect);
      expect(onSave).not.toHaveBeenCalled();
    }
    await clickButton('Save changes');
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ popoverAnimation: 'none' }),
    );
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
    'offers the popover editor for $contentType content in the inspector',
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
      const expand = document.querySelector<HTMLButtonElement>('button.dxp-popover-editor-open');
      if (!expand) throw new Error('Expected the inspector fullscreen preview button.');
      expect(host.querySelector('textarea, select, input[type="number"], iframe')).toBeNull();
      expect(expand.classList.contains('dxp-button-primary')).toBe(true);
      expect(host.querySelector('button[aria-label="Open fullscreen content preview"]')).toBeNull();
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
      expect(document.querySelector('[role="dialog"][aria-label="Edit popover"]')).not.toBeNull();
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
    await renderPreview();
    const { doc } = await loadWebsite();
    const original = panel(doc);

    await editField('width', '640');
    await editField('content', '<h2>Updated offer</h2>');
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

  it('cleans up the previous runtime when refreshing the website', async () => {
    await renderPreview();
    const { frame, doc } = await loadWebsite();
    const original = panel(doc);
    const restart = Array.from(document.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Reload website',
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

describe('popover editor drafts', () => {
  it('keeps edits local and saves the complete configuration once', async () => {
    const node = popover({ selector: '#retained', iterations: 7 });
    const original = structuredClone(node);
    const save = vi.fn();
    await renderPreview(node, vi.fn(), '/demo-site.html', save);
    const { frame, doc } = await loadWebsite();
    await editField('content', '<h2>New content</h2>');
    await editField('width', '640');
    await editField('position', 'center');
    expect(websiteFrame()).toBe(frame);
    expect(panel(doc).textContent).toContain('New content');
    expect(panel(doc).style.width).toBe('640px');
    expect(panel(doc).style.left).toBe('50%');
    expect(node).toEqual(original);
    expect(save).not.toHaveBeenCalled();
    await clickButton('Save changes');
    expect(save).toHaveBeenCalledExactlyOnceWith({
      ...original.data.config,
      content: '<h2>New content</h2>',
      width: 640,
      position: 'center',
    });
  });

  it('switches desktop/mobile viewports without reloading or changing the draft', async () => {
    const save = vi.fn();
    await renderPreview(popover(), vi.fn(), '/demo-site.html', save);
    const { frame } = await loadWebsite();
    const device = host.querySelector('fieldset[aria-label="Preview device"]');
    expect(device).not.toBeNull();
    expect(button('Desktop').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[aria-label*="fullscreen" i]')).toBeNull();
    await clickButton('Mobile');
    expect(button('Mobile').getAttribute('aria-pressed')).toBe('true');
    expect(frame.parentElement?.classList.contains('dxp-popover-preview-mobile')).toBe(true);
    expect(websiteFrame()).toBe(frame);
    await clickButton('Desktop');
    expect(frame.parentElement?.classList.contains('dxp-popover-preview-mobile')).toBe(false);
    await clickButton('Save changes');
    expect(save).toHaveBeenCalledExactlyOnceWith(popover().data.config);
  });

  it('confirms dirty cancellation, keeps the draft on Escape, and discards without saving', async () => {
    const close = vi.fn(),
      save = vi.fn();
    await renderPreview(popover(), close, '/demo-site.html', save);
    await editField('content', '<h2>Draft</h2>');
    await clickButton('Cancel');
    expect(host.querySelector('dialog h2')?.textContent).toBe('Discard unsaved popover changes?');
    const builderEscape = vi.fn();
    window.addEventListener('keydown', builderEscape);
    try {
      await act(async () =>
        host.querySelector('dialog')?.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(builderEscape).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', builderEscape);
    }
    expect(host.querySelector('dialog')).toBeNull();
    expect(field('content').value).toBe('<h2>Draft</h2>');
    await clickButton('Cancel');
    await clickButton('Keep editing');
    expect(close).not.toHaveBeenCalled();
    await clickButton('Cancel');
    await clickButton('Discard changes');
    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });

  it('undoes and redoes draft changes without invoking builder history', async () => {
    await renderPreview();
    expect(button('Undo').disabled).toBe(true);
    await editField('width', '640');
    const builderUndo = vi.fn();
    window.addEventListener('keydown', builderUndo);
    try {
      await act(async () =>
        field('width').dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(builderUndo).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', builderUndo);
    }
    expect(field('width').value).toBe('420');
    await clickButton('Redo');
    expect(field('width').value).toBe('640');
    await clickButton('Undo');
    await editField('width', '520');
    expect(button('Redo').disabled).toBe(true);
  });

  it('validates iframe URLs and anchors and recovers the preview after correction', async () => {
    await renderPreview();
    const { doc } = await loadWebsite('<button id="target">Shop</button>');
    await editField('content-type', 'iframe');
    await editField('url', 'javascript:alert(1)');
    expect(button('Save changes').disabled).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('HTTP');
    await editField('url', 'https://example.com/promo');
    expect(button('Save changes').disabled).toBe(false);
    expect(panel(doc).querySelector('iframe')?.src).toBe('https://example.com/promo');
    await editField('position', 'anchor');
    expect(button('Save changes').disabled).toBe(true);
    await editField('selector', '#missing');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No elements match');
    await editField('selector', '#target');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(panel(doc)).toBeTruthy();
  });

  it('picks an anchor in the current preview and preserves the draft and mobile viewport', async () => {
    const node = popover({ position: 'anchor', selector: '#old' });
    const save = vi.fn();
    await renderPreview(node, vi.fn(), '/demo-site.html', save);
    const { frame, doc } = await loadWebsite('<a id="target" href="/shop">Shop</a>');
    await editField('width', '640');
    await clickButton('Mobile');
    await clickButton('Select on website');
    expect(host.querySelector('.dxp-popover-preview')).not.toBeNull();
    expect(host.querySelector('.dxp-picker-backdrop')).toBeNull();
    expect(websiteFrame()).toBe(frame);
    expect(button('Select on website').getAttribute('aria-pressed')).toBe('true');
    expect(button('Select on website').classList.contains('dxp-button-primary')).toBe(true);
    expect(doc.querySelector('[data-visual-dxp-popover]')).toBeNull();
    expect(doc.querySelector('[data-visual-dxp-picker]')).not.toBeNull();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => doc.querySelector('#target')?.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(field('selector').value).toBe('#target');
    expect(field('width').value).toBe('640');
    expect(button('Mobile').getAttribute('aria-pressed')).toBe('true');
    expect(button('Select on website').getAttribute('aria-pressed')).toBe('false');
    expect(button('Select on website').classList.contains('dxp-button-primary')).toBe(false);
    expect(doc.querySelector('[data-visual-dxp-picker]')).toBeNull();
    expect(panel(doc)).toBeTruthy();
    expect(websiteFrame()).toBe(frame);
    expect(node.data.config.selector).toBe('#old');
    expect(save).not.toHaveBeenCalled();
    await clickButton('Save changes');
    expect(save).toHaveBeenCalledExactlyOnceWith({
      ...node.data.config,
      selector: '#target',
      width: 640,
    });
  });
});

it.each(['parent', 'website', 'button'] as const)(
  'cancels inline picking from the %s without closing the editor or losing the draft',
  async (source) => {
    const close = vi.fn();
    await renderPreview(popover({ position: 'anchor', selector: '#old' }), close);
    const { frame, doc } = await loadWebsite('<button id="old">Shop</button>');
    await editField('width', '640');
    await clickButton('Select on website');
    const builderKey = vi.fn();
    window.addEventListener('keydown', builderKey);
    try {
      if (source === 'button') await clickButton('Select on website');
      else
        await act(async () => {
          const init = { key: 'Escape', bubbles: true, cancelable: true };
          (source === 'parent' ? button('Cancel') : doc.body).dispatchEvent(
            new KeyboardEvent('keydown', init),
          );
        });
      expect(builderKey).not.toHaveBeenCalled();
      expect(field('width').value).toBe('640');
      expect(field('selector').value).toBe('#old');
      expect(button('Select on website').getAttribute('aria-pressed')).toBe('false');
      expect(doc.querySelector('[data-visual-dxp-picker]')).toBeNull();
      expect(websiteFrame()).toBe(frame);
      expect(close).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', builderKey);
    }
  },
);

it('uses the page editor heading layout and places refresh and divider beside device controls', async () => {
  await renderPreview();
  expect(
    host.querySelector('.dxp-popover-preview-heading .dxp-editor-title-icon .lucide-panel-top'),
  ).not.toBeNull();
  expect(host.querySelector('.dxp-popover-preview-heading h2')?.textContent).toBe('Edit popover');
  expect(host.querySelector('.dxp-popover-preview-heading p')?.textContent).toBe(
    'Customize your popover’s content, appearance, and position, and preview it on your website.',
  );
  expect(host.querySelector('.dxp-popover-preview-header')?.textContent).not.toContain('Restart');
  const toggle = host.querySelector('.dxp-editor-device-toggle');
  expect(toggle?.nextElementSibling?.getAttribute('aria-label')).toBe('Reload website');
  expect(toggle?.parentElement?.nextElementSibling?.classList.contains('dxp-toolbar-divider')).toBe(
    true,
  );
  expect(
    toggle?.parentElement?.nextElementSibling?.nextElementSibling?.classList.contains(
      'dxp-popover-editor-history',
    ),
  ).toBe(true);
});

it('cleans up inline picking when refreshing and preserves draft settings and device choice', async () => {
  await renderPreview(popover({ position: 'anchor', selector: '#target' }));
  const { frame, doc } = await loadWebsite('<button id="target">Shop</button>');
  await editField('width', '640');
  await clickButton('Mobile');
  await clickButton('Select on website');
  expect(doc.querySelector('[data-visual-dxp-picker]')).not.toBeNull();
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Reload website"]')?.click(),
  );
  expect(frame.isConnected).toBe(false);
  expect(websiteFrame()).not.toBe(frame);
  expect(field('width').value).toBe('640');
  expect(button('Mobile').getAttribute('aria-pressed')).toBe('true');
  expect(button('Select on website').getAttribute('aria-pressed')).toBe('false');
  const fresh = await loadWebsite('<button id="target">Shop</button>');
  expect(fresh.doc.querySelector('[data-visual-dxp-picker]')).toBeNull();
  expect(panel(fresh.doc).style.width).toBe('640px');
  expect(button('Select on website').disabled).toBe(false);
});

it('ignores spoofed and inactive selection messages', async () => {
  await renderPreview(popover({ position: 'anchor', selector: '#target' }));
  const { frame } = await loadWebsite('<button id="target">Shop</button>');
  const win = frame.contentWindow;
  if (!win) throw new Error('Missing preview window');
  const init = vi.mocked(win.postMessage).mock.calls.find(([data]) => data.type === 'init')?.[0];
  if (!init) throw new Error('Missing preview handshake');
  const selection = {
    protocol: init.protocol,
    channel: init.channel,
    type: 'pick-element',
    selector: '#spoofed',
  };
  const message = async (
    data: typeof selection,
    source: MessageEventSource | null = win,
    origin = 'null',
  ) => act(async () => window.dispatchEvent(new MessageEvent('message', { data, source, origin })));
  await message(selection);
  expect(field('selector').value).toBe('#target');
  await clickButton('Select on website');
  await message({ ...selection, channel: 'wrong-channel' });
  await message(selection, window);
  await message(selection, win, 'https://evil.example');
  await message({ ...selection, selector: 'x'.repeat(4001) });
  expect(field('selector').value).toBe('#target');
  expect(button('Select on website').getAttribute('aria-pressed')).toBe('true');
});
