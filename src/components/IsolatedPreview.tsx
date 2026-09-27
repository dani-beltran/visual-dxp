import { useCallback, useEffect, useRef, useState } from 'react';
import { PREVIEW_PROTOCOL, previewBridgeSource } from '../lib/previewBridge';
import type { RunLog, Workflow } from '../lib/types';

/** An opaque sandbox origin cannot access the builder's DOM, cookies or localStorage. */
export function IsolatedPreview({
  url,
  workflow,
  running,
  revision,
  title,
  onReady,
  onLog,
  onError,
  onClose,
}: {
  url: string;
  workflow: Workflow;
  running: boolean;
  revision: number;
  title: string;
  onReady: (ready: boolean) => void;
  onLog?: (log: RunLog) => void;
  onError: (error: string) => void;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string>();
  const [ready, setReady] = useState(false);
  const channel = useRef('');
  const callbacks = useRef({ onReady, onLog, onError, onClose });
  callbacks.current = { onReady, onLog, onError, onClose };
  const current = useRef(workflow);
  current.current = workflow;
  const demo = url === '/demo-site.html';
  const send = useCallback((type: string, extra: Record<string, unknown> = {}) => {
    // Opaque origins require '*'; only credential-free workflow commands go here.
    frame.current?.contentWindow?.postMessage(
      { protocol: PREVIEW_PROTOCOL, type, channel: channel.current, ...extra },
      '*',
    );
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A different URL needs a new message channel, even when both URLs are external.
  useEffect(() => {
    setReady(false);
    callbacks.current.onReady(false);
    setHtml(undefined);
    channel.current = crypto.randomUUID();
    const controller = new AbortController();
    if (demo) {
      void fetch('/demo-site.html', {
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const source = await response.text();
          if (controller.signal.aborted) return;
          const bridge = previewBridgeSource(window.location.origin).replace(
            /<\/script/gi,
            '<\\/script',
          );
          // Sandbox applies to every script in the document, including author HTML.
          setHtml(`${source}<script>${bridge}</script>`);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            callbacks.current.onError('The demo could not load. Reload to try again.');
        });
    }
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const data = event.data;
      if (!data || data.protocol !== PREVIEW_PROTOCOL || data.channel !== channel.current) return;
      if (data.type === 'ready') {
        setReady(true);
        callbacks.current.onReady(true);
      }
      if (data.type === 'unavailable') {
        setReady(false);
        callbacks.current.onReady(false);
      }
      if (data.type === 'close') callbacks.current.onClose();
      if (data.type === 'error')
        callbacks.current.onError('The isolated preview could not run this workflow.');
      if (data.type === 'log') {
        const log = data.log as RunLog;
        if (
          !log ||
          !current.current.nodes.some((node) => node.id === log.nodeId) ||
          !['running', 'success', 'error'].includes(log.status) ||
          typeof log.message !== 'string' ||
          log.message.length > 2000
        )
          return;
        // Take known fields only; iframe messages are untrusted data.
        callbacks.current.onLog?.({
          nodeId: log.nodeId,
          label: current.current.nodes.find((node) => node.id === log.nodeId)?.data.label ?? 'Step',
          status: log.status,
          message: log.message,
          timestamp: Date.now(),
        });
      }
    };
    window.addEventListener('message', receive);
    return () => {
      controller.abort();
      window.removeEventListener('message', receive);
    };
  }, [url, demo]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly restarts an unchanged workflow.
  useEffect(() => {
    if (!ready) return;
    send(running ? 'run' : 'stop', running ? { workflow } : {});
    return () => send('stop');
  }, [ready, running, workflow, revision, send]);
  return (
    <iframe
      ref={frame}
      src={demo ? undefined : url}
      srcDoc={demo ? html : undefined}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title={title}
      onLoad={() => {
        setReady(false);
        callbacks.current.onReady(false);
        send('init');
      }}
      onError={() => callbacks.current.onError('The website could not load.')}
    />
  );
}
