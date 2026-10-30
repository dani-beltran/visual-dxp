// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { rewriteHtml, rewriteImportMap } from '../../src/server/preview/rewrite';
import { readSession, SESSION_DURATION, upstreamUrl } from '../../src/server/preview/tokens';

const config = {
  editorOrigin: 'http://localhost:3000',
  proxyOrigin: 'http://127.0.0.1:3000',
  secret: 'test-only-signing-key-at-least-32-characters',
};
const session = {
  origin: 'https://nuxt.example',
  editor: config.editorOrigin,
  expires: Date.now() + SESSION_DURATION,
  kind: 'document' as const,
};
function decode(url: string) {
  const token = new URL(url).pathname.split('/')[4];
  const claims = readSession(token, config);
  return { claims, url: upstreamUrl(new Request(url), token, claims).href };
}

it('detects a Nuxt document and passes signed roots to the bridge before upstream scripts', () => {
  const source = `<html><head><script type="importmap">{"imports":{"#entry":"/_nuxt/entry.js"}}</script><script type="module" src="/_nuxt/entry.js"></script><link rel="modulepreload" href="https://cdn.example/chunk.js"></head><body><div id="__nuxt"></div><script>window.__NUXT__={};window.__NUXT__.config={app:{baseURL:"/",buildAssetsDir:"/_nuxt/",cdnURL:""}}</script><script id="__NUXT_DATA__" type="application/json" data-ssr="false">[{"serverRendered":1},false]</script></body></html>`;
  const html = rewriteHtml(source, new URL('https://nuxt.example/'), session, config, 'test-nonce');
  const document = new DOMParser().parseFromString(html, 'text/html');
  const bridge = document.querySelector('script');
  if (!bridge) throw new Error('Missing bridge');
  expect(bridge.src).toBe(`${config.proxyOrigin}/bridge.js`);
  const options = JSON.parse(bridge.getAttribute('data-nuxt-preview') || '{}');
  expect(options.targetUrl).toBe('https://nuxt.example/');
  expect(decode(options.documentRoot)).toMatchObject({
    url: 'https://nuxt.example/',
    claims: { kind: 'document', expires: session.expires },
  });
  for (const [origin, root] of Object.entries(options.assetRoots))
    expect(decode(root as string)).toMatchObject({
      url: `${origin}/`,
      claims: { kind: 'asset', expires: session.expires },
    });
  const importMap = document.querySelector('script[type="importmap"]');
  expect(importMap?.getAttribute('nonce')).toBe('test-nonce');
  const map = JSON.parse(importMap?.textContent || '{}');
  expect(decode(map.imports['#entry'])).toMatchObject({
    url: 'https://nuxt.example/_nuxt/entry.js',
    claims: { kind: 'asset' },
  });
  expect(html).toContain('baseURL:"/"'); // No replacements inside arbitrary upstream JavaScript.
});

it('leaves framework workarounds off ordinary documents', () => {
  const html = rewriteHtml(
    '<html><head></head><body id="__nuxt">Regular page</body></html>',
    new URL(session.origin),
    session,
    config,
    'nonce',
  );
  expect(html).not.toContain('data-nuxt-preview');
});

it('rewrites import-map scopes, URL keys and addresses while preserving bare specifiers and null entries', () => {
  const source = JSON.stringify({
    imports: {
      '#entry': '/_nuxt/entry.js',
      'pkg/': './modules/',
      './local.js': '/replacement.js',
      blocked: null,
    },
    scopes: { '/scope/': { pkg: 'https://cdn.example/pkg.js' } },
    integrity: { '/replacement.js': 'hash' },
  });
  const map = JSON.parse(rewriteImportMap(source, (value) => `https://proxy.example${value}`));
  expect(map.imports).toEqual({
    '#entry': 'https://proxy.example/_nuxt/entry.js',
    'pkg/': 'https://proxy.example./modules/',
    'https://proxy.example./local.js': 'https://proxy.example/replacement.js',
    blocked: null,
  });
  expect(map.scopes['https://proxy.example/scope/'].pkg).toBe(
    'https://proxy.examplehttps://cdn.example/pkg.js',
  );
  expect(map.integrity).toBeUndefined();
});

it('retains malformed import maps and escapes script terminators in rewritten JSON', () => {
  expect(rewriteImportMap('not json', (value) => value)).toBe('not json');
  expect(rewriteImportMap('null', (value) => value)).toBe('null');
  expect(rewriteImportMap('{"imports":{"bad":"</script>"}}', (value) => value)).not.toContain(
    '</script>',
  );
});
