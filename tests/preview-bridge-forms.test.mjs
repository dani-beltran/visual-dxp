import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { afterEach, beforeAll, expect, it } from 'vitest';

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
afterEach(() => dom?.window.close());

function preview(body) {
  dom = new JSDOM('<iframe></iframe>', { url: 'https://editor.example' });
  const win = dom.window.document.querySelector('iframe')?.contentWindow;
  if (!win) throw new Error('Missing preview window');
  win.document.body.innerHTML = body;
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
        data: { protocol: 'visual-dxp:preview', channel: 'forms', type, ...detail },
      }),
    );
  send('init');
  return { win, messages, send };
}

const node = (id, kind, config) => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: { kind, label: id, config },
});
const graph = (nodes, edges) => ({
  version: 1,
  name: 'Forms',
  websiteUrl: 'https://editor.example',
  nodes,
  edges: edges.map(([source, target], index) => ({ id: `e${index}`, source, target })),
});

it('captures popover form submissions in the preview and logs the data passed on', async () => {
  const { win, messages, send } = preview('<p id="result">Waiting</p>');
  send('run', {
    runId: 'run-1',
    workflow: graph(
      [
        node('start', 'trigger', { event: 'page-load' }),
        node('signup', 'popover', {
          content:
            '<form action="https://elsewhere.example/subscribe"><input name="email" value="ada@example.com"><button>Join</button></form>',
        }),
        node('update', 'dom', { selector: '#result', value: '{{email}}' }),
      ],
      [
        ['start', 'signup'],
        ['signup', 'update'],
      ],
    ),
  });
  await expect
    .poll(() => win.document.querySelector('[data-visual-dxp-popover] form'))
    .not.toBeNull();
  win.document.querySelector('[data-visual-dxp-popover] form button').click();
  await expect
    .poll(() => win.document.querySelector('#result').textContent)
    .toBe('ada@example.com');
  expect(win.location.href).toBe('about:blank');
  const logs = messages.filter((message) => message.type === 'log').map(({ log }) => log);
  const captured = logs.find((log) => log.nodeId === 'signup' && log.data !== undefined);
  expect(captured).toMatchObject({
    status: 'success',
    message:
      'Form submission captured. The form was not sent; this data is passed to the next step:',
    data: '{\n  "email": "ada@example.com"\n}',
  });
  const edge = messages.find(
    (message) => message.type === 'connection-preview' && message.edgeId === 'e1',
  );
  expect(JSON.parse(captured.data)).toEqual(edge.preview.source.value);
});

it('lets page forms fire submit triggers but never submits them natively', async () => {
  const { win, messages, send } = preview(
    '<form id="newsletter" action="https://elsewhere.example/"><input name="email"><button>Go</button></form><p id="result">Waiting</p>',
  );
  const seenByPage = [];
  win.document
    .querySelector('#newsletter')
    .addEventListener('submit', (event) => seenByPage.push(event.defaultPrevented));
  send('run', {
    runId: 'run-2',
    workflow: graph(
      [
        node('submitted', 'trigger', { event: 'submit', selector: '#newsletter' }),
        node('update', 'dom', { selector: '#result', value: 'Trigger ran' }),
      ],
      [['submitted', 'update']],
    ),
  });
  await expect.poll(() => messages.some((message) => message.type === 'log')).toBe(false);
  win.document.querySelector('#newsletter button').click();
  await expect.poll(() => win.document.querySelector('#result').textContent).toBe('Trigger ran');
  // Page scripts still receive the event, already cancelled by the bridge.
  expect(seenByPage).toEqual([true]);
  // Programmatic submission skips submit events; the bridge turns it into a no-op.
  const info = [];
  win.console.info = (...args) => info.push(args.join(' '));
  win.document.querySelector('#newsletter').submit();
  expect(info).toEqual(['[Visual DXP preview] Form submission is disabled in previews.']);
  expect(win.location.href).toBe('about:blank');
});
