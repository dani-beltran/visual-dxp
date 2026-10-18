import 'server-only';
import { randomBytes } from 'node:crypto';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { aiRateLimitKey } from '../ai/access';
import { isPreviewHost, PreviewError, previewConfig } from './config';
import { fetchPublic, MAX_RESOURCE_BYTES, publicAddresses, type UpstreamResponse } from './network';
import { previewCsp, rewriteCsp, rewriteCss, rewriteHtml } from './rewrite';
import {
  type PreviewSession,
  proxyUrl,
  readSession,
  SESSION_DURATION,
  targetUrl,
  upstreamUrl,
} from './tokens';

const buckets = new Map<string, { count: number; expires: number }>();
function quota(request: Request, scope: 'session' | 'resource') {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  const key = `${scope}:${aiRateLimitKey(request)}`;
  const bucket = buckets.get(key) ?? { count: 0, expires: now + 60_000 };
  if (
    (buckets.size >= 10_000 && !buckets.has(key)) ||
    ++bucket.count > (scope === 'session' ? 20 : 600)
  )
    throw new PreviewError('Too many preview requests. Try again in a minute.', 429);
  buckets.set(key, bucket);
}

function errorResponse(error: unknown): Response {
  const known = error instanceof PreviewError;
  return Response.json(
    {
      error: known ? error.message : 'The public website could not be loaded by the preview proxy.',
    },
    {
      status: known ? error.status : 502,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    },
  );
}

export async function createPreviewSession(request: Request): Promise<Response> {
  try {
    const config = previewConfig();
    if (
      !isPreviewHost(request, config.editorOrigin) ||
      request.headers.get('origin') !== config.editorOrigin
    )
      throw new PreviewError('Open the editor at PREVIEW_EDITOR_ORIGIN to create a preview.', 403);
    quota(request, 'session');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new PreviewError('Send a JSON website URL.');
    // Read incrementally; Content-Length is not trusted.
    const reader = request.body?.getReader();
    if (!reader) throw new PreviewError('A website URL is required.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 12_000) throw new PreviewError('Preview request is too large.', 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new PreviewError('Invalid preview request.');
    }
    if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string')
      throw new PreviewError('A website URL is required.');
    const url = targetUrl(value.url);
    await publicAddresses(url, AbortSignal.any([request.signal, AbortSignal.timeout(8000)]));
    const session: PreviewSession = {
      origin: url.origin,
      editor: config.editorOrigin,
      expires: Date.now() + SESSION_DURATION,
      kind: 'document',
    };
    return Response.json(
      { url: proxyUrl(url, session, config), expiresAt: session.expires },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function servePreview(
  request: Request,
  token: string,
  fetcher: typeof fetchPublic = fetchPublic,
): Promise<Response> {
  try {
    const config = previewConfig();
    if (!isPreviewHost(request, config.proxyOrigin))
      throw new PreviewError('Preview content must be served from PREVIEW_PROXY_ORIGIN.', 403);
    if (!['GET', 'HEAD'].includes(request.method))
      throw new PreviewError('Public previews support GET and HEAD only.', 405);
    quota(request, 'resource');
    const session = readSession(token, config);
    const url = upstreamUrl(request, token, session);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]);
    const upstream: UpstreamResponse = await fetcher(url, signal, request.method as 'GET' | 'HEAD');
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      // Fonts and module scripts are requested from the iframe's opaque sandbox origin.
      'Access-Control-Allow-Origin': 'null',
      'Content-Security-Policy': previewCsp(config),
    });
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (!location)
        throw new PreviewError('The website returned a redirect without a destination.', 502);
      headers.set('Location', proxyUrl(targetUrl(location, url.href), session, config));
      return new Response(null, { status: upstream.status, headers });
    }
    if (upstream.status === 304)
      throw new PreviewError('The website returned an unexpected cached response.', 502);
    if (upstream.status === 204 || upstream.status === 205)
      return new Response(null, { status: upstream.status, headers });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const html = mime === 'text/html' || mime === 'application/xhtml+xml';
    if (html && session.kind !== 'document')
      throw new PreviewError('An asset URL returned an HTML page.', 415);
    const nonce = randomBytes(18).toString('base64');
    if (html) {
      const csp = rewriteCsp(upstream.headers.get('content-security-policy') || '', nonce, config);
      headers.set('Content-Security-Policy', [csp, previewCsp(config)].filter(Boolean).join(', '));
    }
    if (request.method === 'HEAD') {
      headers.set('Content-Type', html ? 'text/html; charset=utf-8' : contentType);
      return new Response(null, { status: upstream.status, headers });
    }
    let body = upstream.body;
    const encoding = upstream.headers.get('content-encoding');
    const decompress =
      encoding === 'gzip'
        ? gunzipSync
        : encoding === 'br'
          ? brotliDecompressSync
          : encoding === 'deflate'
            ? inflateSync
            : undefined;
    if (decompress) body = decompress(body, { maxOutputLength: MAX_RESOURCE_BYTES });
    else if (encoding && encoding !== 'identity')
      throw new PreviewError('Unsupported website content encoding.', 415);
    if (html) {
      if (body.length > 2 * 1024 * 1024)
        throw new PreviewError('Preview HTML exceeds the 2 MiB limit.', 413);
      const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType)?.[1] || 'utf-8';
      body = Buffer.from(
        rewriteHtml(new TextDecoder(charset).decode(body), url, session, config, nonce),
      );
      headers.set('Content-Type', 'text/html; charset=utf-8');
    } else if (mime === 'text/css') {
      if (body.length > 2 * 1024 * 1024)
        throw new PreviewError('Preview CSS exceeds the 2 MiB limit.', 413);
      body = Buffer.from(
        rewriteCss(body.toString('utf8'), (value) => {
          if (/^(?:#|data:|blob:)/i.test(value.trim())) return value;
          try {
            return proxyUrl(targetUrl(value, url.href), session, config, 'asset');
          } catch {
            return 'about:blank';
          }
        }),
      );
      headers.set('Content-Type', 'text/css; charset=utf-8');
    } else headers.set('Content-Type', contentType);
    if (body.length > 16 * 1024 * 1024)
      throw new PreviewError('Transformed preview resource is too large.', 413);
    return new Response(new Uint8Array(body), {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
