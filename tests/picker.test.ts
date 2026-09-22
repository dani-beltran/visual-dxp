// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElementPicker } from '../src/components/ElementPicker';
import {
  attachElementPicker,
  escapeCss,
  getElementSelector,
  normalizeWebsiteUrl,
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
    expect(document.querySelector('[data-dlb-dxp-picker]')).toBeNull();
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
    const outline = document.querySelector<HTMLElement>('[data-dlb-dxp-picker] > div:last-child')!;
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

  it('reattaches on same-origin iframe navigation and cleans the previous document', async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const oldPage = document.createElement('iframe');
    document.body.appendChild(oldPage);
    const nextPage = document.createElement('iframe');
    document.body.appendChild(nextPage);
    const oldDoc = oldPage.contentDocument!;
    const nextDoc = nextPage.contentDocument!;
    oldDoc.body.innerHTML = '<button id="target">Old page</button>';
    nextDoc.body.innerHTML = '<button id="target">Next page</button>';
    await act(async () => {
      root.render(
        createElement(ElementPicker, {
          url: '/demo-site.html',
          initialSelector: '#target',
          onSelect: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });
    const preview = host.querySelector('iframe')!;
    const documentGetter = vi.spyOn(preview, 'contentDocument', 'get').mockReturnValue(oldDoc);
    vi.spyOn(preview, 'contentWindow', 'get').mockReturnValue({
      location: { href: 'http://localhost/demo-site.html' },
      postMessage: vi.fn(),
    } as unknown as Window);
    await act(async () => {
      preview.dispatchEvent(new Event('load'));
    });
    expect(oldDoc.querySelector('[data-dlb-dxp-picker]')).not.toBeNull();
    expect(host.textContent).toContain('Selection mode is on');
    documentGetter.mockReturnValue(nextDoc);
    await act(async () => {
      preview.dispatchEvent(new Event('load'));
    });
    expect(oldDoc.querySelector('[data-dlb-dxp-picker]')).toBeNull();
    expect(nextDoc.querySelector('[data-dlb-dxp-picker]')).not.toBeNull();
    expect(
      nextDoc.querySelector<HTMLElement>('[data-dlb-dxp-picker] > div:last-child')!.style.display,
    ).toBe('block');
    documentGetter.mockReturnValue(null);
    await act(async () => {
      preview.dispatchEvent(new Event('load'));
    });
    expect(nextDoc.querySelector('[data-dlb-dxp-picker]')).toBeNull();
    expect(host.textContent).toContain('Connecting to website');
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(host.textContent).toContain('Connection required');
    await act(async () => {
      root.unmount();
    });
    expect(nextDoc.querySelector('[data-dlb-dxp-picker]')).toBeNull();
  });
});

describe('cross-origin picker bridge', () => {
  it('requires the configured parent origin, source window, and active channel', () => {
    document.body.innerHTML = '<button id="shop-now">Shop now</button>';
    const script = document.createElement('script');
    script.dataset.parentOrigin = 'https://editor.example';
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    const parent = { postMessage: vi.fn() };
    let receive: (event: unknown) => void = () => undefined;
    const bridgeWindow = {
      parent,
      addEventListener: (type: string, callback: (event: unknown) => void) => {
        if (type === 'message') receive = callback;
      },
      removeEventListener: vi.fn(),
    };
    const source = readFileSync('public/picker-bridge.js', 'utf8');
    new Function('window', 'document', 'URL', source)(bridgeWindow, document, URL);
    const init = { protocol: 'dlb-dxp:element-picker', channel: 'editor-session', type: 'init' };
    receive({ origin: 'https://untrusted.example', source: parent, data: init });
    receive({ origin: 'https://editor.example', source: {}, data: init });
    expect(parent.postMessage).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dlb-dxp-picker]')).toBeNull();

    receive({ origin: 'https://editor.example', source: parent, data: init });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { protocol: 'dlb-dxp:element-picker', channel: 'editor-session', type: 'ready' },
      'https://editor.example',
    );
    expect(document.querySelector('[data-dlb-dxp-picker]')).not.toBeNull();
    document
      .querySelector('button')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      {
        protocol: 'dlb-dxp:element-picker',
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
    const outline = document.querySelector<HTMLElement>('[data-dlb-dxp-picker] > div:last-child')!;
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
    expect(document.querySelector('[data-dlb-dxp-picker]')).not.toBeNull();
    receive({ origin: 'https://editor.example', source: parent, data: { ...init, type: 'stop' } });
    expect(document.querySelector('[data-dlb-dxp-picker]')).toBeNull();
  });
});
