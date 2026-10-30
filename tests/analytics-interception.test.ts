// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isAnalyticsSettings } from '../src/lib/analytics';
import { exportWorkflow } from '../src/lib/export';
import { createRuntime, getRuntimeSource } from '../src/lib/runtime';
import type { CapturedAnalyticsEvent } from '../src/lib/runtime/analytics-capture';
import { isWorkflow } from '../src/lib/serialization';
import type { Workflow } from '../src/lib/types';

const browser = window as unknown as {
  gtag?: (...args: unknown[]) => unknown;
  dataLayer?: unknown[];
  visualDXP?: ReturnType<typeof createRuntime>;
};
const liveKey = 'visual-dxp:analytics:v1';
const previewKey = 'visual-dxp:analytics:preview:v1';
const runtimes: ReturnType<typeof createRuntime>[] = [];
function graph(): Workflow {
  return {
    version: 1,
    name: 'Capture',
    websiteUrl: window.location.href,
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
  };
}
function runtime(workflow = graph(), options: Parameters<typeof createRuntime>[1] = {}) {
  const result = createRuntime(workflow, options);
  runtimes.push(result);
  return result;
}
function events(key = liveKey): CapturedAnalyticsEvent[] {
  return JSON.parse(sessionStorage.getItem(key) ?? '{"events":[]}').events;
}
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  document.body.innerHTML = '<button id="start">Start</button>';
});
afterEach(() => {
  for (const value of runtimes.splice(0)) value.destroy();
  browser.visualDXP?.destroy();
  delete browser.visualDXP;
  delete browser.gtag;
  delete browser.dataLayer;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each(['runtime', 'export', 'serialized-preview'])(
  'captures external gtag commands and GTM objects exactly once through %s',
  (mode) => {
    const layer: unknown[] = [];
    browser.dataLayer = layer;
    const tag = function (this: unknown) {
      // biome-ignore lint/complexity/noArguments: match Google's standard gtag implementation.
      return browser.dataLayer?.push(arguments);
    };
    browser.gtag = tag;
    if (mode === 'export') new Function(exportWorkflow(graph()))();
    else if (mode === 'serialized-preview') {
      const factory = new Function(`return ${getRuntimeSource()}`)() as typeof createRuntime;
      runtimes.push(factory(graph(), { analyticsMode: 'simulate' }));
    } else runtime();
    const key = mode === 'serialized-preview' ? previewKey : liveKey;
    const payload = { secret: 'kept-in-snapshot', event_callback: vi.fn() };
    expect(browser.gtag?.('event', 'purchase', payload)).toBe(1);
    expect(browser.dataLayer?.push({ event: 'purchase', payload }, { event: 'sign_up' })).toBe(3);
    browser.gtag?.('config', 'G-TEST');
    browser.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    browser.dataLayer?.push({ ecommerce: { value: 10 } }, null);
    expect(events(key)).toEqual([
      expect.objectContaining({
        name: 'purchase',
        source: 'gtag',
        simulated: false,
        data: [
          'event',
          'purchase',
          { secret: 'kept-in-snapshot', event_callback: { $type: 'Function' } },
        ],
      }),
      expect.objectContaining({
        name: 'purchase',
        source: 'dataLayer',
        data: {
          event: 'purchase',
          payload: { secret: 'kept-in-snapshot', event_callback: { $type: 'Function' } },
        },
      }),
      expect.objectContaining({ name: 'sign_up', source: 'dataLayer', data: { event: 'sign_up' } }),
    ]);
    expect(sessionStorage.getItem(key)).toContain('kept-in-snapshot');
    expect(payload.event_callback).not.toHaveBeenCalled();
    expect((layer[0] as IArguments)[2]).toBe(payload);
  },
);

it('captures custom gtag calls that bypass dataLayer and preserves receiver, result and errors', () => {
  const error = new Error('Host failure');
  const original = vi.fn(function (this: unknown, ...args: unknown[]) {
    expect(this).toBe(browser);
    if (args[1] === 'throwing') throw error;
    return 'result';
  });
  browser.gtag = original;
  runtime();
  expect(browser.gtag?.('event', 'custom')).toBe('result');
  expect(() => browser.gtag?.('event', 'throwing')).toThrow(error);
  expect(original).toHaveBeenCalledTimes(2);
  expect(events().map((event) => event.name)).toEqual(['custom', 'throwing']);
});

it('captures late tags, replaced layers, and GTM wrappers without duplicating events', () => {
  const value = runtime();
  browser.dataLayer = [];
  browser.gtag = function () {
    // biome-ignore lint/complexity/noArguments: exercise actual gtag command objects.
    return browser.dataLayer?.push(arguments);
  };
  const previousPush = browser.dataLayer.push;
  const gtmPush = vi.fn(function (this: unknown, ...items: unknown[]) {
    return Reflect.apply(previousPush, this, items);
  });
  browser.dataLayer.push = gtmPush;
  browser.gtag('event', 'late_event');
  expect(gtmPush).toHaveBeenCalledTimes(1);
  expect(events()[0]).toMatchObject({ name: 'late_event', data: ['event', 'late_event'] });
  browser.dataLayer = [];
  const latestLayer = browser.dataLayer;
  browser.dataLayer.push({ event: 'replacement' });
  value.destroy();
  expect(browser.dataLayer).toBe(latestLayer);
  expect(browser.dataLayer.push).toBe(Array.prototype.push);
  expect(Object.hasOwn(latestLayer, 'push')).toBe(false);
  browser.gtag('event', 'after_destroy');
  expect(events().map((event) => event.name)).toEqual(['late_event', 'replacement']);
});

it('shares interception between runtimes and restores latest host functions after the last destroy', () => {
  const original = vi.fn();
  browser.gtag = original;
  const one = runtime(),
    two = runtime();
  browser.gtag?.('event', 'shared');
  one.destroy();
  browser.gtag?.('event', 'shared');
  const replacement = vi.fn();
  browser.gtag = replacement;
  browser.gtag?.('event', 'shared');
  expect(events().map((event) => event.name)).toEqual(['shared', 'shared', 'shared']);
  expect(original).toHaveBeenCalledTimes(2);
  expect(replacement).toHaveBeenCalledTimes(1);
  two.destroy();
  expect(browser.gtag).toBe(replacement);
});

it('captures distinct nested events while deduplicating wrappers that forward the same call', () => {
  const layer: unknown[] = [];
  browser.dataLayer = layer;
  browser.gtag = vi.fn();
  runtime();
  const oldTag = browser.gtag;
  browser.gtag = (...args) => {
    if (args[1] === 'outer') browser.gtag?.('event', 'inner');
    return oldTag?.(...args);
  };
  browser.gtag('event', 'outer');
  const oldPush = browser.dataLayer.push;
  browser.dataLayer.push = function (...items) {
    if ((items[0] as { event?: string }).event === 'parent')
      browser.dataLayer?.push({ event: 'child' });
    return Reflect.apply(oldPush, this, items);
  };
  browser.dataLayer.push({ event: 'parent' });
  expect(events().map(({ name }) => name)).toEqual(['outer', 'inner', 'parent', 'child']);
});

it('re-hooks host property redefinitions and writable locked push methods', async () => {
  const layer: unknown[] = [];
  Object.defineProperty(layer, 'push', {
    configurable: false,
    writable: true,
    value: Array.prototype.push,
  });
  browser.dataLayer = layer;
  const value = runtime();
  const replacement = vi.fn();
  Object.defineProperty(browser, 'gtag', {
    configurable: true,
    writable: true,
    value: replacement,
  });
  const replacementPush = vi.fn(function (this: unknown[], ...items: unknown[]) {
    return Reflect.apply(Array.prototype.push, this, items);
  });
  layer.push = replacementPush;
  await vi.advanceTimersByTimeAsync(250);
  browser.gtag?.('event', 'redefined');
  browser.dataLayer.push({ event: 'locked_push' });
  expect(events().map((event) => event.name)).toEqual(['redefined', 'locked_push']);
  value.destroy();
  expect(browser.gtag).toBe(replacement);
  expect(layer.push).toBe(replacementPush);
  expect(Object.getOwnPropertyDescriptor(layer, 'push')?.configurable).toBe(false);
});

it('keeps forwarding when storage is denied, full, or corrupt', () => {
  const original = vi.fn(() => 42);
  browser.gtag = original;
  runtime();
  sessionStorage.setItem(liveKey, 'invalid-json');
  browser.gtag?.('event', 'recovered');
  expect(events()[0].name).toBe('recovered');
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  expect(browser.gtag?.('event', 'denied')).toBe(42);
  read.mockRestore();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Full');
  });
  expect(browser.gtag?.('event', 'full')).toBe(42);
  expect(original).toHaveBeenCalledTimes(3);
});

