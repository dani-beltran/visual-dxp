import { useEffect, useState } from 'react';

/** Demo document loading has its own cancellation lifecycle, separate from the bridge. */
export function useDemoPreviewDocument(target: string | undefined) {
  const [document, setDocument] = useState<{ target: string; html?: string; failed?: boolean }>();
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    void fetch('/demo-site.html', {
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const html = await response.text();
        if (!controller.signal.aborted) setDocument({ target, html });
      })
      .catch(() => {
        if (!controller.signal.aborted) setDocument({ target, failed: true });
      });
    return () => controller.abort();
  }, [target]);
  return {
    html: document?.target === target ? document?.html : undefined,
    failed: document?.target === target && document?.failed === true,
  };
}
