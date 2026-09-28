// Run after npm run build:lib to verify runtime serialization in both distributed bundles.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as esm from '../dist/dlb-dxp.js';

const require = createRequire(import.meta.url);
const umd = require('../dist/dlb-dxp.umd.cjs');
let cases = 0;
for (const library of [esm, umd]) {
  for (const includeSubpages of [false, true]) {
    const workflow = {
      version: 1,
      name: 'Built library targeting',
      websiteUrl: 'https://example.com/products',
      includeSubpages,
      nodes: [
        {
          id: 'load',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 'Visit', config: { event: 'page-load' } },
        },
        {
          id: 'click',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'trigger',
            label: 'Click',
            config: { event: 'click', selector: '#button' },
          },
        },
        {
          id: 'update',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'dom', label: 'Update', config: { selector: '#result', value: 'Ran' } },
        },
      ],
      edges: [
        { id: 'load-update', source: 'load', target: 'update' },
        { id: 'click-update', source: 'click', target: 'update' },
      ],
    };
    const script = library.exportWorkflow(workflow);
    for (const [url, matches] of [
      ['https://example.com/products?x#y', true],
      ['https://example.com/products/item', includeSubpages],
      ['https://example.com/products-sale', false],
      ['https://sub.example.com/products', false],
      ['https://other.example/products', false],
    ]) {
      const dom = new JSDOM('<button id="button">Click</button><p id="result">Waiting</p>', {
        url,
        runScripts: 'outside-only',
      });
      const page = dom.window;
      let destroyed = false;
      const previous = {
        destroy: () => {
          destroyed = true;
        },
      };
      page.dlbDXP = previous;
      try {
        page.eval(script);
        page.document.dispatchEvent(new page.Event('DOMContentLoaded'));
        await new Promise(setImmediate);
        assert.equal(destroyed, matches);
        assert.equal(page.dlbDXP !== previous, matches);
        assert.equal(
          page.document.querySelector('#result').textContent,
          matches ? 'Ran' : 'Waiting',
        );
        page.document.querySelector('#result').textContent = 'Waiting';
        page.document.querySelector('#button').click();
        await new Promise(setImmediate);
        assert.equal(
          page.document.querySelector('#result').textContent,
          matches ? 'Ran' : 'Waiting',
        );
        cases += 1;
      } finally {
        page.dlbDXP?.destroy();
        page.close();
      }
    }
  }
}
console.log(`Built ESM and UMD standalone scripts: ${cases} targeting cases passed.`);
