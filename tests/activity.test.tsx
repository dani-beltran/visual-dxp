// @vitest-environment jsdom

import { Position } from '@xyflow/react';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DXPBuilder, type DXPBuilderApi, type DXPBuilderProps } from '../src/components/DXPBuilder';
import { type ActivityEntry, type ActivityStore, createActivityStore } from '../src/lib/activity';
import type { Workflow } from '../src/lib/types';

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;
let builderApi: DXPBuilderApi | null;
const onReady = (api: DXPBuilderApi | null) => {
  builderApi = api;
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mounted = true;
  builderApi = null;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function initialWorkflow(): Workflow {
  return {
    version: 1,
    name: 'Welcome journey',
    websiteUrl: 'https://example.com',
    nodes: [
      {
        id: 'delay',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'delay', label: 'Wait a second', config: { duration: 1000 } },
      },
    ],
    edges: [],
  };
}

function connectedWorkflow(): Workflow {
  const workflow = initialWorkflow();
  workflow.nodes.push({
    id: 'start',
    type: 'workflow',
    position: { x: -300, y: 0 },
    data: { kind: 'trigger', label: 'Page loaded', config: { event: 'page-load' } },
  });
  // Supply layout information because jsdom does not measure rendered node handles.
  workflow.nodes = workflow.nodes.map((node) => ({
    ...node,
    width: 220,
    height: 140,
    handles: [
      { type: 'source', position: Position.Right, x: 220, y: 70 },
      { type: 'target', position: Position.Left, x: 0, y: 70 },
    ],
  }));
  workflow.edges = [{ id: 'start-delay', source: 'start', target: 'delay', type: 'smoothstep' }];
  return workflow;
}

async function renderBuilder(props: Partial<DXPBuilderProps> = {}) {
  await act(async () => {
    root.render(
      <StrictMode>
        <DXPBuilder initialWorkflow={initialWorkflow()} onReady={onReady} {...props} />
      </StrictMode>,
    );
  });
}

function tab(name: string) {
  const element = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!element) throw new Error(`Tab '${name}' should exist`);
  return element;
}

