// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { remoteContentPreset } from '../examples/presets/remote-content';
import { returningVisitorPreset } from '../examples/presets/returning-visitor';
import { welcomePreset } from '../examples/presets/welcome';
import VisualDXPBuilder, {
  commonDXPPresets,
  createActivityStore,
  isWorkflow,
  type VisualDXPBuilderApi,
  type VisualDXPBuilderProps,
  validateWorkflow,
  type Workflow,
  type WorkflowPreset,
} from '../src';

const { fitView } = vi.hoisted(() => ({ fitView: vi.fn().mockResolvedValue(true) }));
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => ({ ...actual.useReactFlow(), fitView }),
  };
});

let host: HTMLDivElement;
let root: Root;
const persistenceKey = 'presets-test';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('fetch', vi.fn());
  fitView.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.removeItem(persistenceKey);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function initialWorkflow(): Workflow {
  return {
    version: 1,
    name: 'Host journey',
    websiteUrl: 'https://host.example/shop',
    includeSubpages: true,
    nodes: [
      {
        id: 'host-start',
        type: 'workflow',
        position: { x: 100, y: 200 },
        data: { kind: 'trigger', label: 'Host trigger', config: { event: 'page-load' } },
      },
    ],
    edges: [],
  };
}

async function render(props: Partial<VisualDXPBuilderProps> = {}) {
  await act(async () =>
    root.render(
      <StrictMode>
        <VisualDXPBuilder initialWorkflow={initialWorkflow()} {...props} />
      </StrictMode>,
    ),
  );
}

