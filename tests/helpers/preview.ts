import { vi } from 'vitest';
import { previewBridgeSource } from '../../src/lib/previewBridge';

/** jsdom does not execute srcdoc; simulate the browser's isolated message transport. */
export function connectPreview(frame: HTMLIFrameElement) {
  const win = frame.contentWindow!;
  const doc = frame.contentDocument!;
  vi.spyOn(win.parent, 'postMessage').mockImplementation((data) => {
    window.dispatchEvent(new MessageEvent('message', { data, origin: 'null', source: win }));
  });
  vi.spyOn(win, 'postMessage').mockImplementation((data) => {
    win.dispatchEvent(
      new MessageEvent('message', { data, origin: window.location.origin, source: win.parent }),
    );
  });
  vi.spyOn(doc, 'readyState', 'get').mockReturnValue('complete');
  new Function('window', 'document', previewBridgeSource(window.location.origin))(win, doc);
}
export function mockDemoFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => new Response('<html><body>Demo</body></html>')),
  );
}
