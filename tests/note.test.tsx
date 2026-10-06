// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder/VisualDXPBuilder';
import { createActivityStore } from '../src/lib/activity';
import { createNode } from '../src/lib/catalog';
import type { Workflow } from '../src/lib/types';

let host: HTMLDivElement;
let root: Root;
const persistenceKey = 'note-test-workflow';

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
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.removeItem(persistenceKey);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function element<T extends HTMLElement>(selector: string): T {
  const result = host.querySelector<T>(selector);
  if (!result) throw new Error(`Missing element: ${selector}`);
  return result;
}

function button(label: string) {
  return element<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
}

async function typeText(input: HTMLElement, value: string) {
  await act(async () => {
    input.focus();
    input.textContent = value;
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  });
}

async function selectText(editor: HTMLElement, start: number, end: number) {
  await act(async () => {
    editor.focus();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let started = false;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent?.length ?? 0;
      if (!started && start <= offset + length) {
        range.setStart(node, start - offset);
        started = true;
      }
      if (end <= offset + length) {
        range.setEnd(node, end - offset);
        break;
      }
      offset += length;
    }
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
}

function initialWorkflow(): Workflow {
  return {
    version: 1,
    name: 'Notes test',
    websiteUrl: '/demo-site.html',
    nodes: [createNode('trigger', { x: 0, y: 0 })],
    edges: [],
  };
}

async function renderBuilder(workflow = initialWorkflow(), persist = false) {
  const onChange = vi.fn<(workflow: Workflow) => void>();
  const activityStore = createActivityStore();
  await act(async () =>
    root.render(
      <StrictMode>
        <VisualDXPBuilder
          initialWorkflow={workflow}
          onChange={onChange}
          activityStore={activityStore}
          persistenceKey={persist ? persistenceKey : undefined}
        />
      </StrictMode>,
    ),
  );
  const latest = () => {
    const value = onChange.mock.calls.at(-1)?.[0];
    if (!value) throw new Error('Expected workflow change');
    return value;
  };
  return { latest, activityStore };
}

function note(workflow: Workflow) {
  const result = workflow.nodes.find((node) => node.data.kind === 'note');
  if (!result) throw new Error('Expected note in workflow');
  return result;
}

function canvasText() {
  return element<HTMLElement>('.dxp-note-card [contenteditable]');
}

function inspectorText() {
  return element<HTMLElement>('.dxp-inspector [contenteditable]');
}

describe('Note nodes', () => {
  it('adds a non-connectable note and synchronizes inline and inspector text edits', async () => {
    const { latest } = await renderBuilder();
    await click(button('Add Note'));
    expect(note(latest()).data.config.noteColor).toBe('#fff4b8');
    expect(host.querySelector('.dxp-note-card .react-flow__handle')).toBeNull();
    expect(host.querySelector('[aria-label="Note configuration"]')).not.toBeNull();

    const text = 'Launch checklist\nReview the welcome journey';
    await typeText(canvasText(), text);
    expect(note(latest()).data.config.noteText).toBe(text);
    expect(inspectorText().textContent).toBe(text);
    await typeText(inspectorText(), 'Revised from the details panel');
    expect(canvasText().textContent).toBe('Revised from the details panel');

    await act(async () => {
      canvasText().focus();
      canvasText().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      canvasText().dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
    });
    expect(latest().nodes.filter((node) => node.data.kind === 'note')).toHaveLength(1);
  });

  it('combines text formatting and transparent color, then undoes and redoes the edit', async () => {
    vi.useFakeTimers();
    const { latest, activityStore } = await renderBuilder();
    await click(button('Add Note'));
    await typeText(canvasText(), 'Remember this');
    expect(button('Bold').disabled).toBe(true);
    await selectText(canvasText(), 0, 8);
    await click(button('Bold'));
    await click(button('Italic'));
    await click(button('Strikethrough'));
    await click(button('Transparent background'));
    expect(note(latest()).data.config).toMatchObject({
      noteText: 'Remember this',
      noteColor: 'transparent',
      noteMarks: [{ start: 0, end: 8, bold: true, italic: true, strikethrough: true }],
    });
    const formatted = canvasText().querySelector('span');
    expect(formatted?.textContent).toBe('Remember');
    expect(formatted?.style.fontWeight).toBe('700');
    expect(formatted?.style.fontStyle).toBe('italic');
    expect(formatted?.style.textDecoration).toBe('line-through');
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true');
    expect(element<HTMLElement>('.dxp-note-card').style.backgroundColor).toBe('transparent');

    await act(async () => vi.advanceTimersByTime(650));
    expect(activityStore.getSnapshot()).toHaveLength(2);
    await click(element('button[title^="Undo"]'));
    expect(note(latest()).data.config.noteText).toBe('');
    expect(note(latest()).data.config.noteMarks).toEqual([]);
    expect(activityStore.getSnapshot()).toHaveLength(1);
    await click(element('button[title^="Redo"]'));
    expect(note(latest()).data.config.noteText).toBe('Remember this');
    expect(note(latest()).data.config.noteColor).toBe('transparent');
    expect(activityStore.getSnapshot()).toHaveLength(2);
  });

  it('persists note formatting and duplicates and deletes notes independently', async () => {
    vi.useFakeTimers();
    const original = createNode('note', { x: 300, y: 0 });
    original.data.config = {
      noteText: 'Saved annotation',
      noteColor: '#123456',
      noteMarks: [
        { start: 0, end: 5, bold: true },
        { start: 6, end: 16, italic: true, strikethrough: true },
      ],
    };
    const workflow = initialWorkflow();
    workflow.nodes.push(original);
    const { latest } = await renderBuilder(workflow, true);
    await act(async () => vi.advanceTimersByTime(600));
    const saved: Workflow = JSON.parse(localStorage.getItem(persistenceKey) || 'null');
    expect(note(saved).data.config).toEqual(original.data.config);
    await act(async () => root.unmount());
    root = createRoot(host);
    const restored = await renderBuilder(initialWorkflow(), true);
    expect(note(restored.latest()).data.config).toEqual(original.data.config);
    expect(canvasText().textContent).toBe('Saved annotation');
    await click(element(`[data-id="${original.id}"]`));
    await click(element('.dxp-inspector-footer button[title^="Duplicate"]'));
    const notes = restored.latest().nodes.filter((node) => node.data.kind === 'note');
    expect(notes).toHaveLength(2);
    expect(notes[1].data.config).toEqual(original.data.config);
    expect(notes[1].id).not.toBe(original.id);
    await typeText(inspectorText(), 'Only the copy changed');
    expect(note(restored.latest()).data.config.noteText).toBe('Saved annotation');
    await click(element('.dxp-inspector-footer button[title^="Delete"]'));
    expect(restored.latest().nodes.filter((node) => node.data.kind === 'note')).toHaveLength(1);
    expect(note(restored.latest()).id).toBe(original.id);
    expect(latest().nodes).toHaveLength(2);
  });

  it('formats different selections from either editor without changing surrounding text', async () => {
    const { latest } = await renderBuilder();
    await click(button('Add Note'));
    await typeText(canvasText(), 'Alpha beta gamma');
    await selectText(canvasText(), 0, 5);
    await click(button('Bold'));
    expect(document.getSelection()?.toString()).toBe('Alpha');
    await selectText(inspectorText(), 6, 10);
    await click(button('Italic'));
    expect(document.getSelection()?.toString()).toBe('beta');
    await selectText(inspectorText(), 8, 16);
    await click(button('Strikethrough'));
    expect(note(latest()).data.config.noteMarks).toEqual([
      { start: 0, end: 5, bold: true },
      { start: 6, end: 8, italic: true },
      { start: 8, end: 10, italic: true, strikethrough: true },
      { start: 10, end: 16, strikethrough: true },
    ]);
    expect(canvasText().textContent).toBe('Alpha beta gamma');
    expect(inspectorText().textContent).toBe('Alpha beta gamma');
    await selectText(canvasText(), 0, 5);
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true');
    await click(button('Bold'));
    expect(note(latest()).data.config.noteMarks).toEqual([
      { start: 6, end: 8, italic: true },
      { start: 8, end: 10, italic: true, strikethrough: true },
      { start: 10, end: 16, strikethrough: true },
    ]);
  });

  it('preserves legacy whole-note formatting while allowing a selected part to be unformatted', async () => {
    const workflow = initialWorkflow();
    const original = createNode('note');
    original.data.config = { noteText: 'Old formatted note', noteBold: true };
    workflow.nodes.push(original);
    const { latest } = await renderBuilder(workflow);
    await click(element(`[data-id="${original.id}"]`));
    await selectText(canvasText(), 4, 13);
    await click(button('Bold'));
    expect(note(latest()).data.config.noteMarks).toEqual([
      { start: 0, end: 4, bold: true },
      { start: 13, end: 18, bold: true },
    ]);
    expect(note(latest()).data.config.noteBold).toBe(false);
  });
});
