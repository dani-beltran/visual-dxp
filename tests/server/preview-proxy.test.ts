import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPreviewHost, PreviewError, previewConfig } from '../../src/server/preview/config';
import { createPreviewSession, servePreview } from '../../src/server/preview/http';
import { isPublicAddress, publicAddresses } from '../../src/server/preview/network';
import { rewriteCsp, rewriteCss, rewriteHtml } from '../../src/server/preview/rewrite';
import {
  proxyUrl,
  readSession,
  SESSION_DURATION,
  signSession,
  targetUrl,
  upstreamUrl,
} from '../../src/server/preview/tokens';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup }));

beforeEach(() => {
  vi.stubEnv('PREVIEW_EDITOR_ORIGIN', 'http://localhost:3000');
  vi.stubEnv('PREVIEW_PROXY_ORIGIN', 'http://127.0.0.1:3000');
  vi.stubEnv('PREVIEW_PROXY_SECRET', 'test-only-signing-key-at-least-32-characters');
  lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const session = () => ({
  origin: 'https://shop.example',
  editor: 'http://localhost:3000',
  expires: Date.now() + SESSION_DURATION,
  kind: 'document' as const,
});
const create = (url = 'https://shop.example/products?sort=new#items') =>
  new Request('http://localhost:3000/api/preview/sessions', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
const fixture = (html = '<html><head></head><body><h1 id="hero">Welcome</h1></body></html>') => ({
  status: 200,
  headers: new Headers({
    'Content-Type': 'text/html',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; frame-ancestors 'none', frame-ancestors 'none'",
    'Set-Cookie': 'secret=upstream',
    'Content-Length': '1',
    ETag: 'original',
  }),
  body: Buffer.from(html),
});

it('logs preview server failures while keeping client errors quiet', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const token = signSession(session(), previewConfig());
  const request = new Request(`http://127.0.0.1:3000/api/preview/content/${token}/`);
  for (const status of [400, 429, 502]) {
    log.mockClear();
    const response = await servePreview(request, token, async () => {
      throw new PreviewError('private details', status);
    });
    expect(response.status).toBe(status);
    expect(log).toHaveBeenCalledTimes(status >= 500 ? 1 : 0);
  }
  log.mockClear();
  await servePreview(request, token, async () => ({ ...fixture(), status: 503 }));
  expect(log).toHaveBeenCalledExactlyOnceWith('[endpoint-error]', expect.any(String));
  expect(JSON.parse(log.mock.calls[0][1])).toMatchObject({
    endpoint: '/api/preview/content/[token]/[[...path]]',
    status: 503,
    error_type: 'operation_failed',
    method: 'GET',
    error: { message: 'The preview website returned HTTP 503.', status_code: 503 },
  });
  log.mockClear();
  vi.stubEnv('PREVIEW_PROXY_SECRET', '');
  expect((await createPreviewSession(create())).status).toBe(502);
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toContain('private details');
});

describe('configuration and signed capabilities', () => {
  it('uses the actual HTTP host when Next normalizes a loopback request URL', () => {
    const request = new Request('http://localhost:3000/api/preview/content/token', {
      headers: { host: '127.0.0.1:3000' },
    });
    expect(isPreviewHost(request, 'http://127.0.0.1:3000')).toBe(true);
    expect(isPreviewHost(request, 'http://localhost:3000')).toBe(false);
  });
  it('defaults to localhost editor and a separate loopback proxy origin', () => {
    vi.stubEnv('PREVIEW_EDITOR_ORIGIN', '');
    vi.stubEnv('PREVIEW_PROXY_ORIGIN', '');
    expect(previewConfig()).toMatchObject({
      editorOrigin: 'http://localhost:3000',
      proxyOrigin: 'http://127.0.0.1:3000',
    });
    vi.stubEnv('PREVIEW_PROXY_ORIGIN', 'http://localhost:3000');
    expect(previewConfig).toThrow('separate origin');
    vi.stubEnv('PREVIEW_PROXY_ORIGIN', 'https://preview.example/');
    expect(previewConfig).toThrow('exact HTTP(S) origins');
  });

  it.each(['development', 'test', 'production'])(
    'requires an explicit signing secret in %s',
    (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      for (const value of [undefined, '', '   ', 'too-short']) {
        vi.stubEnv('PREVIEW_PROXY_SECRET', value);
        expect(previewConfig).toThrow('PREVIEW_PROXY_SECRET must have at least 32 characters.');
      }
    },
  );

  it('retains paths, queries, fragments and origin binding without client-supplied destinations', () => {
    const config = previewConfig();
    const claims = session();
    const url = proxyUrl(new URL('https://shop.example/a%20b?x=1&x=2#hero'), claims, config);
    const token = new URL(url).pathname.split('/')[4];
    expect(readSession(token, config)).toEqual(claims);
    expect(upstreamUrl(new Request(url), token, claims).href).toBe(
      'https://shop.example/a%20b?x=1&x=2',
    );
    const rootRelative = new URL('//internal/path', url);
    expect(rootRelative.origin).not.toBe(config.proxyOrigin);
    const path = url.replace('/a%20b', '//169.254.169.254/latest');
    expect(upstreamUrl(new Request(path), token, claims).origin).toBe('https://shop.example');
  });

  it('rejects tampering, expiration, a changed parent and credentials or nonstandard ports', () => {
    const config = previewConfig();
    const token = signSession(session(), config);
    expect(() => readSession(`${token}x`, config)).toThrow('Invalid preview session');
    expect(() => readSession(token, config, Date.now() + SESSION_DURATION + 1)).toThrow('expired');
    expect(() => readSession(token, { ...config, editorOrigin: 'https://other.example' })).toThrow(
      'Invalid preview',
    );
    for (const value of [
      'file:///etc/passwd',
      'https://user:password@shop.example',
      'http://shop.example:8080',
    ])
      expect(() => targetUrl(value)).toThrow(PreviewError);
  });
});

describe('public network destinations', () => {
  it.each([
    '127.0.0.1',
    '0.0.0.0',
    '10.10.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '100.100.100.200',
    '168.63.129.16',
    '192.0.2.1',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:8.8.8.8',
    'fc00::1',
    'fe80::1',
    '64:ff9b::7f00:1',
    '2001:db8::1',
    '2002:7f00:1::',
    'invalid',
  ])('blocks %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it.each(['8.8.8.8', '93.184.215.14', '2606:4700:4700::1111'])('allows %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
  it('rejects mixed public/private DNS answers and validates fresh DNS on every call', async () => {
    const url = new URL('https://shop.example');
    await expect(publicAddresses(url, AbortSignal.timeout(1000))).resolves.toHaveLength(1);
    lookup.mockResolvedValueOnce([
      { address: '93.184.215.14', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(publicAddresses(url, AbortSignal.timeout(1000))).rejects.toThrow('public IP');
    await expect(
      publicAddresses(new URL('http://2130706433'), AbortSignal.timeout(1000)),
    ).rejects.toThrow('public IP');
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

describe('response rewriting', () => {
  it('preserves unsafe-inline behavior and adds nonces only for existing hash/nonce restrictions', () => {
    const config = previewConfig();
    const inline = rewriteCsp(
      "script-src 'self' 'unsafe-inline'; style-src https://cdn.example",
      'bridge',
      config,
    );
    expect(inline).toContain("'unsafe-inline'");
    expect(inline).not.toContain("'nonce-bridge'");
    expect(inline).toContain('style-src https://cdn.example http://127.0.0.1:3000');
    const strict = rewriteCsp(
      "script-src 'nonce-original' 'strict-dynamic'; script-src-elem 'sha256-original'",
      'bridge',
      config,
    );
    expect(strict).toContain("'nonce-original'");
    expect(strict.match(/'nonce-bridge'/g)).toHaveLength(2);
  });

  it('replaces every framing policy, preserves resource restrictions, and authorizes the bootstrap nonce', () => {
    const csp = rewriteCsp(
      "default-src 'none'; script-src 'self'; frame-ancestors 'none'; report-uri /leak, frame-ancestors 'none'; img-src https:",
      'test',
      previewConfig(),
    );
    expect(csp).not.toContain('frame-ancestors');
    expect(csp).not.toContain('report-uri');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('http://127.0.0.1:3000/bridge.js');
    expect(csp).toContain('img-src https:');
  });

  it('rewrites HTML bases, navigation, assets, srcset, inline CSS and meta CSP without changing selectors', () => {
    const source = `<html><head><base href="/catalog/"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; frame-ancestors 'none'"><meta http-equiv="refresh" content="0; url=/escape"><script src="/bridge.js" data-parent-origin="https://old.example"></script><link rel="stylesheet" integrity="old" href="css/site.css"><style>.hero{background:url('../bg.png')}</style></head><body><a id="hero" class="cta" href="../next?q=1#top" target="_top" ping="/track">Next</a><img src="one.jpg" srcset="one.jpg 1x, two.jpg 2x" style="background: url('/thumb.jpg')"><script src="/app.js"></script><iframe src="/child" srcdoc="escape"></iframe></body></html>`;
    const html = rewriteHtml(
      source,
      new URL('https://shop.example/start'),
      session(),
      previewConfig(),
      'nonce',
    );
    expect(html).toContain('id="hero" class="cta"');
    expect(html).toContain('data-target-url="https://shop.example/start"');
    expect(html).toContain('data-target-base-url="https://shop.example/catalog/"');
    expect(html.match(/data-parent-origin=/g)).toHaveLength(1);
    expect(html).toContain('data-parent-origin="http://localhost:3000"');
    expect(html).toContain('src="http://127.0.0.1:3000/bridge.js"');
    expect(html).toContain('/next?q=1#top');
    expect(html).toContain('/catalog/css/site.css');
    expect(html).toContain('/catalog/two.jpg 2x');
    expect(html).toContain('http://127.0.0.1:3000/bridge.js');
    for (const forbidden of [
      'frame-ancestors',
      'srcdoc=',
      'integrity=',
      'ping=',
      'target="_top"',
      'http-equiv="refresh"',
    ])
      expect(html).not.toContain(forbidden);
  });

  it('rewrites CSS imports and URL values with a parser, retaining fragments and data URLs', () => {
    const css = rewriteCss(
      '@import "nested.css" screen; a { background: url("img.png"); filter: url(#mask) }',
      (url) => (url.startsWith('#') ? url : `/proxy/${url}`),
    );
    expect(css).toContain('@import "/proxy/nested.css" screen');
    expect(css).toContain('url("/proxy/img.png")');
    expect(css).toContain('url(#mask)');
  });
});

describe('session and content endpoints', () => {
  it('fails closed without a configured signing secret', async () => {
    vi.stubEnv('PREVIEW_PROXY_SECRET', '');
    const response = await createPreviewSession(create());
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty('url');
    const fetcher = vi.fn();
    expect(
      (
        await servePreview(
          new Request('http://127.0.0.1:3000/api/preview/content/token/'),
          'token',
          fetcher,
        )
      ).status,
    ).toBe(502);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('creates a bounded proxy URL only from the configured editor origin', async () => {
    const result = await createPreviewSession(create());
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.url).toMatch(/^http:\/\/127\.0\.0\.1:3000\/api\/preview\/content\//);
    expect(data.url).toContain('/products?sort=new#items');
    const wrong = create();
    wrong.headers.set('Origin', 'http://127.0.0.1:3000');
    expect((await createPreviewSession(wrong)).status).toBe(403);
    expect((await createPreviewSession(create('http://127.0.0.1'))).status).toBe(403);
    expect((await createPreviewSession(create('https://u:p@shop.example'))).status).toBe(400);
    const large = create();
    expect(
      (
        await createPreviewSession(
          new Request(large.url, {
            method: 'POST',
            headers: large.headers,
            body: 'x'.repeat(13_000),
          }),
        )
      ).status,
    ).toBe(413);
  });

  it('serves sandboxed HTML without upstream cookies, framing restrictions, stale lengths or validators', async () => {
    const config = previewConfig();
    const url = proxyUrl(new URL('https://shop.example/'), session(), config);
    const token = new URL(url).pathname.split('/')[4];
    const fetcher = vi.fn().mockResolvedValue(fixture());
    const result = await servePreview(new Request(url), token, fetcher);
    expect(result.status).toBe(200);
    expect(fetcher.mock.calls[0][0].href).toBe('https://shop.example/');
    const csp = result.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("frame-ancestors 'self' http://localhost:3000");
    expect(csp).toContain('sandbox allow-scripts');
    expect(csp).not.toContain("frame-ancestors 'none'");
    for (const name of ['set-cookie', 'x-frame-options', 'etag', 'content-length'])
      expect(result.headers.has(name)).toBe(false);
    expect(result.headers.get('access-control-allow-origin')).toBe('null');
    expect(await result.text()).toContain('id="hero"');
    const sameOrigin = new Request(url.replace(config.proxyOrigin, config.editorOrigin));
    expect((await servePreview(sameOrigin, token, fetcher)).status).toBe(403);
    expect(
      (await servePreview(new Request(url, { method: 'POST', body: 'mutation' }), token, fetcher))
        .status,
    ).toBe(405);
  });

  it('keeps redirects on the proxy and carries expiry instead of issuing fresh sessions', async () => {
    const claims = session();
    const config = previewConfig();
    const url = proxyUrl(new URL('https://shop.example/'), claims, config);
    const token = new URL(url).pathname.split('/')[4];
    const response = await servePreview(
      new Request(url),
      token,
      vi.fn().mockResolvedValue({
        status: 302,
        headers: new Headers({ location: '/password' }),
        body: Buffer.alloc(0),
      }),
    );
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe(config.proxyOrigin);
    expect(location.pathname.endsWith('/password')).toBe(true);
    expect(readSession(location.pathname.split('/')[4], config).expires).toBe(claims.expires);
  });

  it('handles bodyless HEAD responses even when upstream advertises compression', async () => {
    const config = previewConfig();
    const url = proxyUrl(new URL('https://shop.example/'), session(), config);
    const upstream = fixture();
    upstream.body = Buffer.alloc(0);
    upstream.headers.set('Content-Encoding', 'gzip');
    const fetcher = vi.fn().mockResolvedValue(upstream);
    const response = await servePreview(
      new Request(url, { method: 'HEAD' }),
      new URL(url).pathname.split('/')[4],
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('content-security-policy')).toContain('sandbox allow-scripts');
    expect(fetcher.mock.calls[0][2]).toBe('HEAD');
  });

  it('bounds HTML transformation and rejects expired capabilities before an outbound fetch', async () => {
    const config = previewConfig();
    const url = proxyUrl(new URL('https://shop.example/'), session(), config);
    const token = new URL(url).pathname.split('/')[4];
    const fetcher = vi.fn().mockResolvedValue(fixture('x'.repeat(2 * 1024 * 1024 + 1)));
    expect((await servePreview(new Request(url), token, fetcher)).status).toBe(413);
    const expired = proxyUrl(
      new URL('https://shop.example/'),
      { ...session(), expires: Date.now() - 1 },
      config,
    );
    fetcher.mockClear();
    expect(
      (await servePreview(new Request(expired), new URL(expired).pathname.split('/')[4], fetcher))
        .status,
    ).toBe(410);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('decompresses before rewriting and rejects HTML returned through asset capabilities', async () => {
    const config = previewConfig();
    const claims = session();
    const url = proxyUrl(new URL('https://shop.example/'), claims, config);
    const upstream = fixture();
    upstream.body = gzipSync(upstream.body);
    upstream.headers.set('Content-Encoding', 'gzip');
    const response = await servePreview(
      new Request(url),
      new URL(url).pathname.split('/')[4],
      vi.fn().mockResolvedValue(upstream),
    );
    expect(response.headers.has('content-encoding')).toBe(false);
    expect(await response.text()).toContain('data-target-url');
    const asset = proxyUrl(new URL('https://shop.example/image'), claims, config, 'asset');
    expect(
      (
        await servePreview(
          new Request(asset),
          new URL(asset).pathname.split('/')[4],
          vi.fn().mockResolvedValue(fixture()),
        )
      ).status,
    ).toBe(415);
  });
});

it('answers sandbox preflights for signed public reads without contacting upstream', async () => {
  const url = proxyUrl(
    new URL('https://shop.example/api/cards'),
    session(),
    previewConfig(),
    'asset',
  );
  const token = new URL(url).pathname.split('/')[4];
  const fetcher = vi.fn();
  const request = (
    origin = 'null',
    method = 'GET',
    headers = 'content-type,sentry-trace,baggage',
  ) =>
    new Request(url, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': method,
        'access-control-request-headers': headers,
      },
    });
  const response = await servePreview(request(), token, fetcher);
  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
  expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD');
  expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
    'content-type,sentry-trace,baggage',
  );
  expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false);
  expect((await servePreview(request('null', 'HEAD'), token, fetcher)).status).toBe(204);
  expect((await servePreview(request('https://other.example'), token, fetcher)).status).toBe(403);
  expect((await servePreview(request('null', 'POST'), token, fetcher)).status).toBe(405);
  expect(
    (await servePreview(request('null', 'GET', 'invalid header'), token, fetcher)).status,
  ).toBe(400);
  expect((await servePreview(request(), `${token}invalid`, fetcher)).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