it('keeps the latest 1000 event occurrences, including repeated names, for the session', () => {
  browser.gtag = vi.fn();
  runtime();
  for (let i = 0; i < 1005; i++) browser.gtag?.('event', `event_${i}`, { index: i });
  expect(events()).toHaveLength(1000);
  expect(events()[0].name).toBe('event_5');
  const timestamp = events()[999].timestamp;
  vi.setSystemTime(Date.now() + 1000);
  browser.gtag?.('event', 'event_1004', { repeated: true });
  expect(events().at(-1)).toMatchObject({
    timestamp: timestamp + 1000,
    data: ['event', 'event_1004', { repeated: true }],
  });
  vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
  browser.gtag?.('event', 'event_1004');
  expect(events()).toHaveLength(1000);
  expect(events().filter((event) => event.name === 'event_1004')).toHaveLength(3);
});

it('retains raw events across runtime restarts within a session and starts fresh in a new session', () => {
  browser.gtag = vi.fn();
  const first = runtime();
  browser.gtag?.('event', 'session_event');
  first.destroy();
  const second = runtime();
  browser.gtag?.('event', 'session_event');
  expect(events().map((event) => event.name)).toEqual(['session_event', 'session_event']);
  expect(localStorage.getItem(liveKey)).toBeNull();
  second.destroy();
  // The browser clears sessionStorage at the end of a tab session.
  sessionStorage.clear();
  runtime();
  browser.gtag?.('event', 'fresh');
  expect(events()).toEqual([expect.objectContaining({ name: 'fresh' })]);
});

