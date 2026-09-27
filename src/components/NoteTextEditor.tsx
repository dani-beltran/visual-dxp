import { type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { readNoteSelection, restoreNoteSelection, useNoteSelection } from '../lib/noteSelection';
import { editNoteText, getNoteSegments, type NoteFormat, toggleNoteMark } from '../lib/noteText';
import type { StepConfig } from '../lib/types';

type Segment = ReturnType<typeof getNoteSegments>[number];

function sameStyle(first: Segment, second: Segment): boolean {
  return (
    Boolean(first.bold) === Boolean(second.bold) &&
    Boolean(first.italic) === Boolean(second.italic) &&
    Boolean(first.strikethrough) === Boolean(second.strikethrough)
  );
}

function domSegments(editor: HTMLElement): Segment[] {
  const segments: Segment[] = [];
  const walker = editor.ownerDocument.createTreeWalker(editor, 4 /* NodeFilter.SHOW_TEXT */);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent) {
      const element = node.parentElement;
      const segment: Segment = {
        text: node.textContent,
        bold: Boolean(element?.closest('[data-note-bold]')),
        italic: Boolean(element?.closest('[data-note-italic]')),
        strikethrough: Boolean(element?.closest('[data-note-strikethrough]')),
      };
      const previous = segments.at(-1);
      if (previous && sameStyle(previous, segment)) previous.text += segment.text;
      else segments.push(segment);
    }
    node = walker.nextNode();
  }
  return segments;
}

function renderNote(editor: HTMLElement, config: StepConfig): void {
  const expected = getNoteSegments(config).filter((segment) => segment.text.length > 0);
  const actual = domSegments(editor);
  editor.dataset.empty = String(!(config.noteText ?? '').length);
  if (
    actual.length === expected.length &&
    expected.every(
      (segment, index) => segment.text === actual[index].text && sameStyle(segment, actual[index]),
    )
  )
    return;

  const fragment = editor.ownerDocument.createDocumentFragment();
  for (const segment of expected) {
    const span = editor.ownerDocument.createElement('span');
    if (segment.bold) span.dataset.noteBold = 'true';
    if (segment.italic) span.dataset.noteItalic = 'true';
    if (segment.strikethrough) span.dataset.noteStrikethrough = 'true';
    span.style.fontWeight = segment.bold ? '700' : '400';
    span.style.fontStyle = segment.italic ? 'italic' : 'normal';
    span.style.textDecoration = segment.strikethrough ? 'line-through' : 'none';
    span.textContent = segment.text;
    fragment.append(span);
  }
  // A trailing break keeps the caret visible on the final empty line. It adds
  // no text or offsets to the persisted value.
  if ((config.noteText ?? '').endsWith('\n')) {
    const tail = editor.ownerDocument.createElement('br');
    tail.dataset.noteTrailingBreak = 'true';
    tail.setAttribute('aria-hidden', 'true');
    fragment.append(tail);
  }
  editor.replaceChildren(fragment);
}

export function NoteTextEditor({
  noteId,
  config,
  onChange,
  ariaLabel,
  id,
  className = '',
}: {
  noteId: string;
  config: StepConfig;
  onChange: (patch: Partial<StepConfig>) => void;
  ariaLabel: string;
  id?: string;
  className?: string;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const latest = useRef(config);
  latest.current = config;
  const composing = useRef(false);
  const { setSelection, registerEditor } = useNoteSelection();

  function rememberSelection() {
    const element = editor.current;
    if (!element) return;
    const range = readNoteSelection(element);
    if (range) setSelection({ editor: element, noteId, ...range });
  }

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element) return;
    return registerEditor(element, noteId);
  }, [noteId, registerEditor]);

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element || composing.current) return;
    const range = readNoteSelection(element);
    renderNote(element, config);
    if (range) restoreNoteSelection(element, range.start, range.end);
  }, [config]);

  function applyText(text: string, range: { start: number; end: number } | null) {
    const element = editor.current;
    if (!element) return;
    const patch = editNoteText(latest.current, text);
    const next = { ...latest.current, ...patch };
    latest.current = next;
    renderNote(element, next);
    if (range) {
      restoreNoteSelection(element, range.start, range.end);
      setSelection({ editor: element, noteId, ...range });
    }
    onChange(patch);
  }

  function replaceSelection(text: string) {
    const element = editor.current;
    if (!element) return;
    const previous = element.textContent ?? '';
    const range = readNoteSelection(element) ?? { start: previous.length, end: previous.length };
    const caret = range.start + text.length;
    applyText(`${previous.slice(0, range.start)}${text}${previous.slice(range.end)}`, {
      start: caret,
      end: caret,
    });
  }

  function input() {
    const element = editor.current;
    if (!element || composing.current) return;
    applyText(element.textContent ?? '', readNoteSelection(element));
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const shortcut = event.metaKey || event.ctrlKey;
    // Builder undo/redo owns editor history too, including formatting changes.
    if (shortcut && event.key.toLowerCase() === 'z') return;
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      replaceSelection('\n');
      return;
    }
    const key = event.key.toLowerCase();
    const format: NoteFormat | null = shortcut
      ? key === 'b'
        ? 'bold'
        : key === 'i'
          ? 'italic'
          : key === 'x' && event.shiftKey
            ? 'strikethrough'
            : null
      : null;
    if (!format) return;
    event.preventDefault();
    const range = readNoteSelection(event.currentTarget);
    if (!range || range.start === range.end) return;
    const patch = toggleNoteMark(latest.current, range.start, range.end, format);
    const next = { ...latest.current, ...patch };
    latest.current = next;
    renderNote(event.currentTarget, next);
    restoreNoteSelection(event.currentTarget, range.start, range.end);
    setSelection({ editor: event.currentTarget, noteId, ...range });
    onChange(patch);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Mixed inline text marks require a contenteditable rich-text textbox.
    <div
      ref={editor}
      id={id}
      className={`dxp-note-editor nodrag nopan nowheel ${className}`.trim()}
      contentEditable
      tabIndex={0}
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline="true"
      data-placeholder="Write a note…"
      data-empty={!(config.noteText ?? '').length}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      onInput={input}
      onFocus={rememberSelection}
      onPointerUp={rememberSelection}
      onKeyUp={rememberSelection}
      onKeyDown={keyDown}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        input();
      }}
      onPaste={(event) => {
        event.preventDefault();
        event.stopPropagation();
        replaceSelection(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'));
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    />
  );
}