function element<T extends HTMLElement>(selector: string): T {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

function tab(name: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing tab: ${name}`);
  return found;
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
}

async function key(target: HTMLElement, key: string) {
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
}

async function apply(name = welcomePreset.name) {
  await click(tab('Presets'));
  await click(element(`button[aria-label="Apply preset: ${name}"]`));
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe('optional builder presets', () => {
  it.each(commonDXPPresets)(
    'applies and edits $name without mutating its source',
    async (preset) => {
      freeze(preset);
      const before = JSON.stringify(preset);
      const onChange = vi.fn<(workflow: Workflow) => void>();
      await render({ presets: commonDXPPresets, onChange });
      await apply(preset.name);
      const applied = onChange.mock.lastCall?.[0];
      if (!applied) throw new Error('Expected an applied workflow');
      expect(applied.nodes).toEqual(preset.workflow.nodes);
      expect(applied.edges).toEqual(preset.workflow.edges);
      expect(applied.websiteUrl).toBe(initialWorkflow().websiteUrl);
      const notes = applied.nodes.filter((node) => node.data.kind === 'note');
      expect(notes.length).toBeGreaterThan(0);
      for (const note of notes) {
        const editor = element(`[data-id="${note.id}"] .dxp-note-text`);
        expect(editor.textContent).toBe(note.data.config.noteText);
        expect(editor.getAttribute('contenteditable')).toBe('true');
      }
      const editable = applied.nodes.find(
        (node) => node.data.kind === 'dom' || node.data.kind === 'popover',
      );
      if (!editable) throw new Error('Expected an editable action');
      await click(element(`[data-id="${editable.id}"]`));
      const input = element<HTMLInputElement>('.dxp-inspector input');
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setter) throw new Error('Missing input value setter');
        setter.call(input, 'My edited step');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(
        onChange.mock.lastCall?.[0].nodes.find((node) => node.id === editable.id)?.data.label,
      ).toBe('My edited step');
      for (const [index, node] of applied.nodes.entries()) {
        expect(node.data.config).not.toBe(preset.workflow.nodes[index].data.config);
        expect(node.position).not.toBe(preset.workflow.nodes[index].position);
        node.data.config.value = 'external edit';
        node.position.x += 10;
      }
      applied.edges[0].label = 'External edge edit';
      expect(JSON.stringify(preset)).toBe(before);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('hides the tab and panel when omitted or empty, responds to additions and removals, and restores focus', async () => {
    const onChange = vi.fn();
    await render({ onChange });
    expect(host.querySelector('[id$="-presets-tab"]')).toBeNull();
    expect(host.querySelector('[id$="-presets-panel"]')).toBeNull();
    await render({ presets: [], onChange });
    expect(host.querySelector('[id$="-presets-panel"]')).toBeNull();
    const changes = onChange.mock.calls.length;
    for (const removed of [[], undefined]) {
      await render({ presets: [welcomePreset], onChange });
      expect(element('[id$="-presets-panel"]').hidden).toBe(true);
      await click(tab('Presets'));
      expect(element('[id$="-presets-panel"]').hidden).toBe(false);
      await render({ presets: removed, onChange });
      expect(host.querySelector('[id$="-presets-tab"]')).toBeNull();
      expect(host.querySelector('[id$="-presets-panel"]')).toBeNull();
      expect(tab('Canvas').getAttribute('aria-selected')).toBe('true');
      expect(element('[id$="-canvas-panel"]').hidden).toBe(false);
      expect(document.activeElement).toBe(tab('Canvas'));
    }
    expect(onChange).toHaveBeenCalledTimes(changes);
  });

  it('sorts by explicit order without mutating a frozen array and updates cards on prop changes', async () => {
    const presets = freeze([remoteContentPreset, welcomePreset, returningVisitorPreset]);
    await render({ presets });
    await click(tab('Presets'));
    expect(
      [...host.querySelectorAll('.dxp-preset-card h3')].map((node) => node.textContent),
    ).toEqual([welcomePreset.name, returningVisitorPreset.name, remoteContentPreset.name]);
    expect(presets.map((preset) => preset.order)).toEqual([30, 10, 20]);
    const card = element('.dxp-preset-card');
    expect(card.textContent).toContain(welcomePreset.description);
    expect(card.textContent).toContain('beginner');
    expect(card.textContent).toContain('2 nodes');
    expect(card.textContent).toContain(welcomePreset.setupInstructions[0]);
    expect(element('.dxp-presets-header').textContent).toMatch(
      /replaces all current nodes and connections/,
    );
    expect(element('.dxp-presets-header').textContent).toContain('undo');
    // order, rather than the text of the complexity badge, is authoritative.
    await render({
      presets: [{ ...remoteContentPreset, order: 0, setupInstructions: undefined }, welcomePreset],
    });
    expect(element('.dxp-preset-card h3').textContent).toBe(remoteContentPreset.name);
    expect(element('.dxp-preset-card').querySelector('.dxp-preset-setup')).toBeNull();
  });

  it.each([false, true])(
    'includes Presets in roving tab navigation (AI settings: %s)',
    async (settings) => {
      await render({
        presets: [welcomePreset],
        ai: settings ? { endpoint: '/api/ai/chat' } : undefined,
      });
      await key(tab('Canvas'), 'ArrowRight');
      expect(document.activeElement).toBe(tab('Presets'));
      expect(tab('Presets').tabIndex).toBe(0);
      expect(tab('Canvas').tabIndex).toBe(-1);
      expect(tab('Presets').getAttribute('aria-controls')).toBe(
        element('[id$="-presets-panel"]').id,
      );
      await key(tab('Presets'), 'ArrowRight');
      expect(document.activeElement).toBe(tab('Activity'));
      await key(tab('Activity'), 'End');
      expect(document.activeElement).toBe(tab(settings ? 'AI Settings' : 'Activity'));
      await key(document.activeElement as HTMLElement, 'ArrowRight');
      expect(document.activeElement).toBe(tab('Canvas'));
      await key(tab('Canvas'), 'ArrowLeft');
      expect(document.activeElement).toBe(tab(settings ? 'AI Settings' : 'Activity'));
      await key(document.activeElement as HTMLElement, 'Home');
      expect(document.activeElement).toBe(tab('Canvas'));
    },
  );

  it.each([true, false, undefined])(
    'replaces the graph and preserves the latest host metadata (subpages: %s)',
    async (includeSubpages) => {
      const onChange = vi.fn<(workflow: Workflow) => void>();
      let api: VisualDXPBuilderApi | null = null;
      await render({
        presets: [welcomePreset],
        onChange,
        initialWorkflow: { ...initialWorkflow(), includeSubpages },
        onReady: (next) => {
          api = next;
        },
      });
      await act(async () => api?.renameWorkflow('Updated host name'));
      await apply();
      expect(onChange.mock.lastCall?.[0]).toEqual({
        ...welcomePreset.workflow,
        name: 'Updated host name',
        websiteUrl: initialWorkflow().websiteUrl,
        includeSubpages: includeSubpages ?? false,
      });
      expect(tab('Canvas').getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tab('Canvas'));
      expect(host.querySelector('[data-id="host-start"]')).toBeNull();
      expect(host.querySelector('[data-id="welcome-message"]')).not.toBeNull();
      expect(fitView).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(32));
      expect(fitView).toHaveBeenCalledTimes(1);
      expect(fitView).toHaveBeenCalledWith({ padding: 0.2, duration: 300 });
      expect(fetch).not.toHaveBeenCalled();
      expect(host.querySelector('iframe')).toBeNull();
    },
  );

  it('commits once, persists, and undoes/redoes the graph with the same activity entry', async () => {
    const store = createActivityStore();
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await render({
      presets: [remoteContentPreset],
      activityStore: store,
      activityUser: 'Ada',
      onChange,
      persistenceKey,
    });
    const original = structuredClone(onChange.mock.lastCall?.[0]);
    const changes = onChange.mock.calls.length;
    await apply(remoteContentPreset.name);
    const applied = structuredClone(onChange.mock.lastCall?.[0]);
    expect(onChange).toHaveBeenCalledTimes(changes + 1);
    expect(store.getSnapshot()).toHaveLength(1);
    const entry = store.getSnapshot()[0];
    expect(entry).toMatchObject({
      username: 'Ada',
      action: `Applied preset “${remoteContentPreset.name}”`,
    });
    await act(async () => vi.advanceTimersByTime(600));
    expect(JSON.parse(localStorage.getItem(persistenceKey) ?? 'null')).toEqual(applied);
    expect(fetch).not.toHaveBeenCalled();
    await click(tab('Activity'));
    expect(host.textContent).toContain(entry.action);
    await click(element('button[title^="Undo"]'));
    expect(onChange.mock.lastCall?.[0]).toEqual(original);
    expect(store.getSnapshot()).toEqual([]);
    expect(element<HTMLButtonElement>('button[title^="Undo"]').disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(600));
    expect(JSON.parse(localStorage.getItem(persistenceKey) ?? 'null')).toEqual(original);
    await click(element('button[title^="Redo"]'));
    expect(onChange.mock.lastCall?.[0]).toEqual(applied);
    expect(store.getSnapshot()).toEqual([entry]);
    expect(host.textContent).toContain(entry.action);
    await act(async () => vi.advanceTimersByTime(600));
    expect(JSON.parse(localStorage.getItem(persistenceKey) ?? 'null')).toEqual(applied);
  });

  it('deep-clones frozen presets, clears saved and current selection state, and leaves them unchanged after edits', async () => {
    const preset: WorkflowPreset = structuredClone(welcomePreset);
    preset.workflow.nodes[0].selected = true;
    preset.workflow.nodes[0].dragging = true;
    preset.workflow.nodes[0].data.status = 'success';
    preset.workflow.edges[0].selected = true;
    freeze(preset);
    const before = JSON.stringify(preset);
    const onChange = vi.fn<(workflow: Workflow) => void>();
    await render({ presets: [preset], onChange });
    await click(element('[data-id="host-start"]'));
    expect(host.querySelector('.dxp-inspector')).not.toBeNull();
    await apply();
    const applied = onChange.mock.lastCall?.[0];
    if (!applied) throw new Error('Expected an applied workflow');
    expect(host.querySelector('.dxp-inspector')).toBeNull();
    expect(applied.nodes[0].selected).toBeUndefined();
    expect(applied.nodes[0].dragging).toBeUndefined();
    expect(applied.nodes[0].data.status).toBeUndefined();
    expect(applied.edges[0].selected).toBeUndefined();
    expect(applied.nodes[0].data.config).not.toBe(preset.workflow.nodes[0].data.config);
    expect(applied.nodes[0].position).not.toBe(preset.workflow.nodes[0].position);
    expect(applied.edges[0]).not.toBe(preset.workflow.edges[0]);
    await click(element('[data-id="welcome-message"]'));
    const input = element<HTMLInputElement>('.dxp-inspector input');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Missing input value setter');
      setter.call(input, 'Edited message');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].nodes[1].data.label).toBe('Edited message');
    expect(JSON.stringify(preset)).toBe(before);
    // Mutating nested editor output cannot leak into the supplied preset either.
    applied.nodes[1].data.config.content = 'Changed outside';
    applied.nodes[1].position.x = 999;
    applied.edges[0].label = 'Changed connection';
    expect(JSON.stringify(preset)).toBe(before);
  });

  it.each([
    ['structure', { ...welcomePreset.workflow, nodes: null }, /structure/],
    [
      'dangling edge',
      {
        ...welcomePreset.workflow,
        edges: [{ id: 'bad', source: 'missing', target: 'welcome-start' }],
      },
      /structure/,
    ],
    [
      'configuration',
      {
        ...welcomePreset.workflow,
        nodes: [
          {
            ...welcomePreset.workflow.nodes[0],
            data: { kind: 'trigger', label: 'Click', config: { event: 'click' } },
          },
        ],
        edges: [],
      },
      /selector|element/i,
    ],
    [
      'graph',
      {
        ...returningVisitorPreset.workflow,
        edges: [{ id: 'bad-handle', source: 'returning-condition', target: 'returning-message' }],
      },
      /Yes or No/,
    ],
    [
      'cycle',
      {
        ...welcomePreset.workflow,
        edges: [
          ...welcomePreset.workflow.edges,
          { id: 'cycle', source: 'welcome-message', target: 'welcome-start' },
        ],
      },
      /Circular/,
    ],
  ])(
    'rejects invalid %s without changing state, persistence, history, or activity',
    async (_name, workflow, message) => {
      const store = createActivityStore();
      const onChange = vi.fn<(workflow: Workflow) => void>();
      await render({
        presets: [{ ...welcomePreset, workflow } as WorkflowPreset],
        activityStore: store,
        onChange,
        persistenceKey,
      });
      await click(element('[data-id="host-start"]'));
      await act(async () => vi.advanceTimersByTime(600));
      const saved = localStorage.getItem(persistenceKey);
      const changes = onChange.mock.calls.length;
      await apply();
      expect(element('[role="alert"]').textContent).toMatch(message);
      expect(tab('Presets').getAttribute('aria-selected')).toBe('true');
      expect(onChange).toHaveBeenCalledTimes(changes);
      expect(store.getSnapshot()).toEqual([]);
      expect(element<HTMLButtonElement>('button[title^="Undo"]').disabled).toBe(true);
      await act(async () => vi.advanceTimersByTime(600));
      expect(localStorage.getItem(persistenceKey)).toBe(saved);
      expect(fitView).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      await click(tab('Canvas'));
      expect(host.querySelector('.dxp-inspector')).not.toBeNull();
    },
  );

  it.each([welcomePreset, returningVisitorPreset, remoteContentPreset])(
    'ships a serializable, structurally and graph-valid $name example',
    (preset) => {
      expect(JSON.parse(JSON.stringify(preset))).toEqual(preset);
      expect(isWorkflow(preset.workflow)).toBe(true);
      expect(validateWorkflow(preset.workflow)).toEqual([]);
    },
  );
});
