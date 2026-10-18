// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElementPicker } from '../src/components/ElementPicker/ElementPicker';
import {
  attachElementPicker,
  escapeCss,
  getElementSelector,
  normalizeWebsiteUrl,
  PICKER_PROTOCOL,
} from '../src/lib/picker';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('website element selection', () => {
  it('uses a stable unique ID and escapes CSS metacharacters', () => {
    document.body.innerHTML = '<main><button id="buy:now">Buy now</button></main>';
    const target = document.querySelector('button')!;
    const selector = getElementSelector(target);
    expect(selector).toBe('#buy\\:now');
    expect(document.querySelector(selector)).toBe(target);
    expect(escapeCss('12-test')).toBe('\\31 2-test');
  });

  it('distinguishes repeated elements and duplicate IDs', () => {
    document.body.innerHTML =
      '<main id="products"><section><button id="buy">First</button></section><section><button id="buy">Second</button></section></main>';
    const targets = document.querySelectorAll('button');
    expect(getElementSelector(targets[0])).not.toBe(getElementSelector(targets[1]));
    expect(document.querySelector(getElementSelector(targets[1]))).toBe(targets[1]);
  });

  it('prefers a stable test ID when present', () => {
    document.body.innerHTML =
      '<button data-testid="checkout">Checkout</button><button>Other</button>';
    expect(getElementSelector(document.querySelector('button')!)).toBe('[data-testid="checkout"]');
  });

  it('reports hovered and selected elements while stopping site click actions, then cleans up', () => {
    document.body.innerHTML = '<a id="shop-now" href="/checkout">Shop now</a>';
    const hover = vi.fn();
    const select = vi.fn();
    const navigate = vi.fn((event: Event) => event.preventDefault());
    const target = document.querySelector('a')!;
    target.addEventListener('click', navigate);
    const session = attachElementPicker(document, hover, select);
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(hover).toHaveBeenCalledWith({ selector: '#shop-now', tagName: 'a', text: 'Shop now' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    target.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith({ selector: '#shop-now', tagName: 'a', text: 'Shop now' });
    expect(session.select('[')).toBe(false);
    expect(session.select('#shop-now')).toBe(true);
    session.destroy();
    expect(document.querySelector('[data-visual-dxp-picker]')).toBeNull();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('accepts http(s) pages and rejects executable or credential-bearing URLs', () => {
    expect(normalizeWebsiteUrl('/demo-site.html', 'https://editor.example/')).toBe(
      'https://editor.example/demo-site.html',
    );
    expect(() => normalizeWebsiteUrl('javascript:alert(1)', 'https://editor.example/')).toThrow();
    expect(() => normalizeWebsiteUrl('data:text/html,hello', 'https://editor.example/')).toThrow();
    expect(() =>
      normalizeWebsiteUrl('https://user:password@example.com', 'https://editor.example/'),
    ).toThrow();
    expect(() => normalizeWebsiteUrl('   ', 'https://editor.example/')).toThrow();
  });

  it('keeps the selected outline aligned when scrolling and clears invalid selections', () => {
    document.body.innerHTML = '<button id="target">Target</button>';
    const target = document.querySelector('button')!;
    let top = 120;
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(
      () => ({ left: 30, top, width: 100, height: 40 }) as DOMRect,
    );
    const session = attachElementPicker(document, vi.fn(), vi.fn());
    session.select('#target');
    const outline = document.querySelector<HTMLElement>(
      '[data-visual-dxp-picker] > div:last-child',
    )!;
    expect(outline.style.top).toBe('120px');
    expect(outline.style.display).toBe('block');
    top = 55;
    document.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new MouseEvent('mouseleave'));
    expect(outline.style.top).toBe('55px');
    expect(outline.style.display).toBe('block');
    session.select('[');
    expect(outline.style.display).toBe('none');
    session.destroy();
  });

  it('isolates even same-origin pages and validates the bridge source, origin and fresh navigation channel', async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        createElement(ElementPicker, {
          url: 'https://preview.test',
          onSelect: vi.fn(),
          onClose: vi.fn(),
        }),
      ),
    );
    expect(host.querySelector('.dxp-picker-backdrop-fullscreen')).not.toBeNull();
    expect(host.querySelector('[aria-label="Enter fullscreen"]')).toBeNull();
    expect(host.querySelector('[aria-label="Exit fullscreen"]')).toBeNull();
    const toolbar = host.querySelector('.dxp-website-preview-toolbar')!;
    expect(toolbar.textContent).toContain('https://preview.test');
    expect(toolbar.querySelector('[aria-label="Reload website"]')).not.toBeNull();
    expect(toolbar.textContent).not.toMatch(/Selection mode|Hover to inspect|Website setup/);
    const devices = Array.from(toolbar.querySelectorAll('button'));
    const mobile = devices.find((button) => button.textContent === 'Mobile')!;
    const desktop = devices.find((button) => button.textContent === 'Desktop')!;
    await act(async () => mobile.click());
    expect(mobile.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.dxp-picker-frame-wrap-mobile')).not.toBeNull();
    await act(async () => desktop.click());
    expect(desktop.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.dxp-picker-frame-wrap-mobile')).toBeNull();
    const preview = host.querySelector('iframe')!;
    const post = vi.spyOn(preview.contentWindow!, 'postMessage').mockImplementation(() => {});
    const access = vi.spyOn(preview, 'contentDocument', 'get');
    await act(async () => preview.dispatchEvent(new Event('load')));
    expect(preview.getAttribute('sandbox')).toBe('allow-scripts');
    expect(access).not.toHaveBeenCalled();
    const first = post.mock.calls.at(-1)![0];
    const receive = async (origin: string, source: Window | null, channel = first.channel) =>
      act(async () =>
        window.dispatchEvent(
          new MessageEvent('message', {
            origin,
            source,
            data: { protocol: first.protocol, channel, type: 'ready' },
          }),
        ),
      );
    await receive('https://preview.test', preview.contentWindow);
    expect(host.querySelector('.dxp-picker-connecting')).not.toBeNull();
    await receive('null', window);
    expect(host.querySelector('.dxp-picker-connecting')).not.toBeNull();
    await receive('null', preview.contentWindow, 'wrong');
    expect(host.querySelector('.dxp-picker-connecting')).not.toBeNull();
    await receive('null', preview.contentWindow);
    expect(host.querySelector('.dxp-picker-connecting')).toBeNull();
    await act(async () => preview.dispatchEvent(new Event('load')));
    expect(post.mock.calls.at(-1)![0].channel).not.toBe(first.channel);
    await receive('null', preview.contentWindow);
    expect(host.querySelector('.dxp-picker-connecting')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(8000));
    expect(host.querySelector('.dxp-picker-help-unavailable')).not.toBeNull();
    await act(async () => root.unmount());
    expect(post.mock.calls.at(-1)![0].type).toBe('stop');
    host.remove();
  });

  it.each(['timeout', 'error'])(
    'replaces a failed iframe after %s and reconnects on retry',
    async (failure) => {
      vi.useFakeTimers();
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () =>
        root.render(
          createElement(ElementPicker, {
            url: 'https://preview.test',
            initialSelector: '#shop-now',
            onSelect: vi.fn(),
            onClose: vi.fn(),
          }),
        ),
      );
      try {
        const frame = host.querySelector('iframe')!;
        await act(async () => {
          if (failure === 'timeout') vi.advanceTimersByTime(8000);
          else frame.dispatchEvent(new Event('error'));
        });
        expect(host.querySelector('iframe')).toBeNull();
        expect(host.querySelectorAll('.dxp-website-setup')).toHaveLength(1);
        expect(host.querySelector('.dxp-picker-frame-wrap .dxp-website-setup')).not.toBeNull();
        expect(
          host.querySelector<HTMLInputElement>('.dxp-picker-selector-field input')!.value,
        ).toBe('#shop-now');

        await act(async () => {
          host.querySelector<HTMLButtonElement>('[aria-label="Reload website"]')!.click();
        });
        const retry = host.querySelector('iframe')!;
        expect(retry).not.toBeNull();
        expect(retry).not.toBe(frame);
        expect(host.querySelector('.dxp-website-setup')).toBeNull();
        const post = vi.spyOn(retry.contentWindow!, 'postMessage').mockImplementation(() => {});
        await act(async () => retry.dispatchEvent(new Event('load')));
        const init = post.mock.calls.at(-1)![0];
        await act(async () => {
          window.dispatchEvent(
            new MessageEvent('message', {
              origin: 'null',
              source: retry.contentWindow,
              data: { protocol: PICKER_PROTOCOL, channel: init.channel, type: 'ready' },
            }),
          );
        });
        expect(host.querySelector('.dxp-picker-connecting')).toBeNull();
        await act(async () => vi.advanceTimersByTime(8000));
        expect(host.querySelector('iframe')).toBe(retry);
      } finally {
        await act(async () => root.unmount());
        host.remove();
      }
    },
  );
});

describe('cross-origin picker bridge', () => {
  it('requires the configured parent origin, source window, and active channel', () => {
    document.body.innerHTML = '<button id="shop-now">Shop now</button>';
    const script = document.createElement('script');
    script.dataset.parentOrigin = 'https://editor.example';
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    const parent = { postMessage: vi.fn() };
    const receivers: ((event: unknown) => void)[] = [];
    const receive = (event: unknown) => {
      for (const callback of receivers) callback(event);
    };
    const bridgeWindow = {
      parent,
      addEventListener: (type: string, callback: (event: unknown) => void) => {
        if (type === 'message') receivers.push(callback);
      },
      removeEventListener: vi.fn(),
    };
    const source = readFileSync('public/bridge.js', 'utf8');
    new Function('window', 'document', 'URL', source)(bridgeWindow, document, URL);
    const previewInit = {
      protocol: 'visual-dxp:preview',
      channel: 'preview-session',
      type: 'init',
    };
    receive({ origin: 'https://untrusted.example', source: parent, data: previewInit });
    receive({ origin: 'https://editor.example', source: {}, data: previewInit });
    expect(parent.postMessage).not.toHaveBeenCalled();
    receive({ origin: 'https://editor.example', source: parent, data: previewInit });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { ...previewInit, type: 'ready', elementPicking: true },
      'https://editor.example',
    );
    parent.postMessage.mockClear();
    const init = { protocol: 'visual-dxp:element-picker', channel: 'editor-session', type: 'init' };
    receive({ origin: 'https://untrusted.example', source: parent, data: init });
    receive({ origin: 'https://editor.example', source: {}, data: init });
    expect(parent.postMessage).not.toHaveBeenCalled();
    expect(document.querySelector('[data-visual-dxp-picker]')).toBeNull();

    receive({ origin: 'https://editor.example', source: parent, data: init });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { protocol: 'visual-dxp:element-picker', channel: 'editor-session', type: 'ready' },
      'https://editor.example',
    );
    expect(document.querySelector('[data-visual-dxp-picker]')).not.toBeNull();
    document
      .querySelector('button')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      {
        protocol: 'visual-dxp:element-picker',
        channel: 'editor-session',
        type: 'select',
        element: { selector: '#shop-now', tagName: 'button', text: 'Shop now' },
      },
      'https://editor.example',
    );

    // Run the actual standalone bridge against nested, repeated and test-id elements.
    document.body.innerHTML =
      '<main><section><button>First</button></section><section><button>Second</button></section><button data-testid="checkout">Checkout</button></main>';
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const target of buttons) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const result = parent.postMessage.mock.lastCall![0];
      expect(result.type).toBe('select');
      expect(document.querySelector(result.element.selector)).toBe(target);
      expect(document.querySelectorAll(result.element.selector)).toHaveLength(1);
    }
    expect(parent.postMessage.mock.lastCall![0].element.selector).toBe('[data-testid="checkout"]');
    const checkout = buttons[2];
    let top = 180;
    vi.spyOn(checkout, 'getBoundingClientRect').mockImplementation(
      () => ({ left: 20, top, width: 80, height: 25 }) as DOMRect,
    );
    document.dispatchEvent(new Event('scroll'));
    const outline = document.querySelector<HTMLElement>(
      '[data-visual-dxp-picker] > div:last-child',
    )!;
    expect(outline.style.top).toBe('180px');
    top = 70;
    document.dispatchEvent(new Event('scroll'));
    expect(outline.style.top).toBe('70px');
    expect(outline.style.display).toBe('block');
    receive({
      origin: 'https://editor.example',
      source: parent,
      data: { ...init, type: 'set-selector', selector: '[' },
    });
    expect(outline.style.display).toBe('none');

    receive({
      origin: 'https://editor.example',
      source: parent,
      data: { ...init, type: 'stop', channel: 'another-session' },
    });
    expect(document.querySelector('[data-visual-dxp-picker]')).not.toBeNull();
    receive({ origin: 'https://editor.example', source: parent, data: { ...init, type: 'stop' } });
    expect(document.querySelector('[data-visual-dxp-picker]')).toBeNull();
  });
});
