// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Preview } from '../src/components/Preview';
import type { NodeKind, RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function node(id: string, kind: NodeKind, config: StepConfig = {}): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}

function workflow(nodes: WorkflowNode[], connections: [string, string, string?][]): Workflow {
  return {
    version: 1,
    name: 'Current experience',
    websiteUrl: '/demo-site.html',
    nodes,
    edges: connections.map(([source, target, sourceHandle], index) => ({
      id: `edge-${index}`,
      source,
      target,
      sourceHandle,
    })),
  };
}

function eventWorkflow(config: StepConfig): Workflow {
  return workflow(
    [
      node('start', 'trigger', config),
      node('update', 'dom', { selector: '#result', value: 'Triggered' }),
    ],
    [['start', 'update']],
  );
}

async function renderPreview(graph: Workflow, onLog = vi.fn<(log: RunLog) => void>()) {
  await act(async () => {
    root.render(<Preview workflow={graph} onClose={vi.fn()} onLog={onLog} />);
  });
  return onLog;
}

function button(name: string) {
  const element = Array.from(document.querySelectorAll('button')).find(
    (candidate) =>
      candidate.textContent?.trim() === name ||
      candidate.getAttribute('aria-label') === name ||
      candidate.title === name,
  );
  if (!element) throw new Error(`Expected the ${name} button.`);
  return element;
}

async function clickButton(name: string) {
  await act(async () => button(name).click());
}

function websiteFrame() {
  const frame = document.querySelector<HTMLIFrameElement>(
    'iframe[title="Workflow preview website"]',
  );
  if (!frame) throw new Error('Expected the workflow website iframe.');
  return frame;
}

async function loadWebsite(html = '<p id="result">Waiting</p>') {
  const frame = websiteFrame();
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) throw new Error('Expected the workflow website document and window.');
  if (!doc.documentElement) doc.appendChild(doc.createElement('html'));
  if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
  doc.body.innerHTML = html;
  // jsdom does not load the website resource. Model the completed iframe load
  // before installing page-load and visibility-sensitive behavior triggers.
  vi.spyOn(doc, 'readyState', 'get').mockReturnValue('complete');
  vi.spyOn(doc, 'hidden', 'get').mockReturnValue(false);
  await act(async () => frame.dispatchEvent(new Event('load')));
  return { frame, doc, win };
}

async function dispatch(doc: Document, selector: string, event: Event) {
  const target = doc.querySelector(selector);
  if (!target) throw new Error(`Expected the website target ${selector}.`);
  await act(async () => target.dispatchEvent(event));
}

function successIds(onLog: ReturnType<typeof vi.fn<(log: RunLog) => void>>) {
  return onLog.mock.calls.filter(([log]) => log.status === 'success').map(([log]) => log.nodeId);
}