it('does not replay existing queued events or change forwarding when payload accessors throw', () => {
  const layer = [{ event: 'before_installation' }];
  browser.dataLayer = layer;
  runtime();
  const malicious = {
    get event() {
      throw new Error('Getter');
    },
  };
  expect(browser.dataLayer?.push(malicious)).toBe(2);
  expect(events()).toEqual([]);
});

it('stores simulated workflow events separately while continuing to observe existing site events', async () => {
  const original = vi.fn();
  browser.gtag = original;
  browser.dataLayer = [];
  const logs = vi.fn();
  const value = runtime(graph(), { analyticsMode: 'simulate', onLog: logs });
  await value.run('start');
  expect(original).not.toHaveBeenCalled();
  expect(events(previewKey).map((event) => event.name)).toEqual([
    'dxp_workflow_started',
    'dxp_workflow_completed',
  ]);
  browser.dataLayer?.push({ event: 'site_event' });
  expect(events(previewKey).at(-1)?.name).toBe('site_event');
  expect(sessionStorage.getItem(liveKey)).toBeNull();
  expect(logs).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('Simulated analytics') }),
  );
});

it.each(['provider-none', 'aborted'])('does not intercept when %s', (mode) => {
  const workflow = graph();
  if (mode === 'provider-none') workflow.analytics = { provider: 'none' };
  const controller = new AbortController();
  if (mode === 'aborted') controller.abort();
  const original = vi.fn();
  browser.gtag = original;
  runtime(workflow, { signal: controller.signal });
  expect(browser.gtag).toBe(original);
  browser.gtag?.('event', 'ignored');
  expect(events()).toEqual([]);
});

