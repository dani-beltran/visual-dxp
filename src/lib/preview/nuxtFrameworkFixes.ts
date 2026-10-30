import { installSandboxStorage } from './sandboxStorage';

/**
 * Nuxt framework workarounds for the public website preview proxy.
 * Nuxt reads runtime config and location.pathname rather than the injected <base>.
 * Install before upstream scripts, only on detected Nuxt documents. Never enable
 * same-origin sandbox access or persist upstream cookies/storage to make it work.
 */
export interface NuxtPreviewOptions {
  targetUrl: string;
  documentRoot: string;
  assetRoots: Record<string, string>;
}

type RuntimeConfig = { app?: Record<string, string> };
type NuxtPayload = { config?: RuntimeConfig };

export function installNuxtFrameworkFixes(options: NuxtPreviewOptions, win: Window = window) {
  const target = new URL(options.targetUrl);
  const documentRoot = new URL(options.documentRoot);
  const assetRoot = options.assetRoots[target.origin];
  if (!assetRoot) return;
  // Nuxt plugins often read storage during setup; an opaque origin throws even
  // on reads. Document-local substitutes preserve isolation and allow startup.
  installSandboxStorage(win);
  const assetUrl = (value: string) => {
    const url = new URL(value, target);
    const root = options.assetRoots[url.origin];
    return root ? `${root.slice(0, -1)}${url.pathname}${url.search}${url.hash}` : url.href;
  };
  const adaptedApps = new WeakSet<object>();
  const adaptConfig = (config: RuntimeConfig | undefined) => {
    if (!config?.app || adaptedApps.has(config.app)) return config;
    const app = config.app;
    adaptedApps.add(app);
    const base = new URL(app.baseURL || '/', target.origin);
    // The router needs a pathname; assets need absolute CORS-enabled proxy URLs.
    app.baseURL = `${documentRoot.pathname.slice(0, -1)}${base.pathname}`;
    app.cdnURL = assetUrl(app.cdnURL || base.href);
    return config;
  };
  const adaptPayload = (payload: NuxtPayload | undefined) => {
    if (!payload || typeof payload !== 'object') return payload;
    let config = adaptConfig(payload.config);
    Object.defineProperty(payload, 'config', {
      configurable: true,
      enumerable: true,
      get: () => config,
      set: (value) => {
        config = adaptConfig(value);
      },
    });
    return payload;
  };
  const nuxtWindow = win as Window & { __NUXT__?: NuxtPayload };
  let payload = adaptPayload(nuxtWindow.__NUXT__);
  Object.defineProperty(nuxtWindow, '__NUXT__', {
    configurable: true,
    enumerable: true,
    get: () => payload,
    set: (value) => {
      payload = adaptPayload(value);
    },
  });

  // ofetch/$fetch constructs requests at runtime (for example apiBase: '/api').
  // Route public reads for known, server-signed origins. Other origins and write
  // traffic retain their existing behavior; the proxy still accepts GET/HEAD only.
  const fetch = win.fetch.bind(win);
  win.fetch = (input, init) => {
    const method = (
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return fetch(input, init);
    const value = input instanceof Request ? input.url : String(input);
    const url = new URL(value, target);
    // Already proxied URLs must never acquire a second capability prefix.
    if (url.origin === documentRoot.origin && url.pathname.startsWith('/api/preview/content/'))
      return fetch(input, init);
    // Root-relative requests can have been resolved against the proxy by Request/ofetch.
    if (url.origin === documentRoot.origin) {
      url.host = target.host;
      url.protocol = target.protocol;
    }
    const mapped = assetUrl(url.href);
    if (mapped === url.href) return fetch(input, init);
    return fetch(input instanceof Request ? new Request(mapped, input) : mapped, {
      ...init,
      credentials: 'omit',
    });
  };
}
