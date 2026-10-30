// @vitest-environment jsdom
import { act, type ComponentProps, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IsolatedPreview } from '../src/components/IsolatedPreview/IsolatedPreview';
import { createEmptyWorkflow } from '../src/lib/catalog';
import { PREVIEW_PROTOCOL } from '../src/lib/previewBridge';
import { PreviewTransportProvider } from '../src/lib/previewTransport';

const target = 'https://site.example/';
const proxy = 'https://preview.example/api/preview/content/signed/';
const transport = { resolve: vi.fn().mockResolvedValue(proxy) };
let root: Root;
let host: HTMLDivElement;
let props: ComponentProps<typeof IsolatedPreview>;
let mounted: boolean;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
  transport.resolve.mockClear();
  props = {
    url: target,
    workflow: {
      ...createEmptyWorkflow(),
      websiteUrl: target,
      nodes: [
        {
          id: 'start',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 'Page loaded', config: {} },
        },
      ],
    },
    running: false,
    revision: 0,
    title: 'Preview',
    onReady: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
    onLog: vi.fn(),
    onExecution: vi.fn(),
    onPickingReady: vi.fn(),
    onPickCancel: vi.fn(),
  };
});
afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render(changes: Partial<typeof props> = {}) {
  props = { ...props, ...changes };
  await act(async () =>
    root.render(
      <StrictMode>
        <PreviewTransportProvider transport={transport}>
          <IsolatedPreview {...props} />
        </PreviewTransportProvider>
      </StrictMode>,
    ),
  );
}
async function handshake() {
  const frame = host.querySelector('iframe');
  if (!frame?.contentWindow) throw new Error('Expected preview iframe');
  const post = vi.spyOn(frame.contentWindow, 'postMessage').mockImplementation(() => {});
  await act(async () => frame.dispatchEvent(new Event('load')));
  const init = post.mock.calls.map(([data]) => data).find((data) => data.type === 'init');
  if (!init) throw new Error('Expected handshake');
  return { frame, post, init };
}
async function receive(
  frame: HTMLIFrameElement,
  channel: string,
  type: string,
  extra: Record<string, unknown> = {},
  origin = 'null',
  source = frame.contentWindow,
) {
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        source,
        data: { protocol: PREVIEW_PROTOCOL, channel, type, ...extra },
      }),
    ),
  );
}

it('uses current callbacks and workflow labels without reconnecting on rerender', async () => {
  await render({ running: true });
  const { frame, post, init } = await handshake();
  await receive(frame, init.channel, 'ready', { elementPicking: true });
  const firstRun = post.mock.calls.map(([data]) => data).find((data) => data.type === 'run');
  const oldLog = props.onLog;
  const newLog = vi.fn();
  await render({ onLog: newLog });
  expect(post.mock.calls.filter(([data]) => data.type === 'init')).toHaveLength(1);
  expect(post.mock.calls.filter(([data]) => data.type === 'run')).toHaveLength(1);
  const log = {
    nodeId: 'start',
    status: 'success',
    message: 'Done',
    label: 'Untrusted label',
    timestamp: -1,
    extra: 'Untrusted field',
  };
  await receive(frame, init.channel, 'log', { runId: firstRun.runId, log });
  expect(oldLog).not.toHaveBeenCalled();
  expect(newLog).toHaveBeenLastCalledWith({
    nodeId: 'start',
    label: 'Page loaded',
    status: 'success',
    message: 'Done',
    timestamp: Date.now(),
  });
  const workflow = {
    ...props.workflow,
    nodes: props.workflow.nodes.map((node) => ({
      ...node,
      data: { ...node.data, label: 'Updated label' },
    })),
  };
  await render({ workflow });
  const latestRun = post.mock.calls
    .map(([data]) => data)
    .filter((data) => data.type === 'run')
    .at(-1);
  expect(latestRun.runId).not.toBe(firstRun.runId);
  await receive(frame, init.channel, 'log', { runId: firstRun.runId, log });
  expect(newLog).toHaveBeenCalledTimes(1);
  await receive(frame, init.channel, 'log', { runId: latestRun.runId, log });
  expect(newLog).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'Updated label' }));
});