it('accepts analytics settings without a capture option across workflow serialization', () => {
  expect(isWorkflow(JSON.parse(JSON.stringify(graph())))).toBe(true);
  expect(isAnalyticsSettings({ provider: 'ga4' })).toBe(true);
});

it('snapshots all gtag arguments and dataLayer fields before the website mutates them', () => {
  const payload = {
    currency: 'EUR',
    value: 25,
    items: [{ item_id: 'sku-1', quantity: 2 }],
    user_properties: { plan: 'premium' },
  };
  const extra = { transport: 'custom' };
  const originalTag = vi.fn((_command, _name, parameters) => {
    parameters.value = 99;
  });
  browser.gtag = originalTag;
  const layer: unknown[] = [];
  layer.push = function (...items) {
    (items[0] as { ecommerce: { value: number } }).ecommerce.value = 100;
    return Reflect.apply(Array.prototype.push, this, items);
  };
  browser.dataLayer = layer;
  runtime();
  browser.gtag?.('event', 'purchase', payload, extra);
  const dataLayerEvent = {
    event: 'purchase',
    ecommerce: { value: 30 },
    'gtm.uniqueEventId': 42,
    custom: null,
  };
  browser.dataLayer.push(dataLayerEvent);
  expect(events()[0]).toMatchObject({
    name: 'purchase',
    source: 'gtag',
    simulated: false,
    data: ['event', 'purchase', { ...payload, value: 25 }, extra],
  });
  expect(events()[1]).toMatchObject({
    source: 'dataLayer',
    data: { ...dataLayerEvent, ecommerce: { value: 30 } },
  });
  payload.items[0].quantity = 10;
  expect(events()[0]).toMatchObject({
    data: ['event', 'purchase', { items: [{ quantity: 2 }] }, extra],
  });
  expect(payload.value).toBe(99);
  expect(dataLayerEvent.ecommerce.value).toBe(100);
});

it('serializes cycles, callbacks, accessors and non-JSON values without invoking them', () => {
  const getter = vi.fn(() => 'unread');
  const callback = vi.fn();
  const toJSON = vi.fn(() => {
    throw new Error('Must not execute');
  });
  const payload = {
    amount: 123n,
    absent: undefined,
    infinite: Infinity,
    notNumber: NaN,
    callback,
    toJSON,
    date: new Date('2026-10-30T12:00:00Z'),
    map: new Map([['key', { value: 1 }]]),
    set: new Set(['a', 'b']),
    element: document.querySelector('button'),
    nested: {} as { self?: unknown },
  };
  payload.nested.self = payload;
  Object.defineProperty(payload, 'computed', { enumerable: true, get: getter });
  Object.defineProperty(payload, Symbol.toStringTag, { get: getter });
  const original = vi.fn();
  browser.gtag = original;
  runtime();
  browser.gtag?.('event', 'complex', payload);
  expect(events()[0]).toMatchObject({
    data: [
      'event',
      'complex',
      {
        amount: { $type: 'BigInt', value: '123' },
        absent: { $type: 'Undefined' },
        infinite: { $type: 'Number', value: 'Infinity' },
        notNumber: { $type: 'Number', value: 'NaN' },
        callback: { $type: 'Function' },
        toJSON: { $type: 'Function' },
        computed: { $type: 'Accessor' },
        date: { $type: 'Date', value: '2026-10-30T12:00:00.000Z' },
        map: { $type: 'Map', entries: [['key', { value: 1 }]] },
        set: { $type: 'Set', values: ['a', 'b'] },
        element: { $type: 'Element', value: '<button id="start">Start</button>' },
        nested: { self: { $type: 'Circular' } },
      },
    ],
  });
  expect(original.mock.calls[0][2]).toBe(payload);
  expect(getter).not.toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
  expect(toJSON).not.toHaveBeenCalled();
});

