import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

// Runs the serialized, minified preview bridge exactly as the demo preview injects it.
let library;
beforeAll(async () => {
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
  library = new Function(`${chunk.code}; return PreviewBridgeFixture;`)();
});

let dom;
afterEach(() => {
  vi.useRealTimers();
  dom?.window.close();
});

/** A preview document whose cookies throw like an opaque-origin sandbox (unless `native`). */
function preview({ native = false } = {}) {
  dom = new JSDOM('<iframe></iframe>', { url: 'https://editor.example' });
  const win = dom.window.document.querySelector('iframe')?.contentWindow;
  if (!win) throw new Error('Missing preview window');
  win.document.body.innerHTML =
    '<button id="start">Start</button><p id="result">Waiting</p><p id="status">Idle</p>';
  if (native) {
    // jsdom stores no cookies for about:blank; model a document where cookies work.
    let jar = '';
    Object.defineProperty(win.document, 'cookie', {
      configurable: true,
      get: () => jar,
      set: (value) => {
        jar = String(value).split(';')[0];
      },
    });
  } else {
    const blocked = () => {
      throw new win.DOMException(
        "The document is sandboxed and lacks the 'allow-same-origin' flag.",
        'SecurityError',
      );
    };
    Object.defineProperty(win.document, 'cookie', {
      configurable: true,
      get: blocked,
      set: blocked,
    });
  }
  const messages = [];
  win.parent.postMessage = (message) => messages.push(message);
  new Function('window', 'document', library.previewBridgeSource('https://editor.example'))(
    win,
    win.document,
  );
  const send = (type, detail = {}) =>
    win.dispatchEvent(
      new dom.window.MessageEvent('message', {
        origin: 'https://editor.example',
        source: win.parent,
        data: { protocol: 'visual-dxp:preview', channel: 'cookies', type, ...detail },
      }),
    );
  send('init');
  return { win, doc: win.document, messages, send };
}

const node = (id, kind, config) => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: { kind, label: id, config },
});
// Click → seen? → true: "Already seen" / false: remember + "First time".
const onceWorkflow = {
  version: 1,
  name: 'Once',
  websiteUrl: 'https://editor.example',
  nodes: [
    node('click', 'trigger', { event: 'click', selector: '#start' }),
    node('seen', 'fork', {
      conditionType: 'cookie',
      conditionKey: 'dxp_seen',
      conditionValue: 'yes',
    }),
    node('again', 'dom', { selector: '#result', value: 'Already seen' }),
    node('remember', 'cookie', { cookieName: 'dxp_seen', cookieValue: 'yes', cookieDays: 365 }),
    node('first', 'dom', { selector: '#result', value: 'First time' }),
  ],
  edges: [
    { id: 'e1', source: 'click', target: 'seen' },
    { id: 'e2', source: 'seen', target: 'again', sourceHandle: 'true' },
    { id: 'e3', source: 'seen', target: 'remember', sourceHandle: 'false' },
    { id: 'e4', source: 'remember', target: 'first' },
  ],
};

it('keeps cookies in memory in a sandboxed preview, like document.cookie', () => {
  const { doc } = preview();
  expect(doc.cookie).toBe('');
  doc.cookie = 'a=1; Path=/; SameSite=Lax';
  doc.cookie = 'b=two words; Max-Age=60; Secure';
  expect(doc.cookie).toBe('a=1; b=two words');
  // Updates keep their position; Max-Age wins over Expires; zero or past values delete.
  doc.cookie = 'a=3; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=60';
  expect(doc.cookie).toBe('a=3; b=two words');
  doc.cookie = 'a=; Max-Age=0';
  doc.cookie = 'b=; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  expect(doc.cookie).toBe('');
  doc.cookie = 'nameless';
  expect(doc.cookie).toBe('nameless');
});

it('expires in-memory cookies after Max-Age', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const { doc } = preview();
  doc.cookie = 'short=1; Max-Age=2';
  doc.cookie = 'long=1';
  vi.advanceTimersByTime(1999);
  expect(doc.cookie).toBe('short=1; long=1');
  vi.advanceTimersByTime(1);
  expect(doc.cookie).toBe('long=1');
});

it('lets cookie steps and conditions work within a run and clears them on restart', async () => {
  const { doc, messages, send } = preview();
  const click = async () => {
    doc.querySelector('#start').click();
    await vi.waitFor(() => expect(doc.querySelector('#result').textContent).not.toBe('Waiting'));
    const text = doc.querySelector('#result').textContent;
    doc.querySelector('#result').textContent = 'Waiting';
    return text;
  };
  send('run', { runId: 'run-1', workflow: onceWorkflow });
  expect(await click()).toBe('First time');
  expect(doc.cookie).toBe('dxp_seen=yes');
  expect(await click()).toBe('Already seen');
  const errors = messages.filter(
    (message) => message.type === 'log' && message.log.status === 'error',
  );
  expect(errors).toEqual([]);

  // Restart: the editor stops and runs again in the same document.
  send('stop');
  send('run', { runId: 'run-2', workflow: onceWorkflow });
  expect(doc.cookie).toBe('');
  expect(await click()).toBe('First time');
  expect(await click()).toBe('Already seen');
});

it('leaves native cookies alone when the document can use them', () => {
  const { win, doc, send } = preview({ native: true });
  const accessor = Object.getOwnPropertyDescriptor(doc, 'cookie');
  doc.cookie = 'real=1';
  send('run', { runId: 'run-1', workflow: onceWorkflow });
  // Real cookies belong to the website and are never cleared by the preview.
  expect(doc.cookie).toBe('real=1');
  expect(Object.getOwnPropertyDescriptor(win.document, 'cookie')).toEqual(accessor);
});
