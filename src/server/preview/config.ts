import 'server-only';

export class PreviewError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function origin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value)
    throw new Error('Preview origins must be exact HTTP(S) origins without a trailing slash.');
  return url.origin;
}

export function previewConfig() {
  const editorOrigin = origin(process.env.PREVIEW_EDITOR_ORIGIN?.trim() || 'http://localhost:3000');
  const proxyOrigin = origin(process.env.PREVIEW_PROXY_ORIGIN?.trim() || 'http://127.0.0.1:3000');
  if (editorOrigin === proxyOrigin) throw new Error('The preview proxy needs a separate origin.');
  const secret = process.env.PREVIEW_PROXY_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new Error('PREVIEW_PROXY_SECRET must have at least 32 characters.');
  return { editorOrigin, proxyOrigin, secret };
}

export type PreviewConfig = ReturnType<typeof previewConfig>;

/** Next can normalize loopback request URLs; Host preserves the browser's actual destination. */
export function isPreviewHost(request: Request, expectedOrigin: string): boolean {
  const host = request.headers.get('host');
  return host
    ? host.toLowerCase() === new URL(expectedOrigin).host.toLowerCase()
    : new URL(request.url).origin === expectedOrigin;
}
