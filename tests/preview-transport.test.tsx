// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ElementPicker } from '../src/components/ElementPicker/ElementPicker';
import { IsolatedPreview } from '../src/components/IsolatedPreview/IsolatedPreview';
import { WebsiteConnectionCheck } from '../src/components/WebsiteConnectionCheck/WebsiteConnectionCheck';
import { createEmptyWorkflow } from '../src/lib/catalog';
import {
  createProxyPreviewTransport,
  type PreviewTransport,
  PreviewTransportProvider,
} from '../src/lib/previewTransport';

let root: Root;
let host: HTMLDivElement;
const target = 'https://shop.example/products?campaign=welcome';
const proxy = 'https://preview.example/api/preview/content/signed/products?campaign=welcome';
const resolve = vi.fn<PreviewTransport['resolve']>();
const transport = { resolve };
const workflow = { ...createEmptyWorkflow(), websiteUrl: target };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  resolve.mockReset().mockResolvedValue(proxy);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('creates proxy sessions with same-origin editor credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ url: proxy }));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();

  await expect(
    createProxyPreviewTransport().resolve(target, { signal: controller.signal }),
  ).resolves.toBe(proxy);

  expect(fetcher).toHaveBeenCalledWith(
    '/api/preview/sessions',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      body: JSON.stringify({ url: target }),
    }),
  );
});

it.each([
  [
    'HTML gateway error',
    () =>
      new Response('<!DOCTYPE html><title>Bad gateway</title>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    'The preview service returned HTTP 502. Please try again later.',
  ],
  [
    'empty error',
    () => new Response(null, { status: 503 }),
    'The preview service returned HTTP 503. Please try again later.',
  ],
  [
    'malformed JSON error',
    () =>
      new Response('<!DOCTYPE html>', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    'The preview service returned HTTP 502. Please try again later.',
  ],
  [
    'JSON server error',
    () =>
      Response.json(
        { error: 'Too many preview requests. Try again in a minute.' },
        { status: 429 },
      ),
    'Too many preview requests. Try again in a minute.',
  ],
  [
    'null JSON error',
    () => Response.json(null, { status: 500 }),
    'The preview service returned HTTP 500. Please try again later.',
  ],
  [
    'blank JSON error',
    () => Response.json({ error: ' ' }, { status: 403 }),
    'The preview service returned HTTP 403. Please try again later.',
  ],
  [
    'HTML success',
    () => new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } }),
    'The preview service returned an invalid response. Please try again.',
  ],
  [
    'malformed JSON success',
    () => new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    'The preview service returned an invalid response. Please try again.',
  ],
  [
    'missing session URL',
    () => Response.json({}),
    'The preview service returned an invalid response. Please try again.',
  ],
  [
    'invalid session URL',
    () => Response.json({ url: 'invalid' }),
    'The preview service returned an invalid response. Please try again.',
  ],
] as const)('reports a readable error for %s', async (_name, response, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  await expect(
    createProxyPreviewTransport().resolve(target, { signal: new AbortController().signal }),
  ).rejects.toThrow(message);
});

it('shows the HTTP gateway error in the website connection check', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('<!DOCTYPE html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    ),
  );
  await act(async () =>
    root.render(
      <PreviewTransportProvider transport={createProxyPreviewTransport()}>
        <WebsiteConnectionCheck url={target} />
      </PreviewTransportProvider>,
    ),
  );
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(host.textContent).toContain(
    'The preview service returned HTTP 502. Please try again later.',
  );
  expect(host.textContent).not.toContain('Unexpected token');
  expect(host.querySelector('iframe')).toBeNull();
});

it('routes picker, preview and connection check through one transport while retaining real target URLs', async () => {
  await act(async () =>
    root.render(
      <PreviewTransportProvider transport={transport}>
        <ElementPicker url={target} onSelect={() => {}} onClose={() => {}} />
        <IsolatedPreview
          url={target}
          workflow={workflow}
          running={false}
          revision={0}
          title="Workflow"
          onReady={() => {}}
          onError={() => {}}
          onClose={() => {}}
        />
        <WebsiteConnectionCheck url={target} />
      </PreviewTransportProvider>,
    ),
  );
  // Connection checks keep their debounce before creating a session.
  expect(resolve).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(resolve).toHaveBeenCalledTimes(3);
  for (const [url] of resolve.mock.calls) expect(url).toBe(target);
  const frames = host.querySelectorAll('iframe');
  expect(frames).toHaveLength(3);
  for (const frame of frames) {
    expect(frame.src).toBe(proxy);
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  }
  expect(host.textContent).toContain(target);
  expect(workflow.websiteUrl).toBe(target);
});

it('cancels old sessions and never attaches a stale result after the target changes', async () => {
  let finish: (url: string) => void = () => {};
  resolve.mockImplementationOnce(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  const render = (url: string) =>
    root.render(
      <ElementPicker
        previewTransport={transport}
        url={url}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
  await act(async () => render(target));
  const signal = resolve.mock.calls[0][1].signal;
  expect(host.querySelector('iframe')).toBeNull();
  await act(async () => render('https://next.example/'));
  expect(signal.aborted).toBe(true);
  expect(host.querySelector('iframe')?.src).toBe(proxy);
  await act(async () => finish('https://stale.example/'));
  expect(host.querySelector('iframe')?.src).toBe(proxy);
});

it('surfaces transport errors without asking to install a bridge and renews on reload', async () => {
  resolve.mockRejectedValueOnce(
    new Error('Open the editor at PREVIEW_EDITOR_ORIGIN to create a preview.'),
  );
  await act(async () =>
    root.render(
      <PreviewTransportProvider transport={transport}>
        <ElementPicker url={target} onSelect={() => {}} onClose={() => {}} />
      </PreviewTransportProvider>,
    ),
  );
  expect(host.textContent).toContain('PREVIEW_EDITOR_ORIGIN');
  expect(host.textContent).not.toContain('Add this bridge.js script');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="Reload website"]')?.click(),
  );
  expect(resolve).toHaveBeenCalledTimes(2);
  expect(host.querySelector('iframe')?.src).toBe(proxy);
});

it('preserves direct library connections when no transport is provided', async () => {
  await act(async () =>
    root.render(<ElementPicker url={target} onSelect={() => {}} onClose={() => {}} />),
  );
  expect(resolve).not.toHaveBeenCalled();
  expect(host.querySelector('iframe')?.src).toBe(target);
});
