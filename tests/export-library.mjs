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

let dataCases = 0;
for (const library of [esm, umd]) {
  for (const selected of [false, true]) {
    for (const price of [12, 4]) {
      const node = (id, kind, config) => ({
        id,
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind, label: id, config },
      });
      const workflow = {
        version: 1,
        name: 'Built response data',
        websiteUrl: 'https://example.com',
        nodes: [
          node('start', 'trigger', { event: 'click', selector: '#start' }),
          node('request', 'http', {
            url: 'https://example.com/api',
            responseDataPath: selected ? 'items[0].price' : '',
          }),
          node('condition', 'fork', {
            conditionType: 'data',
            conditionDataPath: selected ? '' : 'items[0].price',
            conditionOperator: 'greater-than',
            conditionValue: '10',
          }),
          node('yes', 'dom', { selector: '#result', value: 'yes' }),
          node('no', 'dom', { selector: '#result', value: 'no' }),
        ],
        edges: [
          { id: 'a', source: 'start', target: 'request' },
          { id: 'b', source: 'request', target: 'condition' },
          { id: 'c', source: 'condition', target: 'yes', sourceHandle: 'true' },
          { id: 'd', source: 'condition', target: 'no', sourceHandle: 'false' },
        ],
      };
      const dom = new JSDOM('<button id="start">Run</button><p id="result">waiting</p>', {
        url: 'https://example.com',
        runScripts: 'outside-only',
      });
      dom.window.fetch = async () => new Response(JSON.stringify({ items: [{ price }] }));
      try {
        dom.window.eval(library.exportWorkflow(workflow));
        await dom.window.dlbDXP.run();
        assert.equal(
          dom.window.document.querySelector('#result').textContent,
          price > 10 ? 'yes' : 'no',
        );
        dataCases += 1;
      } finally {
        dom.window.dlbDXP?.destroy();
        dom.window.close();
      }
    }
  }
}
console.log(
  `Built ESM and UMD standalone scripts: ${dataCases} HTTP → Data → branch cases passed.`,
);
