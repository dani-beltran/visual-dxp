import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { expect, it } from 'vitest';

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
    const command = (type) =>
      win.dispatchEvent(
        new dom.window.MessageEvent('message', {
          origin: 'https://editor.example',
          source: win.parent,
          data: { protocol: 'visual-dxp:preview', channel: 'preview-test', type },
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
  } finally {
    dom.window.close();
  }
});