function element<T extends HTMLElement>(selector: string) {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Element '${selector}' should exist`);
  return found;
}

function button(label: string) {
  return element<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function historyButton(name: 'Undo' | 'Redo') {
  return element<HTMLButtonElement>(`button[title^="${name}"]`);
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function pressDelete() {
  await act(async () => {
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  });
  await act(async () => {
    host.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
  });
}

async function renameWorkflow(value: string) {
  if (!builderApi) throw new Error('Builder API should be ready');
  await act(async () => builderApi?.renameWorkflow(value));
}

function remoteEntry(id: string, username: string, timestamp: string): ActivityEntry {
  return { id, username, action: `${username} updated the workflow`, timestamp };
}

function trackSubscriptions(store: ActivityStore) {
  const listeners = new Set<() => void>();
  return {
    listeners,
    store: {
      ...store,
      subscribe(listener: () => void) {
        listeners.add(listener);
        const unsubscribe = store.subscribe(listener);
        return () => {
          listeners.delete(listener);
          unsubscribe();
        };
      },
    } satisfies ActivityStore,
  };
}

describe('builder activity', () => {
  it('shows incoming store changes while Activity is open with username, action, and newest time first', async () => {
    const oldest = remoteEntry('old', 'Ada', '2026-09-18T10:00:00.000Z');
    const latest = remoteEntry('new', 'Grace', '2026-09-20T10:00:00.000Z');
    const store = createActivityStore([oldest]);
    await renderBuilder({ activityStore: store });
    expect(tab('Canvas').getAttribute('aria-selected')).toBe('true');
    expect(
      [...host.querySelectorAll('[role="tab"]')].map((element) => element.textContent?.trim()),
    ).toEqual(['Canvas', 'Activity']);

    await click(tab('Activity'));
    expect(tab('Activity').getAttribute('aria-selected')).toBe('true');
    expect(host.textContent).toContain(oldest.username);
    expect(host.textContent).toContain(oldest.action);
    await act(async () => store.append(latest));
    expect(host.textContent).toContain(latest.username);
    expect(host.textContent).toContain(latest.action);
    expect([...host.querySelectorAll('time')].map((time) => time.getAttribute('datetime'))).toEqual(
      [latest.timestamp, oldest.timestamp],
    );
    expect([...host.querySelectorAll('time')].every((time) => !!time.textContent?.trim())).toBe(
      true,
    );

    await act(async () => store.remove(latest.id));
    expect(host.textContent).not.toContain(latest.action);
    expect(host.textContent).toContain(oldest.action);

    await act(async () => store.replaceEntries([]));
    expect(host.querySelector('time')).toBeNull();
    expect(host.textContent).toMatch(/no activity yet/i);
  });

  it('switches subscriptions when a different store is passed and unsubscribes on unmount', async () => {
    const first = trackSubscriptions(createActivityStore());
    const incoming = remoteEntry('incoming', 'Lin', '2026-09-20T11:00:00.000Z');
    const second = trackSubscriptions(createActivityStore([incoming]));
    await renderBuilder({ activityStore: first.store });
    await click(tab('Activity'));
    expect(first.listeners.size).toBe(1);

    await renderBuilder({ activityStore: second.store });
    expect(first.listeners.size).toBe(0);
    expect(second.listeners.size).toBe(1);
    expect(host.textContent).toContain(incoming.action);
    const obsolete = remoteEntry('obsolete', 'Old store', '2026-09-20T12:00:00.000Z');
    await act(async () => first.store.append(obsolete));
    expect(host.textContent).not.toContain(obsolete.action);

    await click(tab('Canvas'));
    await click(button('Add Delay'));
    expect(first.store.getSnapshot()).toEqual([obsolete]);
    expect(second.store.getSnapshot()).toHaveLength(2);
    expect(second.store.getSnapshot()[1].action).toMatch(/add/i);

    await act(async () => root.unmount());
    mounted = false;
    expect(second.listeners.size).toBe(0);
  });

  it('does not log initial rendering, node selection, rerenders, or tab changes', async () => {
    const store = createActivityStore();
    await renderBuilder({ activityStore: store });
    const node = element<HTMLElement>('[data-id="delay"]');
    await click(node);
    expect(host.querySelector('[aria-label="Delay configuration"]')).not.toBeNull();
    await click(tab('Activity'));
    await click(tab('Canvas'));
    await renderBuilder({ activityStore: store });
    expect(store.getSnapshot()).toEqual([]);
  });

  it('removes only each undone action and restores its original entry on redo', async () => {
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await renderBuilder({ activityStore: store, activityUser: 'Ada', onChange });
    await click(button('Add Delay'));
    expect(store.getSnapshot()).toHaveLength(1);
    const first = store.getSnapshot()[0];
    expect(first).toMatchObject({
      username: 'Ada',
      action: expect.stringMatching(/add/i),
    });
    expect(Number.isFinite(Date.parse(first.timestamp))).toBe(true);
    await click(button('Add Delay'));
    const second = store.getSnapshot()[1];
    expect(second.id).not.toBe(first.id);
    const remote = remoteEntry('server', 'Lin', '2026-09-20T12:00:00.000Z');
    await act(async () => store.append(remote));

    await renderBuilder({ activityStore: store, activityUser: 'Grace', onChange });
    await click(historyButton('Undo'));
    expect(store.getSnapshot()).toEqual([first, remote]);
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(2);
    await click(historyButton('Undo'));
    expect(store.getSnapshot()).toEqual([remote]);
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(1);
    expect(historyButton('Undo').disabled).toBe(true);

    await act(async () => {
      host.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
      );
    });
    expect(store.getSnapshot()).toEqual([remote, first]);
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(2);
    await click(historyButton('Redo'));
    expect(store.getSnapshot()).toEqual([remote, first, second]);
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(3);
    expect(historyButton('Redo').disabled).toBe(true);
  });

  it('records deleting a connected node once and restores the node and connection with one Undo', async () => {
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    const workflow = connectedWorkflow();
    await renderBuilder({ initialWorkflow: workflow, activityStore: store, onChange });
    await click(element<HTMLElement>('[data-id="delay"]'));
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);

    await pressDelete();
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual(['start']);
    expect(onChange.mock.lastCall?.[0].edges).toEqual([]);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].action).toMatch(/delete/i);
    expect(store.getSnapshot()[0].action).toContain('Wait a second');

    await click(historyButton('Undo'));
    expect(onChange.mock.lastCall?.[0].nodes.map((node) => node.id)).toEqual(['delay', 'start']);
    expect(onChange.mock.lastCall?.[0].edges).toEqual(workflow.edges);
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);
  });

  it('selects and deletes a connection from the keyboard and restores it with one Undo', async () => {
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await renderBuilder({ initialWorkflow: connectedWorkflow(), activityStore: store, onChange });
    const edge = host.querySelector<SVGGElement>('[data-id="start-delay"]');
    if (!edge) throw new Error('The connection should be rendered');
    await act(async () => {
      edge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].edges[0].selected).toBe(true);
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);

    await pressDelete();
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(2);
    expect(onChange.mock.lastCall?.[0].edges).toEqual([]);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].action).toMatch(/disconnect|connection/i);

    await click(historyButton('Undo'));
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(2);
    expect(onChange.mock.lastCall?.[0].edges).toEqual([
      expect.objectContaining({ id: 'start-delay', source: 'start', target: 'delay' }),
    ]);
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);
  });

  it('coalesces arrow-key movement into one activity entry and one undo step', async () => {
    vi.useFakeTimers();
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await renderBuilder({
      initialWorkflow: connectedWorkflow(),
      activityStore: store,
      activityUser: 'Ada',
      onChange,
    });
    const node = element<HTMLElement>('[data-id="delay"]');
    await click(node);
    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
    }
    expect(
      onChange.mock.lastCall?.[0].nodes.find((entry) => entry.id === 'delay')?.position.x,
    ).toBeGreaterThan(0);
    expect(
      onChange.mock.lastCall?.[0].nodes.find((entry) => entry.id === 'start')?.position,
    ).toEqual({ x: -300, y: 0 });
    expect(store.getSnapshot()).toEqual([]);
    await act(async () => vi.advanceTimersByTime(600));
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0]).toMatchObject({
      username: 'Ada',
      action: expect.stringMatching(/moved.*Wait a second/i),
    });

    await click(historyButton('Undo'));
    expect(
      onChange.mock.lastCall?.[0].nodes.find((entry) => entry.id === 'delay')?.position,
    ).toEqual({
      x: 0,
      y: 0,
    });
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);
  });

  it('coalesces typing and flushes the latest workflow name when opening Activity', async () => {
    vi.useFakeTimers();
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await renderBuilder({ activityStore: store, onChange });
    await renameWorkflow('Welcome');
    await renameWorkflow('Welcome back');
    expect(store.getSnapshot()).toEqual([]);
    await act(async () => vi.advanceTimersByTime(599));
    expect(store.getSnapshot()).toEqual([]);
    await act(async () => vi.advanceTimersByTime(1));
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0]).toMatchObject({
      username: 'You',
      action: expect.stringContaining('Welcome back'),
    });
    const renamed = store.getSnapshot()[0];
    await click(historyButton('Undo'));
    expect(store.getSnapshot()).toEqual([]);
    expect(onChange.mock.lastCall?.[0].name).toBe('Welcome journey');
    expect(historyButton('Undo').disabled).toBe(true);
    await click(historyButton('Redo'));
    expect(store.getSnapshot()).toEqual([renamed]);
    expect(onChange.mock.lastCall?.[0].name).toBe('Welcome back');

    await renameWorkflow('New visitor journey');
    await click(tab('Activity'));
    expect(store.getSnapshot()).toHaveLength(2);
    expect(store.getSnapshot()[1].action).toContain('New visitor journey');
    expect(host.textContent).toContain(store.getSnapshot()[1].action);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(store.getSnapshot()).toHaveLength(2);
  });

  it('cancels an undone pending edit and only flushes surviving edits on unmount', async () => {
    vi.useFakeTimers();
    const store = createActivityStore();
    const append = vi.spyOn(store, 'append');
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await renderBuilder({ activityStore: store, activityUser: 'Ada', onChange });
    await renameWorkflow('First edit');
    await renameWorkflow('First edit continued');
    await click(historyButton('Undo'));
    expect(store.getSnapshot()).toEqual([]);
    expect(append).not.toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0].name).toBe('Welcome journey');
    await act(async () => vi.advanceTimersByTime(1000));
    expect(append).not.toHaveBeenCalled();

    await renameWorkflow('Final edit');
    await act(async () => root.unmount());
    mounted = false;
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].action).toContain('Final edit');
    expect(append).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(store.getSnapshot()).toHaveLength(1);
    expect(append).toHaveBeenCalledOnce();
  });

  it('preserves pending edit attribution when the host changes the store or username', async () => {
    vi.useFakeTimers();
    const first = createActivityStore();
    const second = createActivityStore();
    await renderBuilder({ activityStore: first, activityUser: 'Ada' });
    await renameWorkflow('Ada’s draft');

    await renderBuilder({ activityStore: second, activityUser: 'Grace' });
    expect(first.getSnapshot()).toHaveLength(1);
    expect(first.getSnapshot()[0]).toMatchObject({
      username: 'Ada',
      action: expect.stringContaining('Ada’s draft'),
    });
    expect(second.getSnapshot()).toEqual([]);
    await renameWorkflow('Grace’s draft');

    await renderBuilder({ activityStore: second, activityUser: 'Lin' });
    expect(second.getSnapshot()).toHaveLength(1);
    expect(second.getSnapshot()[0]).toMatchObject({
      username: 'Grace',
      action: expect.stringContaining('Grace’s draft'),
    });
    await renameWorkflow('Lin’s draft');
    await act(async () => vi.advanceTimersByTime(600));
    expect(second.getSnapshot()).toHaveLength(2);
    expect(second.getSnapshot()[1]).toMatchObject({
      username: 'Lin',
      action: expect.stringContaining('Lin’s draft'),
    });
    expect(first.getSnapshot()).toHaveLength(1);
    const adaEntry = first.getSnapshot()[0];
    const graceEntry = second.getSnapshot()[0];

    await click(historyButton('Undo'));
    expect(second.getSnapshot()).toEqual([graceEntry]);
    await click(historyButton('Undo'));
    expect(second.getSnapshot()).toEqual([]);
    expect(first.getSnapshot()).toEqual([adaEntry]);
    await click(historyButton('Undo'));
    expect(first.getSnapshot()).toEqual([]);
    expect(second.getSnapshot()).toEqual([]);
    await click(historyButton('Redo'));
    expect(first.getSnapshot()).toEqual([adaEntry]);
    expect(second.getSnapshot()).toEqual([]);
  });
});

describe('connection names', () => {
  beforeEach(() => {
    // jsdom does not measure SVG text used by React Flow's edge labels.
    const createElementNS = document.createElementNS.bind(document);
    vi.spyOn(document, 'createElementNS').mockImplementation((namespace, name, options) => {
      const element = createElementNS(namespace, name, options);
      if (name === 'text')
        Object.assign(element, { getBBox: () => ({ x: 0, y: 0, width: 80, height: 14 }) });
      return element;
    });
  });

  async function selectEdge(id = 'start-delay', key?: string) {
    const edge = host.querySelector<SVGGElement>(`[data-id="${id}"]`);
    if (!edge) throw new Error('The connection should be rendered');
    await act(async () => {
      edge.dispatchEvent(
        key
          ? new KeyboardEvent('keydown', { key, bubbles: true })
          : new MouseEvent('click', { bubbles: true }),
      );
    });
    if (key)
      await act(async () => {
        edge.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      });
  }

  async function renameConnection(name: string) {
    const input = element<HTMLInputElement>('[aria-label="Connection configuration"] input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing input value setter');
    await act(async () => {
      setter.call(input, name);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('names an unlabeled connection on the canvas with coalesced history, undo, redo, and clearing', async () => {
    vi.useFakeTimers();
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await renderBuilder({ initialWorkflow: connectedWorkflow(), activityStore: store, onChange });
    await selectEdge();
    expect(element('[aria-label="Connection configuration"]').textContent).toContain(
      'Page loaded → Wait a second',
    );
    expect(element<HTMLInputElement>('.dxp-inspector input').value).toBe('');
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);

    await renameConnection('Continue');
    await renameConnection('Continue to welcome');
    expect(onChange.mock.lastCall?.[0].edges[0].label).toBe('Continue to welcome');
    expect(element('.react-flow__edge-text').textContent).toBe('Continue to welcome');
    await click(button('Close connection details'));
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].action).toContain('Continue to welcome');
    expect(host.querySelector('.dxp-inspector')).toBeNull();

    await click(historyButton('Undo'));
    expect(onChange.mock.lastCall?.[0].edges[0].label).toBeUndefined();
    expect(host.querySelector('.react-flow__edge-text')).toBeNull();
    expect(store.getSnapshot()).toEqual([]);
    expect(historyButton('Undo').disabled).toBe(true);
    await click(historyButton('Redo'));
    expect(element('.react-flow__edge-text').textContent).toBe('Continue to welcome');
    expect(store.getSnapshot()).toHaveLength(1);

    await selectEdge();
    await renameConnection('');
    expect(onChange.mock.lastCall?.[0].edges[0].label).toBe('');
    expect(host.querySelector('.react-flow__edge-text')).toBeNull();
    await click(historyButton('Undo'));
    expect(onChange.mock.lastCall?.[0].edges[0].label).toBe('Continue to welcome');
  });

  it('edits only the selected branch name and switches or dismisses its inspector', async () => {
    const onChange = vi.fn<(workflow: Workflow) => void>();
    const workflow = connectedWorkflow();
    const source = workflow.nodes.find((node) => node.id === 'start');
    if (!source) throw new Error('Missing source node');
    source.data = { kind: 'fork', label: 'Check visitor', config: { condition: '#visitor' } };
    source.handles = [
      { id: 'true', type: 'source', position: Position.Right, x: 220, y: 50 },
      { id: 'false', type: 'source', position: Position.Right, x: 220, y: 90 },
    ];
    workflow.edges[0] = { ...workflow.edges[0], sourceHandle: 'true', label: 'Matches' };
    workflow.edges.push({
      id: 'otherwise',
      source: 'start',
      target: 'delay',
      sourceHandle: 'false',
      label: 'Otherwise',
    });
    await renderBuilder({ initialWorkflow: workflow, onChange });
    await click(element('[data-id="delay"]'));
    await selectEdge('start-delay', 'Enter');
    expect(host.querySelector('[aria-label="Delay configuration"]')).toBeNull();
    expect(element<HTMLInputElement>('.dxp-inspector input').value).toBe('Matches');
    await renameConnection('Returning visitor');
    expect(onChange.mock.lastCall?.[0].edges[0]).toEqual({
      ...workflow.edges[0],
      selected: true,
      label: 'Returning visitor',
    });
    expect(onChange.mock.lastCall?.[0].edges[1]).toEqual(workflow.edges[1]);

    await selectEdge('otherwise');
    expect(element<HTMLInputElement>('.dxp-inspector input').value).toBe('Otherwise');
    await click(element('.react-flow__pane'));
    expect(host.querySelector('.dxp-inspector')).toBeNull();
    await selectEdge();
    await click(element('[data-id="delay"]'));
    expect(host.querySelector('[aria-label="Connection configuration"]')).toBeNull();
    expect(host.querySelector('[aria-label="Delay configuration"]')).not.toBeNull();
    await selectEdge();
    await selectEdge('start-delay', 'Escape');
    expect(host.querySelector('.dxp-inspector')).toBeNull();
    await selectEdge();
    await pressDelete();
    expect(host.querySelector('.dxp-inspector')).toBeNull();
    expect(onChange.mock.lastCall?.[0].edges.map((edge) => edge.id)).toEqual(['otherwise']);
  });
});
