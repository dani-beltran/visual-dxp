import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface NoteSelection {
  noteId: string;
  start: number;
  end: number;
  editor: HTMLElement;
}

interface NoteSelectionContextValue {
  selection: NoteSelection | null;
  setSelection: (selection: NoteSelection | null) => void;
  registerEditor: (editor: HTMLElement, noteId: string) => () => void;
}

const NoteSelectionContext = createContext<NoteSelectionContextValue>({
  selection: null,
  setSelection: () => {},
  registerEditor: () => () => {},
});

/** UTF-16 offsets match both DOM text nodes and the saved note mark ranges. */
export function readNoteSelection(editor: HTMLElement): { start: number; end: number } | null {
  const selection = editor.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
  const before = range.cloneRange();
  before.selectNodeContents(editor);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  before.setEnd(range.endContainer, range.endOffset);
  return { start, end: before.toString().length };
}

/** Restore a saved range after rendering spans or returning from a formatting control. */
export function restoreNoteSelection(editor: HTMLElement, start: number, end: number): void {
  const document = editor.ownerDocument;
  const selection = document.getSelection();
  if (!selection) return;
  const length = editor.textContent?.length ?? 0;
  const from = Math.max(0, Math.min(length, start));
  const to = Math.max(from, Math.min(length, end));
  const walker = document.createTreeWalker(editor, 4 /* NodeFilter.SHOW_TEXT */);
  const position = (offset: number): { node: Node; offset: number } => {
    walker.currentNode = editor;
    let remaining = offset;
    let text = walker.nextNode();
    let last: Node | null = null;
    while (text) {
      const size = text.textContent?.length ?? 0;
      if (remaining <= size) return { node: text, offset: remaining };
      remaining -= size;
      last = text;
      text = walker.nextNode();
    }
    return last ? { node: last, offset: last.textContent?.length ?? 0 } : { node: editor, offset: 0 };
  };
  const anchor = position(from);
  const focus = position(to);
  const range = document.createRange();
  range.setStart(anchor.node, anchor.offset);
  range.setEnd(focus.node, focus.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function NoteSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, updateSelection] = useState<NoteSelection | null>(null);
  const editors = useRef(new Map<HTMLElement, string>());
  const setSelection = useCallback((next: NoteSelection | null) => {
    updateSelection((previous) =>
      previous?.editor === next?.editor &&
      previous?.noteId === next?.noteId &&
      previous?.start === next?.start &&
      previous?.end === next?.end
        ? previous
        : next,
    );
  }, []);
  const registerEditor = useCallback((editor: HTMLElement, noteId: string) => {
    editors.current.set(editor, noteId);
    return () => {
      editors.current.delete(editor);
      updateSelection((previous) => (previous?.editor === editor ? null : previous));
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const nativeSelection = document.getSelection();
      const anchor = nativeSelection?.anchorNode;
      const parent = anchor?.nodeType === 1 ? (anchor as Element) : anchor?.parentElement;
      const editor = parent?.closest<HTMLElement>('.dxp-note-editor');
      const noteId = editor && editors.current.get(editor);
      const range = editor && noteId ? readNoteSelection(editor) : null;
      if (editor && noteId && range) {
        setSelection({ editor, noteId, ...range });
      } else if (!document.activeElement?.closest('[data-note-format-toolbar]')) {
        setSelection(null);
      }
    };
    const focus = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.dxp-note-editor, [data-note-format-toolbar]')) setSelection(null);
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('focusin', focus);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('focusin', focus);
    };
  }, [setSelection]);

  const context = useMemo(
    () => ({ selection, setSelection, registerEditor }),
    [selection, setSelection, registerEditor],
  );
  return <NoteSelectionContext.Provider value={context}>{children}</NoteSelectionContext.Provider>;
}

export function useNoteSelection() {
  return useContext(NoteSelectionContext);
}