describe('workflow website preview', () => {
  it.each([true, false])(
    'runs page-load triggers and the matching website branch when a member exists: %s',
    async (member) => {
      const graph = workflow(
        [
          node('page', 'trigger', { event: 'page-load' }),
          node('branch', 'fork', { condition: '.member' }),
          node('member', 'dom', { selector: '#result', value: 'Welcome back' }),
          node('guest', 'dom', { selector: '#result', value: 'Welcome guest' }),
          node('click', 'trigger', { event: 'click', selector: '#buy' }),
          node('purchase', 'dom', { selector: '#result', value: 'Purchased' }),
        ],
        [
          ['page', 'branch'],
          ['branch', 'member', 'true'],
          ['branch', 'guest', 'false'],
          ['click', 'purchase'],
        ],
      );
      const onLog = await renderPreview(graph);
      expect(button('Run workflow').disabled).toBe(true);
      const { doc } = await loadWebsite(
        `${member ? '<div class="member"></div>' : ''}<button id="buy">Buy</button><p id="result">Waiting</p>`,
      );
      expect(onLog).not.toHaveBeenCalled();

      await clickButton('Run workflow');

      expect(doc.querySelector('#result')?.textContent).toBe(
        member ? 'Welcome back' : 'Welcome guest',
      );
      expect(successIds(onLog)).toEqual(['page', 'branch', member ? 'member' : 'guest']);
      expect(button('Restart workflow').disabled).toBe(false);
      expect(button('Stop workflow')).toBeDefined();
      expect(document.querySelector('#result')).toBeNull();

      await dispatch(doc, '#buy', new MouseEvent('click', { bubbles: true }));
      expect(doc.querySelector('#result')?.textContent).toBe('Purchased');
      expect(successIds(onLog).slice(-2)).toEqual(['click', 'purchase']);
    },
  );

  it.each(['click', 'mouseover', 'submit', 'change'] as const)(
    'waits for %s on a matching element in the website, including newly inserted elements',
    async (event) => {
      const onLog = await renderPreview(eventWorkflow({ event, selector: '#target' }));
      const { doc } = await loadWebsite();
      await clickButton('Run workflow');
      expect(doc.querySelector('#result')?.textContent).toBe('Waiting');
      expect(onLog).not.toHaveBeenCalled();

      doc.body.insertAdjacentHTML('afterbegin', '<div id="target"><span>Target</span></div>');
      await dispatch(doc, '#result', new Event(event, { bubbles: true }));
      await act(async () => document.body.dispatchEvent(new Event(event, { bubbles: true })));
      expect(onLog).not.toHaveBeenCalled();

      await dispatch(doc, '#target span', new Event(event, { bubbles: true }));
      expect(doc.querySelector('#result')?.textContent).toBe('Triggered');
      expect(successIds(onLog)).toEqual(['start', 'update']);

      await dispatch(doc, '#target span', new Event(event, { bubbles: true }));
      expect(successIds(onLog)).toEqual(['start', 'update', 'start', 'update']);
    },
  );

  it('waits for an exit-intent event from the website', async () => {
    const onLog = await renderPreview(eventWorkflow({ event: 'exit-intent' }));
    const { doc } = await loadWebsite();
    await clickButton('Run workflow');
    expect(onLog).not.toHaveBeenCalled();
    await dispatch(
      doc,
      'body',
      new MouseEvent('mouseout', { bubbles: true, clientY: -1, relatedTarget: null }),
    );
    expect(doc.querySelector('#result')?.textContent).toBe('Triggered');
    expect(successIds(onLog)).toEqual(['start', 'update']);
  });

  it('starts the configured inactivity timer and resets it on website activity', async () => {
    vi.useFakeTimers();
    const onLog = await renderPreview(eventWorkflow({ event: 'inactivity', duration: 1000 }));
    const { doc } = await loadWebsite();
    await clickButton('Run workflow');
    await act(async () => vi.advanceTimersByTimeAsync(900));
    await dispatch(doc, 'body', new Event('pointermove'));
    await act(async () => vi.advanceTimersByTimeAsync(999));
    expect(onLog).not.toHaveBeenCalled();
    expect(doc.querySelector('#result')?.textContent).toBe('Waiting');

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(doc.querySelector('#result')?.textContent).toBe('Triggered');
    expect(successIds(onLog)).toEqual(['start', 'update']);
  });

  it('keeps running unavailable when the website document cannot be accessed', async () => {
    const onLog = await renderPreview(eventWorkflow({ event: 'page-load' }));
    const frame = websiteFrame();
    vi.spyOn(frame, 'contentDocument', 'get').mockReturnValue(null);
    await act(async () => frame.dispatchEvent(new Event('load')));

    expect(button('Run workflow').disabled).toBe(true);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('same-origin');
    expect(onLog).not.toHaveBeenCalled();
  });

  it.each(['stop', 'reload', 'navigation', 'unmount'] as const)(
    'removes listeners and popovers and cancels delayed actions on %s',
    async (operation) => {
      vi.useFakeTimers();
      const onLog = await renderPreview(delayedPopoverWorkflow());
      const { doc, frame, win } = await loadWebsite(
        '<button id="target">Open offer</button><p id="result">Waiting</p>',
      );
      const target = doc.querySelector('#target');
      const result = doc.querySelector('#result');
      if (!target || !result) throw new Error('Expected the website action fixture.');
      await clickButton('Run workflow');
      await dispatch(doc, '#target', new MouseEvent('click', { bubbles: true }));
      expect(doc.querySelector('[data-dlb-dxp-popover="offer"]')).not.toBeNull();
      const logsBeforeDisposal = onLog.mock.calls.length;

      if (operation === 'unmount') {
        await act(async () => root.unmount());
        mounted = false;
      } else if (operation === 'navigation') {
        await act(async () => win.dispatchEvent(new Event('pagehide')));
        expect(button('Run workflow').disabled).toBe(true);
      } else {
        await clickButton(operation === 'stop' ? 'Stop workflow' : 'Reload website');
        expect(button('Run workflow').disabled).toBe(operation === 'reload');
      }
      expect(doc.querySelector('[data-dlb-dxp-popover]')).toBeNull();
      // Keep references because jsdom empties a removed iframe document.
      await act(async () => target.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await act(async () => vi.advanceTimersByTimeAsync(2000));
      expect(result.textContent).toBe('Waiting');
      expect(doc.querySelector('[data-dlb-dxp-popover]')).toBeNull();
      expect(onLog).toHaveBeenCalledTimes(logsBeforeDisposal);

      if (operation === 'reload' || operation === 'navigation') {
        if (operation === 'reload') {
          expect(websiteFrame()).not.toBe(frame);
          expect(document.querySelectorAll('.dxp-log-item')).toHaveLength(0);
        }
        const refreshed = await loadWebsite(
          '<button id="target">Open offer</button><p id="result">Waiting</p>',
        );
        await dispatch(refreshed.doc, '#target', new MouseEvent('click', { bubbles: true }));
        expect(onLog).toHaveBeenCalledTimes(logsBeforeDisposal);
        await clickButton('Run workflow');
        await dispatch(refreshed.doc, '#target', new MouseEvent('click', { bubbles: true }));
        expect(refreshed.doc.querySelector('[data-dlb-dxp-popover="offer"]')).not.toBeNull();
      }
    },
  );

  it('restarts with one set of listeners and clears previous logs, popovers, and pending work', async () => {
    vi.useFakeTimers();
    const onLog = await renderPreview(delayedPopoverWorkflow());
    const { doc } = await loadWebsite(
      '<button id="target">Open offer</button><p id="result">Waiting</p>',
    );
    await clickButton('Run workflow');
    await dispatch(doc, '#target', new MouseEvent('click', { bubbles: true }));
    const original = doc.querySelector('[data-dlb-dxp-popover="offer"]');
    expect(original).not.toBeNull();
    onLog.mockClear();

    await clickButton('Restart workflow');
    expect(original?.isConnected).toBe(false);
    expect(document.querySelectorAll('.dxp-log-item')).toHaveLength(0);
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(doc.querySelector('#result')?.textContent).toBe('Waiting');
    expect(onLog).not.toHaveBeenCalled();

    await dispatch(doc, '#target', new MouseEvent('click', { bubbles: true }));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(doc.querySelectorAll('[data-dlb-dxp-popover]')).toHaveLength(1);
    expect(doc.querySelector('#result')?.textContent).toBe('Finished');
    expect(successIds(onLog)).toEqual(['start', 'offer', 'wait', 'update']);
  });

  it('discards an active run when the graph changes and runs the edited configuration and connections', async () => {
    vi.useFakeTimers();
    const onLog = await renderPreview(delayedPopoverWorkflow());
    const { doc } = await loadWebsite(
      '<button id="target">Old trigger</button><button id="updated">New trigger</button><p id="result">Waiting</p>',
    );
    await clickButton('Run workflow');
    await dispatch(doc, '#target', new MouseEvent('click', { bubbles: true }));

    await renderPreview(
      workflow(
        [
          node('start', 'trigger', { event: 'click', selector: '#updated' }),
          node('update', 'dom', { selector: '#result', value: 'Old destination' }),
          node('edited', 'dom', { selector: '#result', value: 'Current workflow' }),
        ],
        [['start', 'edited']],
      ),
      onLog,
    );
    expect(button('Run workflow').disabled).toBe(false);
    expect(doc.querySelector('[data-dlb-dxp-popover]')).toBeNull();
    expect(document.querySelectorAll('.dxp-log-item')).toHaveLength(0);
    onLog.mockClear();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    await dispatch(doc, '#target', new MouseEvent('click', { bubbles: true }));
    expect(doc.querySelector('#result')?.textContent).toBe('Waiting');
    expect(onLog).not.toHaveBeenCalled();

    await clickButton('Run workflow');
    await dispatch(doc, '#target', new MouseEvent('click', { bubbles: true }));
    expect(onLog).not.toHaveBeenCalled();
    await dispatch(doc, '#updated', new MouseEvent('click', { bubbles: true }));
    expect(doc.querySelector('#result')?.textContent).toBe('Current workflow');
    expect(successIds(onLog)).toEqual(['start', 'edited']);
  });
});

function delayedPopoverWorkflow() {
  return workflow(
    [
      node('start', 'trigger', { event: 'click', selector: '#target' }),
      node('offer', 'popover', { content: '<h2>Current offer</h2>', position: 'center' }),
      node('wait', 'delay', { duration: 1000 }),
      node('update', 'dom', { selector: '#result', value: 'Finished' }),
    ],
    [
      ['start', 'offer'],
      ['offer', 'wait'],
      ['wait', 'update'],
    ],
  );
}
