import '../../styles/base.css';
import '../../styles/shared.css';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import type { ConnectionPreview } from '../../lib/connections';
import { useBuilderI18n } from '../../lib/i18nContext';
import { PREVIEW_PROTOCOL } from '../../lib/previewBridge';
import { usePreviewUrl } from '../../lib/previewTransport';
import type { PreviewExecutionEvent, RunLog, Workflow } from '../../lib/types';
import { createPreviewConnection, type PreviewConnection } from './previewConnection';
import { readPreviewMessage } from './previewMessages';
import { initialPreviewState, previewReducer } from './previewState';
import { useDemoPreviewDocument } from './useDemoPreviewDocument';
import './IsolatedPreview.css';

interface IsolatedPreviewProps {
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
  onExecution?: (event: PreviewExecutionEvent) => void;
  picking?: boolean;
  onPickElement?: (selector: string) => void;
  onPickCancel?: () => void;
  onPickingReady?: (supported: boolean) => void;
}

/** React owns preview state; the connection owns the isolated iframe protocol. */
export function IsolatedPreview(props: IsolatedPreviewProps) {
  const { url, searchParams, workflow, running, revision, title, picking = false } = props;
  const { t } = useBuilderI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const connection = useRef<PreviewConnection | undefined>(undefined);
  const runId = useRef('');
  const [state, dispatch] = useReducer(previewReducer, initialPreviewState);
  const latest = useRef({ props, t });
  // Async bridge callbacks read committed props without restarting the connection.
  useLayoutEffect(() => {
    latest.current = { props, t };
  });
  const demo = url.split(/[?#]/, 1)[0] === '/demo-site.html';
  const preview = usePreviewUrl(url);
  const { html, failed: demoFailed } = useDemoPreviewDocument(demo ? url : undefined);
  const ready = state.status === 'ready' && state.target === url;

  const receive = useCallback((data: Record<string, unknown>) => {
    const { props: current, t: translate } = latest.current;
    const message = readPreviewMessage(data, {
      workflow: current.workflow,
      runId: runId.current,
      picking: current.picking === true,
      stepLabel: translate('isolatedPreview.step'),
      now: Date.now(),
    });
    if (!message) return;
    switch (message.type) {
      case 'pick-element':
        current.onPickElement?.(message.selector);
        break;
      case 'pick-cancel':
        current.onPickCancel?.();
        break;
      case 'close':
        current.onClose();
        break;
      case 'error':
        dispatch({
          type: 'error',
          key: 'isolatedPreview.theIsolatedPreviewCouldNotRunThisWorkflow',
        });
        break;
      case 'connection-preview':
        current.onConnectionPreview?.(message.edgeId, message.preview);
        break;
      case 'log':
        current.onExecution?.({ type: 'log', runId: runId.current, log: message.log });
        current.onLog?.(message.log);
        break;
    }
  }, []);

  useEffect(() => {
    dispatch({
      type: 'reset',
      target: url,
      error: preview.error,
      errorKey: demoFailed ? 'isolatedPreview.theDemoCouldNotLoadReloadToTryAgain' : undefined,
    });
    if (demoFailed || (!demo && !preview.url)) return;
    const instance = createPreviewConnection({
      getWindow: () => frame.current?.contentWindow,
      proxied: preview.proxied,
      dispatch,
      onMessage: receive,
    });
    connection.current = instance;
    instance.connect();
    return () => {
      instance.dispose();
      connection.current = undefined;
    };
  }, [url, demo, demoFailed, preview.url, preview.error, preview.proxied, receive]);

  useEffect(() => {
    const current = latest.current.props;
    current.onReady(ready);
    current.onPickingReady?.(ready && state.elementPicking);
    current.onError(
      state.error ? ('key' in state.error ? t(state.error.key) : state.error.message) : '',
    );
    if (
      state.status === 'unavailable' ||
      state.status === 'blocked' ||
      (ready && !state.elementPicking && current.picking)
    )
      current.onPickCancel?.();
  }, [state, ready, t]);

  useEffect(() => {
    if (!ready) return;
    const instance = connection.current;
    if (!instance || instance.channel !== state.channel) return;
    const id = running ? `${revision}:${crypto.randomUUID()}` : '';
    runId.current = id;
    if (running) latest.current.props.onExecution?.({ type: 'start', runId: id });
    instance.send(running ? 'run' : 'stop', running ? { workflow, runId: id, searchParams } : {});
    return () => {
      latest.current.props.onExecution?.({ type: 'stop', runId: id });
      runId.current = '';
      instance.send('stop');
    };
  }, [ready, state.channel, running, workflow, revision, searchParams]);

  useEffect(() => {
    if (!ready || !picking) return;
    const pickerWindow = frame.current?.contentWindow;
    const pickerChannel = state.channel;
    connection.current?.send('pick-start');
    // Capture the browsing context; a refresh can clear the iframe ref before cleanup.
    return () =>
      pickerWindow?.postMessage(
        { protocol: PREVIEW_PROTOCOL, channel: pickerChannel, type: 'pick-stop' },
        '*',
      );
  }, [ready, state.channel, picking]);

  return state.status === 'blocked' || (!demo && !preview.url) ? null : (
    <iframe
      ref={frame}
      src={demo ? undefined : preview.url}
      srcDoc={demo ? html : undefined}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title={title}
      onLoad={() => connection.current?.onLoad()}
      onError={() => dispatch({ type: 'error', key: 'isolatedPreview.theWebsiteCouldNotLoad' })}
    />
  );
}
