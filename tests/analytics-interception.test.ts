// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isAnalyticsSettings } from '../src/lib/analytics';
import { exportWorkflow } from '../src/lib/export';
import { createRuntime, getRuntimeSource } from '../src/lib/runtime';
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
function events(
  key = liveKey,
): { name: string; count: number; firstSeen: number; lastSeen: number }[] {
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
    const payload = { secret: 'never-store-me', event_callback: vi.fn() };
    expect(browser.gtag?.('event', 'purchase', payload)).toBe(1);
    expect(browser.dataLayer?.push({ event: 'purchase', payload }, { event: 'sign_up' })).toBe(3);
    browser.gtag?.('config', 'G-TEST');
    browser.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    browser.dataLayer?.push({ ecommerce: { value: 10 } }, null);
    expect(events(key)).toEqual([
      expect.objectContaining({ name: 'purchase', count: 2 }),
      expect.objectContaining({ name: 'sign_up', count: 1 }),
    ]);
    expect(sessionStorage.getItem(key)).not.toContain('never-store-me');
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
  expect(events()[0]).toMatchObject({ name: 'late_event', count: 1 });
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
  expect(events()[0].count).toBe(3);
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
  expect(events().map(({ name, count }) => [name, count])).toEqual([
    ['outer', 1],
    ['inner', 1],
    ['parent', 1],
    ['child', 1],
  ]);
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

it('bounds stored names and keeps counts for the session without age-based expiry', () => {
  browser.gtag = vi.fn();
  runtime();
  for (let i = 0; i < 205; i++) browser.gtag?.('event', `event_${i}`);
  expect(events()).toHaveLength(200);
  expect(events()[0].name).toBe('event_5');
  const firstSeen = events()[199].firstSeen;
  vi.setSystemTime(Date.now() + 1000);
  browser.gtag?.('event', 'event_204');
  expect(events()[199]).toMatchObject({ count: 2, firstSeen, lastSeen: firstSeen + 1000 });
  vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
  browser.gtag?.('event', 'event_204');
  expect(events().at(-1)).toMatchObject({ name: 'event_204', count: 3, firstSeen });
});

it('retains counts across runtime restarts within a session and starts fresh in a new session', () => {
  browser.gtag = vi.fn();
  const first = runtime();
  browser.gtag?.('event', 'session_event');
  first.destroy();
  const second = runtime();
  browser.gtag?.('event', 'session_event');
  expect(events()).toEqual([expect.objectContaining({ name: 'session_event', count: 2 })]);
  expect(localStorage.getItem(liveKey)).toBeNull();
  second.destroy();
  // The browser clears sessionStorage at the end of a tab session.
  sessionStorage.clear();
  runtime();
  browser.gtag?.('event', 'fresh');
  expect(events()).toEqual([expect.objectContaining({ name: 'fresh', count: 1 })]);
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
