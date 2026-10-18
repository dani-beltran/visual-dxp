import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { type PreviewConfig, PreviewError } from './config';

export const PREVIEW_PREFIX = '/api/preview/content/';
export const SESSION_DURATION = 15 * 60_000;

export interface PreviewSession {
  origin: string;
  editor: string;
  expires: number;
  kind: 'document' | 'asset';
}

export function targetUrl(value: string, base?: string): URL {
  if (value.length > 8192) throw new PreviewError('Website URL is too long.');
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new PreviewError('Enter a valid HTTP(S) website URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
    throw new PreviewError(
      'Public previews require HTTP(S), standard ports, and no URL credentials.',
    );
  return url;
}

function signature(payload: string, config: PreviewConfig) {
  return createHmac('sha256', config.secret).update(payload).digest('base64url');
}

export function signSession(session: PreviewSession, config: PreviewConfig): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${signature(payload, config)}`;
}

export function readSession(
  token: string,
  config: PreviewConfig,
  now = Date.now(),
): PreviewSession {
  if (token.length > 2048) throw new PreviewError('Invalid preview session.', 403);
  const [payload, supplied, extra] = token.split('.');
  const expected = signature(payload || '', config);
  if (
    !supplied ||
    extra ||
    !/^[\w-]+$/.test(supplied) ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new PreviewError('Invalid preview session.', 403);
  let session: PreviewSession;
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      targetUrl(session.origin).origin !== session.origin ||
      session.editor !== config.editorOrigin ||
      !['document', 'asset'].includes(session.kind) ||
      !Number.isFinite(session.expires)
    )
      throw new Error();
  } catch {
    throw new PreviewError('Invalid preview session.', 403);
  }
  if (session.expires <= now || session.expires > now + SESSION_DURATION + 5000)
    throw new PreviewError('Preview session expired. Reload the preview to reconnect.', 410);
  return session;
}

/** Each origin has its own signed capability; relative paths retain their normal resolution. */
export function proxyUrl(
  url: URL,
  session: PreviewSession,
  config: PreviewConfig,
  kind: PreviewSession['kind'] = session.kind,
): string {
  const token = signSession({ ...session, origin: url.origin, kind }, config);
  return `${config.proxyOrigin}${PREVIEW_PREFIX}${token}${url.pathname}${url.search}${url.hash}`;
}

export function upstreamUrl(request: Request, token: string, session: PreviewSession): URL {
  const incoming = new URL(request.url);
  const prefix = `${PREVIEW_PREFIX}${token}`;
  if (incoming.pathname !== prefix && !incoming.pathname.startsWith(`${prefix}/`))
    throw new PreviewError('Invalid preview path.');
  const url = new URL(session.origin);
  url.pathname = incoming.pathname.slice(prefix.length) || '/';
  url.search = incoming.search;
  return targetUrl(url.href);
}