it.each(['gtag', 'gtm'] as const)(
  'captures complete simulated event payloads through %s',
  async (delivery) => {
    const workflow = graph();
    workflow.analytics = {
      provider: 'ga4',
      delivery,
      measurementId: 'G-TEST',
      workflowId: 'session-test',
    };
    browser.gtag = vi.fn();
    const value = runtime(workflow, { analyticsMode: 'simulate' });
    await value.run('start');
    expect(events(previewKey)).toHaveLength(2);
    const first = events(previewKey)[0];
    expect(first).toMatchObject({
      name: 'dxp_workflow_started',
      simulated: true,
      source: delivery === 'gtag' ? 'gtag' : 'dataLayer',
    });
    if (delivery === 'gtag')
      expect(first.data).toEqual([
        'event',
        'dxp_workflow_started',
        expect.objectContaining({ workflow_id: 'session-test', send_to: 'G-TEST' }),
      ]);
    else
      expect(first.data).toMatchObject({
        event: 'dxp_workflow_started',
        workflow_id: 'session-test',
        trigger_id: 'start',
      });
  },
);

it('replaces old aggregate records and preserves subsequent raw event occurrences', () => {
  sessionStorage.setItem(
    liveKey,
    JSON.stringify({
      version: 1,
      events: [{ name: 'old', count: 100, firstSeen: 1, lastSeen: 2 }],
    }),
  );
  browser.gtag = vi.fn();
  runtime();
  browser.gtag?.('event', 'new', { value: 1 });
  browser.gtag?.('event', 'new', { value: 2 });
  const stored = JSON.parse(sessionStorage.getItem(liveKey) ?? 'null');
  expect(stored.version).toBe(2);
  expect(stored.events).toHaveLength(2);
  expect(stored.events[0]).not.toHaveProperty('count');
  expect(stored.events[1].data).toEqual(['event', 'new', { value: 2 }]);
});

it.each(['x', '\u0000'])('bounds storage for oversized snapshots containing %j', (character) => {
  browser.gtag = vi.fn();
  runtime();
  for (let i = 0; i < 8; i++)
    browser.gtag?.('event', `large_${i}`, { text: character.repeat(600000) });
  expect(events().at(-1)).toMatchObject({ name: 'large_7', truncated: true });
  expect(events().length).toBeLessThan(8);
  expect(sessionStorage.getItem(liveKey)?.length).toBeLessThanOrEqual(2000000);
});

it('evicts older raw records on quota pressure and still forwards every original event', () => {
  const original = vi.fn();
  browser.gtag = original;
  runtime();
  const nativeSet = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (value.length > 1200) throw new DOMException('Full', 'QuotaExceededError');
    return nativeSet.call(this, key, value);
  });
  for (let i = 0; i < 20; i++) browser.gtag?.('event', `quota_${i}`, { payload: 'x'.repeat(100) });
  expect(events().at(-1)?.name).toBe('quota_19');
  expect(events().length).toBeLessThan(20);
  expect(original).toHaveBeenCalledTimes(20);
});

it('preserves GTM browser-event details and element markup', () => {
  browser.dataLayer = [];
  runtime();
  const nativeEvent = new MouseEvent('click', {
    clientX: 123,
    clientY: 45,
    ctrlKey: true,
    bubbles: true,
  });
  browser.dataLayer.push({
    event: 'gtm.click',
    'gtm.element': document.querySelector('button'),
    nativeEvent,
  });
  expect(events()[0]).toMatchObject({
    source: 'dataLayer',
    data: {
      event: 'gtm.click',
      'gtm.element': { $type: 'Element', value: '<button id="start">Start</button>' },
      nativeEvent: {
        $type: 'Event',
        type: 'click',
        clientX: 123,
        clientY: 45,
        ctrlKey: true,
        bubbles: true,
      },
    },
  });
});
