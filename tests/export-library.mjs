// Run after pnpm run build:lib to verify runtime serialization in both distributed bundles.
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
          }),
          node('update', 'dom', {
            selector: '#price',
            action: 'text',
            value: selected ? '{{$}}' : '{{items[0].price}}',
          }),
          node('condition', 'fork', {
            conditionType: 'data',
            conditionOperator: 'greater-than',
            conditionValue: '10',
          }),
          node('select', 'transform', { dataPath: 'items[0].price' }),
          node('yes', 'dom', { selector: '#result', value: 'yes' }),
          node('no', 'dom', { selector: '#result', value: 'no' }),
        ],
        edges: [
          { id: 'a', source: 'start', target: 'request' },
          { id: 'b', source: 'request', target: selected ? 'select' : 'update' },
          { id: 'select-out', source: 'select', target: selected ? 'update' : 'condition' },
          { id: 'update-condition', source: 'update', target: selected ? 'condition' : 'select' },
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

let experimentCases = 0;
for (const library of [esm, umd]) {
  for (const split of [0, 100]) {
    const node = (id, kind, config) => ({
      id,
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind, label: id, config },
    });
    const workflow = {
      version: 1,
      name: 'Built experiment',
      websiteUrl: 'https://example.com',
      nodes: [
        node('start', 'trigger', { event: 'click', selector: '#start' }),
        node('test', 'experiment', { experimentSplit: split }),
        node('a', 'dom', { selector: '#result', value: 'A' }),
        node('b', 'dom', { selector: '#result', value: 'B' }),
      ],
      edges: [
        { id: 'start-test', source: 'start', target: 'test' },
        { id: 'test-a', source: 'test', target: 'a', sourceHandle: 'a' },
        { id: 'test-b', source: 'test', target: 'b', sourceHandle: 'b' },
      ],
    };
    const dom = new JSDOM('<button id="start">Run</button><p id="result">waiting</p>', {
      url: 'https://example.com',
      runScripts: 'outside-only',
    });
    try {
      dom.window.eval(library.exportWorkflow(workflow));
      await dom.window.visualDXP.run();
      const expected = split === 100 ? 'A' : 'B';
      assert.equal(dom.window.document.querySelector('#result').textContent, expected);
      workflow.nodes[1].data.config.experimentSplit = 100 - split;
      dom.window.eval(library.exportWorkflow(workflow));
      await dom.window.visualDXP.run();
      assert.equal(dom.window.document.querySelector('#result').textContent, expected);
      experimentCases += 1;
    } finally {
      dom.window.visualDXP?.destroy();
      dom.window.close();
    }
  }
}
console.log(
  `Built ESM and UMD standalone scripts: ${experimentCases} Experiment routing and persistence cases passed.`,
);

