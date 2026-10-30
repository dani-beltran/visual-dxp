import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { expect, it, vi } from 'vitest';

it('keeps inline selection and CSS escaping working after bundling and minifying the serialized preview bridge', async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: 'esbuild',
      lib: {
        entry: fileURLToPath(new URL('../src/lib/previewBridge.ts', import.meta.url)),
        name: 'PreviewBridgeFixture',
        formats: ['iife'],
      },
    },
  });
  if (!Array.isArray(result)) throw new Error('Expected an in-memory library build');
  const chunk = result[0].output.find((item) => item.type === 'chunk');
  if (!chunk) throw new Error('Missing preview bridge bundle');
  const library = new Function(`${chunk.code}; return PreviewBridgeFixture;`)();
  const dom = new JSDOM('<iframe></iframe>', { url: 'https://editor.example' });
  try {
    const frame = dom.window.document.querySelector('iframe');
    const win = frame?.contentWindow;
    if (!win) throw new Error('Missing preview window');
    win.document.body.innerHTML = '<a id="buy:now" href="/shop">Shop</a>';
    const messages = [];
    win.parent.postMessage = (message) => messages.push(message);
    new Function('window', 'document', library.previewBridgeSource('https://editor.example'))(
      win,
      win.document,
    );
    const command = (type, detail = {}) =>
      win.dispatchEvent(
        new dom.window.MessageEvent('message', {
          origin: 'https://editor.example',
          source: win.parent,
          data: { protocol: 'visual-dxp:preview', channel: 'preview-test', type, ...detail },
        }),
      );
    command('init');
    expect(messages.at(-1)).toMatchObject({ type: 'ready', elementPicking: true });
    command('pick-start');
    expect(win.document.querySelector('[data-visual-dxp-picker]')).not.toBeNull();
    const click = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    win.document.querySelector('a')?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(messages.at(-1)).toMatchObject({ type: 'pick-element', selector: '#buy\\:now' });
    expect(win.document.querySelector('[data-visual-dxp-picker]')).toBeNull();

    // Test workflow must use the minified, serialized runtime too, with local
    // capture enabled while workflow delivery remains simulated.
    win.document.body.innerHTML = '<button id="start">Start</button>';
    const originalTag = vi.fn();
    win.gtag = originalTag;
    win.dataLayer = [];
    command('run', {
      runId: 'capture-test',
      workflow: {
        version: 1,
        name: 'Capture',
        websiteUrl: '',
        analytics: { provider: 'ga4' },
        nodes: [
          {
            id: 'start',
            type: 'workflow',
            position: { x: 0, y: 0 },
            data: {
              kind: 'trigger',
              label: 'Start',
              config: { event: 'click', selector: '#start' },
            },
          },
        ],
        edges: [],
      },
    });
    win.document.querySelector('button').click();
    const events = () =>
      JSON.parse(win.sessionStorage.getItem('visual-dxp:analytics:preview:v1')).events;
    await vi.waitFor(() =>
      expect(events().map((event) => event.name)).toEqual([
        'dxp_workflow_started',
        'dxp_workflow_completed',
      ]),
    );
    win.dataLayer.push({ event: 'external_site_event' });
    expect(events().at(-1)).toMatchObject({ name: 'external_site_event', count: 1 });
    expect(originalTag).not.toHaveBeenCalled();
    expect(win.sessionStorage.getItem('visual-dxp:analytics:v1')).toBeNull();
    command('stop');
    expect(win.gtag).toBe(originalTag);
    expect(win.dataLayer.push).toBe(Array.prototype.push);
  } finally {
    dom.window.close();
  }
});
