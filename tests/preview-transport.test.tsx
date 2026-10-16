// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ElementPicker } from '../src/components/ElementPicker/ElementPicker';
import { IsolatedPreview } from '../src/components/IsolatedPreview/IsolatedPreview';
import { WebsiteConnectionCheck } from '../src/components/WebsiteConnectionCheck/WebsiteConnectionCheck';
import { createEmptyWorkflow } from '../src/lib/catalog';
import { type PreviewTransport, PreviewTransportProvider } from '../src/lib/previewTransport';

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