let analyticsCases = 0;
for (const library of [esm, umd]) {
  for (const variant of ['a', 'b']) {
    for (const interaction of ['click', 'change']) {
      for (const delivery of ['gtag', 'gtm']) {
        const dom = new JSDOM('<button id="start">Run</button><main id="slot"></main>', {
          url: 'https://example.com',
          runScripts: 'outside-only',
        });
        const page = dom.window;
        Object.defineProperty(page.document, 'hidden', { get: () => false });
        page.Element.prototype.getBoundingClientRect = () => ({
          top: 10,
          bottom: 40,
          left: 10,
          right: 110,
          width: 100,
          height: 30,
        });
        const events = [];
        page.gtag = (...args) => events.push(args);
        page.dataLayer = [];
        const step = (id, kind, config) => ({
          id,
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind, label: id, config },
        });
        const workflow = {
          version: 1,
          name: 'Built analytics',
          websiteUrl: 'https://example.com',
          nodes: [
            step('start', 'trigger', { event: 'click', selector: '#start' }),
            step('experiment', 'experiment', {
              experimentSplit: variant === 'a' ? 100 : 0,
              experimentAnalytics: 'ga4',
              experimentKey: 'built-test',
              experimentSelector: '.cta',
              experimentInteraction: interaction,
              experimentDelivery: delivery,
            }),
            ...['a', 'b'].map((id) =>
              step(id, 'dom', {
                selector: '#slot',
                action: 'html',
                value: `<button class="cta"><span>${id}</span></button>`,
              }),
            ),
          ],
          edges: [
            { id: 'start-experiment', source: 'start', target: 'experiment' },
            ...['a', 'b'].map((id) => ({ id, source: 'experiment', target: id, sourceHandle: id })),
          ],
        };
        try {
          page.eval(library.exportWorkflow(workflow));
          await page.visualDXP.run();
          await new Promise((resolve) => page.setTimeout(resolve, 25));
          assert.equal(page.document.querySelector('.cta').textContent, variant);
          await page.visualDXP.run();
          await new Promise((resolve) => page.setTimeout(resolve, 25));
          page.document
            .querySelector('.cta span')
            .dispatchEvent(new page.Event(interaction, { bubbles: true }));
          const parameters = { experiment_id: 'built-test', variant_id: variant };
          if (delivery === 'gtag') {
            assert.deepEqual(JSON.parse(JSON.stringify(events)), [
              ['event', 'experiment_view', parameters],
              ['event', 'experiment_cta', { ...parameters, cta_type: interaction }],
            ]);
            assert.equal(page.dataLayer.length, 0);
          } else {
            assert.equal(events.length, 0);
            assert.equal(
              JSON.stringify(page.dataLayer),
              JSON.stringify([
                { event: 'experiment_view', ...parameters },
                { event: 'experiment_cta', ...parameters, cta_type: interaction },
              ]),
            );
          }
          page.visualDXP.destroy();
          page.document
            .querySelector('.cta')
            .dispatchEvent(new page.Event(interaction, { bubbles: true }));
          assert.equal(delivery === 'gtag' ? events.length : page.dataLayer.length, 2);
          analyticsCases += 1;
        } finally {
          page.visualDXP?.destroy();
          page.close();
        }
      }
    }
  }
}
console.log(`Built ESM and UMD standalone scripts: ${analyticsCases} analytics cases passed.`);

let interceptionCases = 0;
for (const library of [esm, umd]) {
  for (const delivery of ['gtag', 'gtm']) {
    const dom = new JSDOM('<button id="start">Start</button>', {
      url: 'https://example.com',
      runScripts: 'outside-only',
    });
    const page = dom.window;
    page.dataLayer = [];
    const originalPush = page.dataLayer.push;
    const originalTag = function () {
      // biome-ignore lint/complexity/noArguments: match the standard Google tag implementation.
      return page.dataLayer.push(arguments);
    };
    page.gtag = originalTag;
    try {
      page.eval(
        library.exportWorkflow({
          version: 1,
          name: 'Built page capture',
          websiteUrl: 'https://example.com',
          analytics: { provider: 'ga4', delivery },
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
        }),
      );
      await page.visualDXP.run('start');
      assert.equal(page.gtag('event', 'site_purchase', { value: 10 }), 3);
      page.dataLayer.push({ event: 'site_purchase' });
      const stored = JSON.parse(page.sessionStorage.getItem('visual-dxp:analytics:v1'));
      assert.deepEqual(
        stored.events.map(({ name }) => name),
        ['dxp_workflow_started', 'dxp_workflow_completed', 'site_purchase', 'site_purchase'],
      );
      assert.deepEqual(stored.events[2].data, ['event', 'site_purchase', { value: 10 }]);
      assert.deepEqual(stored.events[3].data, { event: 'site_purchase' });
      page.visualDXP.destroy();
      assert.equal(page.gtag, originalTag);
      assert.equal(page.dataLayer.push, originalPush);
      interceptionCases++;
    } finally {
      page.visualDXP?.destroy();
      page.close();
    }
  }
}
console.log(
  `Built ESM and UMD standalone scripts: ${interceptionCases} page interception cases passed.`,
);
