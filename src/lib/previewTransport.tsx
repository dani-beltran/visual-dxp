import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export interface PreviewTransport {
  /** Resolve an absolute target URL to an isolated preview URL. Never change the saved workflow. */
  resolve: (url: string, options: { signal: AbortSignal }) => Promise<string>;
}

const PreviewTransportContext = createContext<PreviewTransport | undefined>(undefined);

export function PreviewTransportProvider({
  transport,
  children,
}: {
  transport?: PreviewTransport;
  children: ReactNode;
}) {
  return (
    <PreviewTransportContext.Provider value={transport}>
      {children}
    </PreviewTransportContext.Provider>
  );
}

export function usePreviewTransport() {
  return useContext(PreviewTransportContext);
}

/**
 * Creates an adapter that POSTs target URLs to a session endpoint and returns
 * temporary, signed iframe URLs on a separate origin for picking and previews.
 * The backend proxies the content; saved and exported website URLs stay unchanged.
 * Handles cancellation, a 15-second timeout, server errors, and proxy URL validation.
 * @param endpoint Host's session endpoint; defaults to `/api/preview/sessions`.
 */
export function createProxyPreviewTransport(endpoint = '/api/preview/sessions'): PreviewTransport {
  return {
    async resolve(url, { signal }) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        body: JSON.stringify({ url }),
      });
      const fallback = response.ok
        ? 'The preview service returned an invalid response. Please try again.'
        : `The preview service returned HTTP ${response.status}. Please try again later.`;
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (contentType !== 'application/json') throw new Error(fallback);
      let result: unknown;
      try {
        result = await response.json();
      } catch (error) {
        if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
          throw error;
        throw new Error(fallback);
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(fallback);
      if (!response.ok)
        throw new Error(
          'error' in result && typeof result.error === 'string' && result.error.trim()
            ? result.error
            : fallback,
        );
      if (!('url' in result) || typeof result.url !== 'string') throw new Error(fallback);
      let resolved: URL;
      try {
        resolved = new URL(result.url);
      } catch {
        throw new Error(fallback);
      }
      if (
        !['http:', 'https:'].includes(resolved.protocol) ||
        resolved.username ||
        resolved.password ||
        resolved.origin === window.location.origin
      )
        throw new Error('The preview proxy must use a separate HTTP(S) origin.');
      return resolved.href;
    },
  };
}

/** Same-origin local fixtures retain their existing sandboxed bridge setup. */
export function usePreviewUrl(target: string, override?: PreviewTransport, revision = 0) {
  const inherited = usePreviewTransport();
  const transport = override ?? inherited;
  let absolute = '';
  try {
    absolute = new URL(target, window.location.href).href;
  } catch {
    /* Report below. */
  }
  const proxied = !!transport && !!absolute && new URL(absolute).origin !== window.location.origin;
  const [result, setResult] = useState<{
    target: string;
    transport: PreviewTransport;
    revision: number;
    url?: string;
    error?: string;
  }>();
  useEffect(() => {
    if (!proxied || !transport) return;
    const controller = new AbortController();
    void transport.resolve(absolute, { signal: controller.signal }).then(
      (url) => {
        if (!controller.signal.aborted) setResult({ target: absolute, transport, revision, url });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({
            target: absolute,
            transport,
            revision,
            error: error instanceof Error ? error.message : 'The preview proxy could not connect.',
          });
      },
    );
    return () => controller.abort();
  }, [absolute, transport, proxied, revision]);
  if (!absolute) return { url: undefined, error: 'Enter a valid website URL.', proxied };
  if (!proxied) return { url: target, error: undefined, proxied };
  const current =
    result?.target === absolute && result.transport === transport && result.revision === revision
      ? result
      : undefined;
  return { url: current?.url, error: current?.error, proxied };
}
