import '../../styles/base.css';
import '../../styles/shared.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionPreview } from '../../lib/connections';
import { useBuilderI18n } from '../../lib/i18nContext';
import { PREVIEW_PROTOCOL, previewBridgeSource } from '../../lib/previewBridge';
import { usePreviewUrl } from '../../lib/previewTransport';
import type { PreviewExecutionEvent, RunLog, Workflow } from '../../lib/types';
import './IsolatedPreview.css';

/** An opaque sandbox origin cannot access the builder's DOM, cookies or localStorage. */
export function IsolatedPreview({
  url,
  searchParams,
  workflow,
  running,
  revision,
  title,
  onReady,
  onLog,
  onConnectionPreview,
  onError,
  onClose,
  onExecution,
}: {
  onExecution?: (event: PreviewExecutionEvent) => void;
  url: string;
  searchParams?: string;
  workflow: Workflow;
  running: boolean;
  revision: number;
  title: string;
  onReady: (ready: boolean) => void;
  onLog?: (log: RunLog) => void;
  onConnectionPreview?: (edgeId: string, preview: ConnectionPreview) => void;
  onError: (error: string) => void;
  onClose: () => void;
}) {
  const { t } = useBuilderI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string>();
  const [ready, setReady] = useState(false);
  const runId = useRef('');
  const channel = useRef('');
  const reconnect = useRef<() => void>(() => {});
  const callbacks = useRef({ onReady, onLog, onConnectionPreview, onError, onClose, onExecution });
  callbacks.current = { onReady, onLog, onConnectionPreview, onError, onClose, onExecution };
  const current = useRef(workflow);
  current.current = workflow;
  const demo = url.split(/[?#]/, 1)[0] === '/demo-site.html';
  const preview = usePreviewUrl(url);
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
    let retry: number | undefined;
    let timeout: number | undefined;
    const clearConnectionTimers = () => {
      window.clearInterval(retry);
      window.clearTimeout(timeout);
    };
    const connect = () => {
      clearConnectionTimers();
      channel.current = crypto.randomUUID();
      setReady(false);
      callbacks.current.onReady(false);
      callbacks.current.onError('');
      retry = window.setInterval(() => send('init'), 1000);
      timeout = window.setTimeout(() => {
        clearConnectionTimers();
        callbacks.current.onError(
          t(
            preview.proxied
              ? 'isolatedPreview.proxyUnavailable'
              : 'isolatedPreview.bridgeUnavailable',
          ),
        );
      }, 8000);
      send('init');
    };
    reconnect.current = connect;
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
            callbacks.current.onError(t('isolatedPreview.theDemoCouldNotLoadReloadToTryAgain'));
        });
    }
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const data = event.data;
      if (!data || data.protocol !== PREVIEW_PROTOCOL || data.channel !== channel.current) return;
      if (data.type === 'ready') {
        clearConnectionTimers();
        callbacks.current.onError('');
        setReady(true);
        callbacks.current.onReady(true);
      }
      if (data.type === 'unavailable') {
        clearConnectionTimers();
        setReady(false);
        callbacks.current.onReady(false);
      }
      if (data.type === 'close') callbacks.current.onClose();
      if (data.type === 'error' && runId.current && data.runId === runId.current)
        callbacks.current.onError(t('isolatedPreview.theIsolatedPreviewCouldNotRunThisWorkflow'));
      if (data.type === 'connection-preview' && runId.current && data.runId === runId.current) {
        const sample = data.preview;
        if (
          typeof data.edgeId !== 'string' ||
          !current.current.edges.some((edge) => edge.id === data.edgeId) ||
          !sample ||
          !sample.source ||
          typeof sample.source.exists !== 'boolean'
        )
          return;
        try {
          const encoded = JSON.stringify(sample.source.value);
          if (encoded && encoded.length > 32768) return;
          callbacks.current.onConnectionPreview?.(data.edgeId, {
            source: {
              exists: sample.source.exists,
              value: encoded === undefined ? undefined : JSON.parse(encoded),
            },
          });
        } catch {
          /* Ignore malformed or oversized execution samples. */
        }
      }
      if (data.type === 'log' && runId.current && data.runId === runId.current) {
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
        const safeLog: RunLog = {
          nodeId: log.nodeId,
          label:
            current.current.nodes.find((node) => node.id === log.nodeId)?.data.label ??
            t('isolatedPreview.step'),
          status: log.status,
          message: log.message,
          timestamp: Date.now(),
        };
        callbacks.current.onExecution?.({ type: 'log', runId: runId.current, log: safeLog });
        callbacks.current.onLog?.(safeLog);
      }
    };
    window.addEventListener('message', receive);
    if (demo || preview.url) connect();
    if (preview.error) callbacks.current.onError(preview.error);
    return () => {
      controller.abort();
      clearConnectionTimers();
      reconnect.current = () => {};
      window.removeEventListener('message', receive);
    };
  }, [url, demo, preview.url, preview.error, send]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly restarts an unchanged workflow.
  useEffect(() => {
    if (!ready) return;
    runId.current = running ? crypto.randomUUID() : '';
    if (running) callbacks.current.onExecution?.({ type: 'start', runId: runId.current });
    send(running ? 'run' : 'stop', running ? { workflow, runId: runId.current, searchParams } : {});
    return () => {
      callbacks.current.onExecution?.({ type: 'stop', runId: runId.current });
      runId.current = '';
      send('stop');
    };
  }, [ready, running, workflow, revision, searchParams, send]);
  return !demo && !preview.url ? null : (
    <iframe
      ref={frame}
      src={demo ? undefined : preview.url}
      srcDoc={demo ? html : undefined}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title={title}
      onLoad={() => reconnect.current()}
      onError={() => callbacks.current.onError(t('isolatedPreview.theWebsiteCouldNotLoad'))}
    />
  );
}
