// Run after npm run build:lib to verify runtime serialization in both distributed bundles.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as esm from '../dist/visual-dxp.js';

const require = createRequire(import.meta.url);
const umd = require('../dist/visual-dxp.umd.cjs');
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
      page.visualDXP = previous;
      try {
        page.eval(script);
        page.document.dispatchEvent(new page.Event('DOMContentLoaded'));
        await new Promise(setImmediate);
        assert.equal(destroyed, matches);
        assert.equal(page.visualDXP !== previous, matches);
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
        page.visualDXP?.destroy();
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
          node('update', 'dom', {
            selector: '#price',
            action: 'text',
            valueSource: 'incoming-data',
            valueDataPath: selected ? '' : 'items[0].price',
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
          { id: 'b', source: 'request', target: 'update' },
          { id: 'update-condition', source: 'update', target: 'condition' },
          { id: 'c', source: 'condition', target: 'yes', sourceHandle: 'true' },
          { id: 'd', source: 'condition', target: 'no', sourceHandle: 'false' },
        ],
      };
      const dom = new JSDOM(
        '<button id="start">Run</button><p id="result">waiting</p><p id="price"></p>',
        {
          url: 'https://example.com',
          runScripts: 'outside-only',
        },
      );
      dom.window.fetch = async () => new Response(JSON.stringify({ items: [{ price }] }));
      try {
        dom.window.eval(library.exportWorkflow(workflow));
        await dom.window.visualDXP.run();
        assert.equal(
          dom.window.document.querySelector('#result').textContent,
          price > 10 ? 'yes' : 'no',
        );
        assert.equal(dom.window.document.querySelector('#price').textContent, String(price));
        dataCases += 1;
      } finally {
        dom.window.visualDXP?.destroy();
        dom.window.close();
      }
    }
  }
}
console.log(
  `Built ESM and UMD standalone scripts: ${dataCases} HTTP → Update element → Incoming data condition → branch cases passed.`,
);

let commerceCases = 0;
for (const library of [esm, umd]) {
  const dom = new JSDOM('<p id="result">waiting</p>', {
    url: 'https://example.com',
    runScripts: 'outside-only',
  });
  const page = dom.window;
  const node = (id, kind, config) => ({
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind, label: id, config },
  });
  const workflow = {
    version: 1,
    name: 'Built commerce',
    websiteUrl: 'https://example.com',
    nodes: [
      node('start', 'trigger', {
        event: 'commerce-product-added-to-cart',
        commercePlatform: 'shopify',
      }),
      node('condition', 'fork', {
        conditionType: 'data',
        conditionDataPath: 'addition.totalQuantity',
        conditionOperator: 'equal',
        conditionValue: '2',
      }),
      node('output', 'dom', { selector: '#result', valueSource: 'incoming-data' }),
    ],
    edges: [
      { id: 'a', source: 'start', target: 'condition' },
      { id: 'b', source: 'condition', target: 'output', sourceHandle: 'true' },
    ],
  };
  const outcome = { cart: { totalQuantity: 9 }, userErrors: [], warnings: [] };
  const event = (promise) =>
    Object.assign(new page.Event('shopify:cart:lines-update'), {
      action: 'add',
      lines: [{ merchandiseId: '123', quantity: 2 }],
      promise,
    });
  try {
    page.eval(library.exportWorkflow(workflow));
    const output = page.document.querySelector('#result');
    page.document.dispatchEvent(event(Promise.resolve(outcome)));
    await new Promise(setImmediate);
    const data = JSON.parse(output.textContent);
    assert.equal(data.platform, 'shopify');
    assert.equal(data.requested.totalQuantity, 2);
    assert.equal(data.addition.totalQuantity, 2);
    assert.equal(data.cart.totalQuantity, 9);
    assert.equal(data.cart.totalAmount, null);
    commerceCases += 1;
    output.textContent = 'waiting';
    page.document.dispatchEvent(
      event(Promise.resolve({ ...outcome, warnings: [{ code: 'MERCHANDISE_OUT_OF_STOCK' }] })),
    );
    await new Promise(setImmediate);
    assert.equal(output.textContent, 'waiting');
    commerceCases += 1;
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    page.document.dispatchEvent(event(pending));
    page.visualDXP.destroy();
    finish(outcome);
    await new Promise(setImmediate);
    assert.equal(output.textContent, 'waiting');
    commerceCases += 1;
  } finally {
    page.visualDXP?.destroy();
    page.close();
  }
}
console.log(`Built ESM and UMD commerce: ${commerceCases} cases passed.`);
