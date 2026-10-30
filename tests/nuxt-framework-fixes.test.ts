import { describe, expect, it, vi } from 'vitest';
import { installNuxtFrameworkFixes } from '../src/lib/preview/nuxtFrameworkFixes';

const documentRoot = 'https://preview.example/api/preview/content/document/';
const assetRoot = 'https://preview.example/api/preview/content/asset/';
const options = {
  targetUrl: 'https://site.example/catalog/item?x=1',
  documentRoot,
  assetRoots: { 'https://site.example': assetRoot },
};
function browser() {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  const win = { fetch } as unknown as Window & {
    __NUXT__?: {
      config?: {
        public?: { apiBase: string };
        app: { baseURL: string; buildAssetsDir: string; cdnURL: string };
      };
    };
  };
  return { win, fetch };
}
const config = (baseURL = '/') => ({
  public: { apiBase: '/api' },
  app: { baseURL, buildAssetsDir: '/_nuxt/', cdnURL: '' },
});

describe('Nuxt preview framework workarounds', () => {
  it('adapts config assigned after the bridge before Nuxt starts, without changing public settings', () => {
    const { win } = browser();
    installNuxtFrameworkFixes(options, win);
    win.__NUXT__ = {};
    win.__NUXT__.config = config();
    expect(win.__NUXT__.config).toEqual({
      public: { apiBase: '/api' },
      app: {
        baseURL: '/api/preview/content/document/',
        buildAssetsDir: '/_nuxt/',
        cdnURL: assetRoot,
      },
    });
    // Nuxt normalizes/reassigns its payload; shared config must not be prefixed twice.
    win.__NUXT__ = { config: win.__NUXT__.config };
    expect(win.__NUXT__.config?.app.baseURL).toBe('/api/preview/content/document/');
  });

  it('adapts existing config and supports Nuxt deployed below a subpath', () => {
    const { win } = browser();
    win.__NUXT__ = { config: config('/store/') };
    installNuxtFrameworkFixes(options, win);
    expect(win.__NUXT__.config?.app).toMatchObject({
      baseURL: '/api/preview/content/document/store/',
      cdnURL: `${assetRoot}store/`,
    });
  });

  it('uses server-signed CDN roots when available and preserves unknown external CDN URLs', () => {
    const { win } = browser();
    installNuxtFrameworkFixes(
      {
        ...options,
        assetRoots: {
          ...options.assetRoots,
          'https://cdn.example': 'https://preview.example/api/preview/content/cdn/',
        },
      },
      win,
    );
    const first = config();
    first.app.cdnURL = 'https://cdn.example/releases/';
    win.__NUXT__ = { config: first };
    expect(first.app.cdnURL).toBe('https://preview.example/api/preview/content/cdn/releases/');
    const second = config();
    second.app.cdnURL = 'https://unknown.example/releases/';
    win.__NUXT__ = { config: second };
    expect(second.app.cdnURL).toBe('https://unknown.example/releases/');
  });

  it('proxies relative and absolute public reads with their queries and cancels credentials', async () => {
    const { win, fetch } = browser();
    installNuxtFrameworkFixes(options, win);
    const controller = new AbortController();
    await win.fetch('/api/cards?q=one', { signal: controller.signal, credentials: 'include' });
    expect(fetch).toHaveBeenLastCalledWith(`${assetRoot}api/cards?q=one`, {
      signal: controller.signal,
      credentials: 'omit',
    });
    await win.fetch(new URL('https://site.example/api/cards?q=two'), { method: 'HEAD' });
    expect(fetch).toHaveBeenLastCalledWith(`${assetRoot}api/cards?q=two`, {
      method: 'HEAD',
      credentials: 'omit',
    });
    await win.fetch('details');
    expect(fetch).toHaveBeenLastCalledWith(`${assetRoot}catalog/details`, { credentials: 'omit' });
  });

  it('preserves Request headers and signals when a request has already resolved against the proxy origin', async () => {
    const { win, fetch } = browser();
    installNuxtFrameworkFixes(options, win);
    const controller = new AbortController();
    const input = new Request('https://preview.example/api/cards?x=1', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    await win.fetch(input);
    const [request, init] = fetch.mock.lastCall || [];
    if (!request || !init) throw new Error('Expected a fetch request');
    expect(request.url).toBe(`${assetRoot}api/cards?x=1`);
    expect(request.headers.get('Accept')).toBe('application/json');
    expect(init.credentials).toBe('omit');
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });

  it('does not double-proxy URLs, redirect unknown origins, or intercept writes', async () => {
    const { win, fetch } = browser();
    installNuxtFrameworkFixes(options, win);
    for (const value of [
      `${assetRoot}_nuxt/entry.js`,
      `${documentRoot}page`,
      'https://other.example/api',
      'data:application/json,{}',
    ]) {
      await win.fetch(value);
      expect(fetch).toHaveBeenLastCalledWith(value, undefined);
    }
    const init = { method: 'POST', body: 'payload' };
    await win.fetch('/api/save', init);
    expect(fetch).toHaveBeenLastCalledWith('/api/save', init);
  });
});
