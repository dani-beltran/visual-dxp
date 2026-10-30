import { PREVIEW_PROTOCOL } from '../../lib/previewBridge';
import type { PreviewAction } from './previewState';

export interface PreviewConnection {
  readonly channel: string;
  connect: () => void;
  onLoad: () => void;
  send: (type: string, extra?: Record<string, unknown>) => void;
  dispose: () => void;
}

/** Owns one iframe subscription, its handshake timers and navigation history. */
export function createPreviewConnection({
  getWindow,
  proxied,
  dispatch,
  onMessage,
}: {
  getWindow: () => Window | null | undefined;
  proxied: boolean;
  dispatch: (action: PreviewAction) => void;
  onMessage: (message: Record<string, unknown>) => void;
}): PreviewConnection {
  let channel = '';
  let targetWindow: Window | null | undefined;
  let disposed = false;
  let blocked = false;
  let retry: number | undefined;
  let timeout: number | undefined;
  let loads: number[] = [];
  const clearTimers = () => {
    window.clearInterval(retry);
    window.clearTimeout(timeout);
  };
  const send = (type: string, extra: Record<string, unknown> = {}) => {
    if (disposed || blocked) return;
    // Opaque origins require '*'; only credential-free workflow commands go here.
    targetWindow?.postMessage({ protocol: PREVIEW_PROTOCOL, type, channel, ...extra }, '*');
  };
  const connect = () => {
    if (disposed || blocked) return;
    clearTimers();
    // Retain this browsing context so cleanup can stop it after React clears the ref.
    targetWindow = getWindow();
    channel = crypto.randomUUID();
    dispatch({ type: 'connect', channel });
    retry = window.setInterval(() => send('init'), 1000);
    timeout = window.setTimeout(() => {
      clearTimers();
      dispatch({ type: 'timeout', channel, proxied });
    }, 8000);
    send('init');
  };
  const receive = (event: MessageEvent) => {
    if (disposed || blocked || event.source !== getWindow() || event.origin !== 'null') return;
    const data = event.data;
    if (
      !data ||
      typeof data !== 'object' ||
      data.protocol !== PREVIEW_PROTOCOL ||
      data.channel !== channel
    )
      return;
    if (data.type === 'ready') {
      clearTimers();
      dispatch({ type: 'ready', channel, elementPicking: data.elementPicking === true });
    } else if (data.type === 'unavailable') {
      clearTimers();
      dispatch({ type: 'unavailable', channel });
    } else onMessage(data);
  };
  window.addEventListener('message', receive);
  return {
    get channel() {
      return channel;
    },
    connect,
    send,
    onLoad() {
      if (disposed || blocked) return;
      const now = Date.now();
      loads = loads.filter((time) => now - time < 10_000);
      loads.push(now);
      if (proxied && loads.length >= 5) {
        clearTimers();
        send('stop');
        blocked = true;
        dispatch({ type: 'blocked' });
      } else connect();
    },
    dispose() {
      if (disposed) return;
      send('stop');
      disposed = true;
      clearTimers();
      window.removeEventListener('message', receive);
    },
  };
}
