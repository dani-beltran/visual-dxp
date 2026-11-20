import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { PREVIEW_PROTOCOL, previewBridgeSource } from '../src/lib/previewBridge';

// The demo website dispatches this event for practicing the custom event trigger.
const demoHtml = readFileSync('public/demo-site.html', 'utf8');
const editorOrigin = 'https://editor.example.test';
const name = 'demo-custom-event-1';
const payload = { source: 'demo-site', productId: 'stoneware-vase', price: 38 };
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Trigger on the demo event, then change the hero headline. */
const workflow = (eventName = name) => ({
  version: 1,
  name: 'Demo custom event',
  websiteUrl: '/demo-site.html',
  nodes: [
    {
      id: 'start',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: {
        kind: 'trigger',
        label: 'Demo event',
        config: { event: 'custom-event', customEventName: eventName },
      },
    },
    {
      id: 'headline',
      type: 'workflow',
      position: { x: 300, y: 0 },
      data: {
        kind: 'dom',
        label: 'Headline',
        // Reads the event detail passed on by the trigger.
        config: {
          selector: '.hero h1',
          action: 'text',
          value: 'Received {{productId}} from {{source}} at €{{price}}',
        },
      },
    },
  ],
  edges: [{ id: 'edge', source: 'start', target: 'headline' }],
});

const windows = [];
afterEach(() => {
  for (const dom of windows.splice(0)) dom.window.close();
});

/** Loads the demo page the way Test workflow does: in an iframe beneath the editor window. */
function openPreview() {
  const editor = new JSDOM('<!doctype html><body></body>', {
    url: `${editorOrigin}/`,
    runScripts: 'dangerously',
  });
  windows.push(editor);
  const frame = editor.window.document.createElement('iframe');
  editor.window.document.body.append(frame);
  const page = frame.contentWindow;
  const events = [];
  // Observe dispatches before the page's own scripts run.
  page.addEventListener(name, (event) =>
    events.push({
      detail: event.detail,
      custom: Object.prototype.toString.call(event) === '[object CustomEvent]',
    }),
  );
  page.document.open();
  page.document.write(demoHtml);
  page.document.close();
  // /bridge.js is deferred and runs after the page's inline scripts; install the same bridge.
  page.eval(previewBridgeSource(editorOrigin));

  const replies = [];
  editor.window.addEventListener('message', (event) => replies.push(event.data));
  const channel = 'demo-channel';
  // jsdom's postMessage omits source and origin, which the page and bridge verify.
  const send = (type, detail = {}) =>
    page.dispatchEvent(
      new page.MessageEvent('message', {
        data: { protocol: PREVIEW_PROTOCOL, channel, type, ...detail },
        origin: editorOrigin,
        source: page.parent,
      }),
    );
  const logs = (runId) =>
    replies
      .filter((reply) => reply.type === 'log' && reply.runId === runId)
      .map((reply) => reply.log);
  const triggerRuns = (runId) =>
    logs(runId).filter((log) => log.nodeId === 'start' && log.status === 'running').length;
  const headline = () => page.document.querySelector('.hero h1')?.textContent;
  return { page, events, replies, send, logs, triggerRuns, headline };
}

describe('demo website custom event', () => {
  it('dispatches demo-custom-event-1 as a CustomEvent with a small payload shortly after loading', async () => {
    const { events } = openPreview();
    expect(events).toEqual([]);
    await sleep(700);
    expect(events).toEqual([{ detail: payload, custom: true }]);
    await sleep(700);
    expect(events).toHaveLength(1);
  });

  it('runs a custom event trigger right after Run workflow, and again after Restart', async () => {
    const preview = openPreview();
    preview.send('init');
    await sleep(20); // Replies are delivered asynchronously.
    expect(preview.replies).toContainEqual(expect.objectContaining({ type: 'ready' }));
    // The load-time dispatch happens before any workflow runs, as in the editor preview.
    await sleep(700);
    expect(preview.events).toHaveLength(1);

    preview.send('run', { workflow: workflow(), runId: 'first' });
    expect(preview.triggerRuns('first')).toBe(0);
    await sleep(700);
    expect(preview.triggerRuns('first')).toBe(1);
    expect(preview.logs('first').filter((log) => log.status === 'error')).toEqual([]);
    expect(preview.headline()).toBe('Received stoneware-vase from demo-site at €38');
    expect(preview.logs('first')).toContainEqual(
      expect.objectContaining({
        nodeId: 'start',
        status: 'success',
        data: JSON.stringify(payload, null, 2),
      }),
    );
    expect(preview.events.at(-1)).toEqual({ detail: payload, custom: true });

    // Restart workflow sends another run to the same page, without reloading it.
    preview.send('run', { workflow: workflow(), runId: 'second' });
    await sleep(700);
    expect(preview.triggerRuns('second')).toBe(1);
    await sleep(700);
    expect(preview.triggerRuns('first')).toBe(1);
    expect(preview.triggerRuns('second')).toBe(1);
  });

  it('dispatches once when the run starts right after the page loads', async () => {
    const preview = openPreview();
    preview.send('init');
    preview.send('run', { workflow: workflow(), runId: 'early' });
    await sleep(1200);
    expect(preview.events).toHaveLength(1);
    expect(preview.triggerRuns('early')).toBe(1);
  });

  it('does not start triggers for other event names', async () => {
    const preview = openPreview();
    preview.send('init');
    preview.send('run', { workflow: workflow('Demo-Custom-Event-1'), runId: 'other' });
    await sleep(700);
    expect(preview.events).toHaveLength(1);
    expect(preview.triggerRuns('other')).toBe(0);
    expect(preview.headline()).not.toContain('Received');
  });

  it('ignores run messages that do not come from the embedding editor', async () => {
    const preview = openPreview();
    await sleep(700);
    expect(preview.events).toHaveLength(1);
    for (const source of [preview.page, null])
      preview.page.dispatchEvent(
        new preview.page.MessageEvent('message', {
          data: { protocol: PREVIEW_PROTOCOL, channel: 'demo-channel', type: 'run' },
          source,
        }),
      );
    preview.page.dispatchEvent(
      new preview.page.MessageEvent('message', {
        data: { protocol: 'another-protocol', type: 'run' },
        source: preview.page.parent,
      }),
    );
    await sleep(700);
    expect(preview.events).toHaveLength(1);
  });

  it('only dispatches after loading when opened directly, outside the preview', async () => {
    const dom = new JSDOM(demoHtml, {
      url: `${editorOrigin}/demo-site.html`,
      runScripts: 'dangerously',
    });
    windows.push(dom);
    const page = dom.window;
    const details = [];
    page.addEventListener(name, (event) => details.push(event.detail));
    page.dispatchEvent(
      new page.MessageEvent('message', {
        data: { protocol: PREVIEW_PROTOCOL, type: 'run' },
        source: page.parent,
      }),
    );
    await sleep(700);
    expect(details).toEqual([payload]);
    await sleep(700);
    expect(details).toHaveLength(1);
  });
});