it('rejects foreign handshakes and stale channels, and recovers from a connection timeout', async () => {
  await render();
  const { frame, post, init } = await handshake();
  await receive(
    frame,
    init.channel,
    'ready',
    { elementPicking: true },
    'https://untrusted.example',
  );
  await receive(frame, init.channel, 'ready', { elementPicking: true }, 'null', window);
  await receive(frame, 'previous-channel', 'ready', { elementPicking: true });
  expect(props.onReady).not.toHaveBeenCalledWith(true);
  await act(async () => vi.advanceTimersByTimeAsync(8000));
  expect(props.onError).toHaveBeenLastCalledWith(expect.stringContaining('preview'));
  expect(props.onReady).toHaveBeenLastCalledWith(false);
  await receive(frame, init.channel, 'ready', { elementPicking: true });
  expect(props.onReady).toHaveBeenLastCalledWith(true);
  expect(props.onError).toHaveBeenLastCalledWith('');
  expect(props.onPickingReady).toHaveBeenLastCalledWith(true);
  await act(async () => frame.dispatchEvent(new Event('load')));
  const next = post.mock.calls
    .map(([data]) => data)
    .filter((data) => data.type === 'init')
    .at(-1);
  expect(next.channel).not.toBe(init.channel);
  await receive(frame, init.channel, 'ready', { elementPicking: true });
  expect(props.onReady).toHaveBeenLastCalledWith(false);
  await receive(frame, next.channel, 'ready', { elementPicking: true });
  expect(props.onReady).toHaveBeenLastCalledWith(true);
});

it('restarts an active run for a new channel even when reconnect and ready are batched', async () => {
  await render({ running: true, picking: true });
  const { frame, post, init } = await handshake();
  await receive(frame, init.channel, 'ready', { elementPicking: true });
  const firstRun = post.mock.calls.map(([data]) => data).find((data) => data.type === 'run');
  post.mockImplementation((data) => {
    if (data.type === 'init')
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'null',
          source: frame.contentWindow,
          data: {
            protocol: PREVIEW_PROTOCOL,
            channel: data.channel,
            type: 'ready',
            elementPicking: true,
          },
        }),
      );
  });
  await act(async () => frame.dispatchEvent(new Event('load')));
  const runs = post.mock.calls.map(([data]) => data).filter((data) => data.type === 'run');
  expect(runs).toHaveLength(2);
  expect(runs[1].channel).not.toBe(firstRun.channel);
  expect(runs[1].runId).not.toBe(firstRun.runId);
  expect(props.onExecution).toHaveBeenCalledWith({ type: 'stop', runId: firstRun.runId });
  expect(post.mock.calls.filter(([data]) => data.type === 'pick-start')).toHaveLength(2);
});

it('stops subscriptions and timers on unmount and ignores later messages', async () => {
  await render();
  const { frame, post, init } = await handshake();
  const source = frame.contentWindow;
  await act(async () => root.unmount());
  mounted = false;
  const count = post.mock.calls.length;
  const notifications = vi.mocked(props.onReady).mock.calls.length;
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'null',
        source,
        data: { protocol: PREVIEW_PROTOCOL, channel: init.channel, type: 'ready' },
      }),
    );
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(post.mock.calls.length).toBe(count);
  expect(props.onReady).toHaveBeenCalledTimes(notifications);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'stop' }), '*');
});

it('cancels a stale demo fetch when switching to a remote target', async () => {
  let finish: (response: Response) => void = () => {};
  const fetcher = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  await render({ url: '/demo-site.html' });
  const signal = fetcher.mock.lastCall?.[1].signal as AbortSignal;
  await render({ url: target });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(new Response('<html><body>Stale demo</body></html>')));
  const frame = host.querySelector('iframe');
  expect(frame?.src).toBe(proxy);
  expect(frame?.getAttribute('srcdoc')).toBeNull();
});
