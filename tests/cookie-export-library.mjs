// Run after pnpm run build:lib to verify cookie variables in both distributed bundles.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

// The browser editor bundle includes DOM-based Markdown entity decoding.
const editorDom = new JSDOM('');
globalThis.document = editorDom.window.document;
const esm = await import('../dist/visual-dxp.js');
const require = createRequire(import.meta.url);
const umd = require('../dist/visual-dxp.umd.cjs');
delete globalThis.document;
editorDom.window.close();

let cookieCases = 0;
for (const library of [esm, umd]) {
  for (const missingName of [false, true]) {
    const node = (id, kind, config) => ({
      id,
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind, label: id, config },
    });
    const input = { ...(missingName ? {} : { id: 42 }), label: '{{id}}; café 🍪', enabled: false };
    const workflow = {
      version: 1,
      name: 'Built cookie templates',
      websiteUrl: 'https://example.com',
      nodes: [
        node('start', 'trigger', { event: 'click', selector: '#start' }),
        node('request', 'http', { url: 'https://example.com/data' }),
        node('cookie', 'cookie', {
          cookieName: 'audience_{{id}}',
          cookieValue: '{{label}}/{{enabled}}',
        }),
        node('forward', 'dom', { selector: '#result', value: '{{$}}' }),
      ],
      edges: [
        { id: 'start-request', source: 'start', target: 'request' },
        { id: 'request-cookie', source: 'request', target: 'cookie' },
        { id: 'cookie-forward', source: 'cookie', target: 'forward' },
      ],
    };
    assert.deepEqual(library.validateWorkflow(workflow), []);
    const dom = new JSDOM('<button id="start">Run</button><p id="result">Waiting</p>', {
      url: 'https://example.com',
      runScripts: 'outside-only',
    });
    dom.window.fetch = async () => new Response(JSON.stringify(input));
    try {
      dom.window.eval(library.exportWorkflow(workflow));
      if (missingName) {
        await assert.rejects(dom.window.visualDXP.run(), /missing in the cookie name/);
        assert.equal(dom.window.document.cookie, '');
        assert.equal(dom.window.document.querySelector('#result').textContent, 'Waiting');
      } else {
        await dom.window.visualDXP.run();
        assert.equal(
          dom.window.document.cookie,
          `audience_42=${encodeURIComponent(`${input.label}/false`)}`,
        );
        assert.equal(
          dom.window.document.querySelector('#result').textContent,
          JSON.stringify(input),
        );
      }
      cookieCases += 1;
    } finally {
      dom.window.visualDXP?.destroy();
      dom.window.close();
    }
  }
}
console.log(`Built ESM and UMD standalone scripts: ${cookieCases} cookie template cases passed.`);
