// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommerceEventData } from '../src/lib/commerce';
import { exportWorkflow } from '../src/lib/export';
import { previewBridgeSource } from '../src/lib/previewBridge';
import { createRuntime } from '../src/lib/runtime';
import type { RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function node(id: string, kind: WorkflowNode['data']['kind'], config: StepConfig): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function graph(): Workflow {
  return {
    version: 1,
    name: 'Commerce',
    websiteUrl: window.location.origin,
    nodes: [
      node('add', 'trigger', {
        event: 'commerce-product-added-to-cart',
        commercePlatform: 'shopify',
      }),
      node('condition', 'fork', {
        conditionType: 'data',
        conditionDataPath: 'platform',
        conditionOperator: 'equal',
        conditionValue: 'shopify',
      }),
      node('output', 'dom', { selector: '#result', valueSource: 'incoming-data' }),
    ],
    edges: [
      { id: 'a', source: 'add', target: 'condition' },
      { id: 'b', source: 'condition', target: 'output', sourceHandle: 'true' },
    ],
  };
}
function result(totalQuantity = 9) {
  return {
    cart: {
      id: 'gid://shopify/Cart/example',
      totalQuantity,
      cost: { totalAmount: { amount: '19.90', currencyCode: 'EUR' } },
      lines: [
        {
          id: 'opaque-line-key',
          quantity: totalQuantity,
          cost: { totalAmount: { amount: '19.90', currencyCode: 'EUR' } },
        },
      ],
    },
    userErrors: [],
    warnings: [],
  };
}
const request = [{ merchandiseId: 'gid://shopify/ProductVariant/123', quantity: 2 }];
function event(promise: Promise<unknown>, overrides: Record<string, unknown> = {}) {
  return Object.assign(new Event('shopify:cart:lines-update', { bubbles: true }), {
    action: 'add',
    lines: request,
    promise,
    ...overrides,
  });
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function data(): CommerceEventData {
  return JSON.parse(document.querySelector('#result')!.textContent!);
}
const instances: ReturnType<typeof createRuntime>[] = [];
beforeEach(() => {
  document.body.innerHTML = '<button id="source">Add</button><p id="result">waiting</p>';
});
afterEach(() => {
  for (const runtime of instances.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
});

describe.each(['direct', 'exported'] as const)('%s commerce runtime', (mode) => {
  function start(workflow = graph(), logs: RunLog[] = []) {
    let runtime: ReturnType<typeof createRuntime>;
    if (mode === 'direct') {
      runtime = createRuntime(workflow, { onLog: (entry) => logs.push(entry) });
      runtime.start();
    } else {
      new Function('window', 'document', exportWorkflow(workflow))(window, document);
      runtime = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP!;
    }
    instances.push(runtime);
    return runtime;
  }

  it('awaits direct event properties and passes distinct request, addition and cart data through conditions and actions', async () => {
    start();
    const operation = deferred();
    document.querySelector('#source')!.dispatchEvent(event(operation.promise));
    await flush();
    expect(document.querySelector('#result')!.textContent).toBe('waiting');
    operation.resolve(result());
    await flush();
    expect(data()).toEqual({
      platform: 'shopify',
      event: 'product-added-to-cart',
      requested: {
        lines: [{ variantId: request[0].merchandiseId, quantity: 2 }],
        totalQuantity: 2,
      },
      addition: {
        basis: 'successful-mutation',
        lines: [{ variantId: request[0].merchandiseId, quantity: 2 }],
        totalQuantity: 2,
      },
      cart: {
        id: 'gid://shopify/Cart/example',
        totalQuantity: 9,
        totalAmount: { amount: '19.90', currencyCode: 'EUR' },
        lines: [
          {
            id: 'opaque-line-key',
            quantity: 9,
            totalAmount: { amount: '19.90', currencyCode: 'EUR' },
          },
        ],
      },
      warnings: [],
    });
  });

  it.each([
    ['network rejection', () => Promise.reject(new Error('network'))],
    ['abort', () => Promise.reject(new DOMException('aborted', 'AbortError'))],
    [
      'userErrors',
      () => Promise.resolve({ ...result(), userErrors: [{ code: 'INVALID', message: 'refused' }] }),
    ],
    [
      'partial userErrors',
      () => Promise.resolve({ ...result(1), userErrors: [{ message: 'one variant refused' }] }),
    ],
    [
      'stock cap warning',
      () =>
        Promise.resolve({
          ...result(),
          warnings: [
            {
              code: 'MERCHANDISE_NOT_ENOUGH_STOCK',
              target: 'opaque-line-key',
              message: 'adjusted',
            },
          ],
        }),
    ],
    [
      'out of stock warning',
      () =>
        Promise.resolve({
          ...result(),
          warnings: [{ code: 'MERCHANDISE_OUT_OF_STOCK', message: 'none added' }],
        }),
    ],
    [
      'unknown warning',
      () => Promise.resolve({ ...result(), warnings: [{ code: 'FUTURE_WARNING' }] }),
    ],
    ['malformed warnings', () => Promise.resolve({ ...result(), warnings: {} })],
    ['malformed errors', () => Promise.resolve({ ...result(), userErrors: null })],
    ['missing cart', () => Promise.resolve({ userErrors: [], warnings: [] })],
    ['null cart', () => Promise.resolve({ cart: null })],
    ['empty cart object', () => Promise.resolve({ cart: {} })],
    ['zero cart', () => Promise.resolve(result(0))],
    ['insufficient cart', () => Promise.resolve(result(1))],
    ['insufficient line total', () => Promise.resolve({ cart: { lines: [{ quantity: 1 }] } })],
    ['missing result', () => Promise.resolve(undefined)],
  ])('skips %s without downstream success', async (_name, outcome) => {
    const logs: RunLog[] = [];
    start(graph(), logs);
    document.dispatchEvent(event(outcome()));
    await flush();
    expect(document.querySelector('#result')!.textContent).toBe('waiting');
    expect(logs.some((entry) => entry.status === 'success')).toBe(false);
    if (mode === 'direct') expect(logs[0]?.status).toBe('error');
  });

  it('represents absent fields explicitly and never invents quantities, products or money', async () => {
    start();
    document.dispatchEvent(
      event(Promise.resolve({ cart: { lines: [{ quantity: 4 }] } }), {
        lines: [{ merchandiseId: 123 }],
      }),
    );
    await flush();
    expect(data()).toMatchObject({
      requested: { lines: [{ variantId: '123', quantity: null }], totalQuantity: null },
      addition: { lines: [{ variantId: '123', quantity: null }], totalQuantity: null },
      cart: {
        id: null,
        totalQuantity: null,
        totalAmount: null,
        lines: [{ id: null, quantity: 4, totalAmount: null }],
      },
    });
    document.dispatchEvent(event(Promise.resolve({ cart: { totalQuantity: 10 } })));
    await flush();
    expect(data().cart.lines).toBeNull();
    expect(data().cart.totalAmount).toBeNull();
  });

  it('retains batch variants and partial MoneyV2 fields without inferring missing currency', async () => {
    start();
    document.dispatchEvent(
      event(
        Promise.resolve({ cart: { totalQuantity: 8, cost: { totalAmount: { amount: '20.00' } } } }),
        {
          lines: [
            { merchandiseId: 123, quantity: 2 },
            { merchandiseId: 'gid://shopify/ProductVariant/456', quantity: 3 },
          ],
        },
      ),
    );
    await flush();
    expect(data().requested).toEqual({
      lines: [
        { variantId: '123', quantity: 2 },
        { variantId: 'gid://shopify/ProductVariant/456', quantity: 3 },
      ],
      totalQuantity: 5,
    });
    expect(data().addition.totalQuantity).toBe(5);
    expect(data().cart.totalQuantity).toBe(8);
    expect(data().cart.totalAmount).toEqual({ amount: '20.00', currencyCode: null });
  });

  it('ignores initialization, removals, updates, malformed requests and CustomEvent.detail wrappers', async () => {
    start();
    for (const action of ['remove', 'update', 'init', undefined])
      document.dispatchEvent(event(Promise.resolve(result()), { action }));
    for (const lines of [
      [],
      null,
      [{ quantity: 1 }],
      [{ merchandiseId: 'v', quantity: 0 }],
      [{ merchandiseId: 'v', quantity: -1 }],
    ])
      document.dispatchEvent(event(Promise.resolve(result()), { lines }));
    document.dispatchEvent(event(Promise.resolve(result()), { promise: undefined }));
    document.dispatchEvent(
      new CustomEvent('shopify:cart:lines-update', {
        detail: { action: 'add', lines: request, promise: Promise.resolve(result()) },
      }),
    );
    document.dispatchEvent(Object.assign(new Event('shopify:cart:init'), { cart: result().cart }));
    await flush();
    expect(document.querySelector('#result')!.textContent).toBe('waiting');
  });

  it('deduplicates only the same event, supports multiple subscribers and preserves separate identical additions', async () => {
    const workflow = graph();
    workflow.nodes.push(node('add2', 'trigger', { event: 'commerce-product-added-to-cart' }));
    workflow.edges.push({ id: 'second', source: 'add2', target: 'condition' });
    const calls: string[] = [];
    const output = document.querySelector('#result')!;
    const setter = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!.set!;
    vi.spyOn(output, 'textContent', 'set').mockImplementation((value) => {
      calls.push(value!);
      setter.call(output, value);
    });
    const runtime = start(workflow);
    runtime.start();
    const pending = deferred();
    const observed = event(pending.promise);
    document.dispatchEvent(observed);
    document.dispatchEvent(observed);
    pending.resolve(result());
    await flush();
    document.dispatchEvent(observed);
    await flush();
    expect(calls).toHaveLength(2);
    document.dispatchEvent(event(Promise.resolve(result())));
    document.dispatchEvent(event(Promise.resolve(result())));
    await flush();
    expect(calls).toHaveLength(6);
  });

  it('isolates concurrent out-of-order additions and sibling paths that replace incoming data', async () => {
    const workflow = graph();
    workflow.nodes.push(node('request', 'http', { url: 'https://example.com/fixture' }));
    workflow.edges.unshift({ id: 'sibling', source: 'add', target: 'request' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"platform":"unrelated"}'));
    const captured: CommerceEventData[] = [];
    vi.spyOn(document.querySelector('#result')!, 'textContent', 'set').mockImplementation(
      (value) => {
        captured.push(JSON.parse(value!));
      },
    );
    start(workflow);
    const one = deferred();
    const two = deferred();
    const lines = [{ merchandiseId: 'first', quantity: 2 }];
    document.dispatchEvent(event(one.promise, { lines }));
    document.dispatchEvent(
      event(two.promise, { lines: [{ merchandiseId: 'second', quantity: 3 }] }),
    );
    lines[0].quantity = 99;
    two.resolve(result(7));
    await flush();
    one.resolve(result(10));
    await flush();
    expect(
      captured.map((entry) => [
        entry.requested.lines[0].variantId,
        entry.addition.totalQuantity,
        entry.cart.totalQuantity,
      ]),
    ).toEqual([
      ['second', 3, 7],
      ['first', 2, 10],
    ]);
  });

  it('removes listeners and cancels pending success after destruction', async () => {
    const runtime = start();
    const remove = vi.spyOn(document, 'removeEventListener');
    const rejection = deferred();
    document.dispatchEvent(event(rejection.promise));
    const operation = deferred();
    document.dispatchEvent(event(operation.promise));
    runtime.destroy();
    expect(remove).toHaveBeenCalledWith('shopify:cart:lines-update', expect.any(Function));
    operation.resolve(result());
    rejection.reject(new DOMException('cancelled', 'AbortError'));
    document.dispatchEvent(event(Promise.resolve(result())));
    await flush();
    expect(document.querySelector('#result')!.textContent).toBe('waiting');
  });

  it('keeps manual execution empty and existing triggers compatible', async () => {
    const workflow = graph();
    workflow.nodes[1].data.config = { conditionType: 'data', conditionOperator: 'not-exists' };
    workflow.nodes[2].data.config = { selector: '#result', value: 'manual' };
    const runtime = start(workflow);
    await runtime.run('add');
    expect(document.querySelector('#result')!.textContent).toBe('manual');
  });
});

it('uses only the injected target document and handles an external abort while pending', async () => {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<p id="result">waiting</p>';
  const controller = new AbortController();
  const runtime = createRuntime(graph(), {
    document: doc,
    window: frame.contentWindow!,
    signal: controller.signal,
  });
  instances.push(runtime);
  runtime.start();
  document.dispatchEvent(event(Promise.resolve(result())));
  await flush();
  expect(doc.querySelector('#result')!.textContent).toBe('waiting');
  doc.dispatchEvent(event(Promise.resolve(result())));
  await flush();
  expect(JSON.parse(doc.querySelector('#result')!.textContent!).platform).toBe('shopify');
  doc.querySelector('#result')!.textContent = 'waiting';
  const pending = deferred();
  doc.dispatchEvent(event(pending.promise));
  controller.abort();
  pending.resolve(result());
  await flush();
  expect(doc.querySelector('#result')!.textContent).toBe('waiting');
  expect(document.querySelector('#result')!.textContent).toBe('waiting');
});

it('runs the serialized preview bridge and stops a pending addition through its message protocol', async () => {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const win = frame.contentWindow!;
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<p id="result">waiting</p>';
  new Function('window', 'document', previewBridgeSource(window.location.origin))(win, doc);
  const send = (type: string) =>
    win.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: win.parent,
        data: { protocol: 'visual-dxp:preview', channel: 'test', type, workflow: graph() },
      }),
    );
  send('init');
  send('run');
  doc.dispatchEvent(event(Promise.resolve(result())));
  await flush();
  expect(JSON.parse(doc.querySelector('#result')!.textContent!).addition.totalQuantity).toBe(2);
  doc.querySelector('#result')!.textContent = 'waiting';
  const pending = deferred();
  doc.dispatchEvent(event(pending.promise));
  send('stop');
  pending.resolve(result());
  await flush();
  expect(doc.querySelector('#result')!.textContent).toBe('waiting');
});
