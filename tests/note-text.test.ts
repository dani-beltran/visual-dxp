import { describe, expect, it } from 'vitest';
import {
  editNoteText,
  getNoteMarks,
  getNoteSegments,
  isNoteMarks,
  selectionHasNoteMark,
  toggleNoteMark,
} from '../src/lib/noteText';
import type { StepConfig } from '../src/lib/types';

describe('note text formatting', () => {
  it('formats selected text and independently combines overlapping formatting selections', () => {
    let config: StepConfig = { noteText: 'alpha beta gamma' };
    config = { ...config, ...toggleNoteMark(config, 6, 10, 'bold') };
    config = { ...config, ...toggleNoteMark(config, 8, 16, 'italic') };
    expect(getNoteSegments(config)).toEqual([
      { text: 'alpha ' },
      { text: 'be', bold: true },
      { text: 'ta', bold: true, italic: true },
      { text: ' gamma', italic: true },
    ]);
    config = { ...config, ...toggleNoteMark(config, 6, 10, 'bold') };
    expect(getNoteMarks(config)).toEqual([{ start: 8, end: 16, italic: true }]);
    config = { ...config, ...toggleNoteMark(config, 11, 16, 'strikethrough') };
    expect(getNoteSegments(config).at(-1)).toEqual({
      text: 'gamma',
      italic: true,
      strikethrough: true,
    });
  });

  it('adds a style throughout a partially styled selection, and removes it only when fully styled', () => {
    const original: StepConfig = {
      noteText: 'abcdef',
      noteMarks: [
        { start: 1, end: 3, bold: true },
        { start: 3, end: 5, bold: true, italic: true },
      ],
    };
    expect(selectionHasNoteMark(original, 1, 5, 'bold')).toBe(true);
    expect(selectionHasNoteMark(original, 0, 5, 'bold')).toBe(false);
    const config = { ...original, ...toggleNoteMark(original, 5, 0, 'bold') };
    expect(getNoteMarks(config)).toEqual([
      { start: 0, end: 3, bold: true },
      { start: 3, end: 5, bold: true, italic: true },
    ]);
    expect(original.noteMarks?.[0].start).toBe(1);
  });

  it('does not apply a whole-note style when there is no selection', () => {
    const config = { noteText: 'abc' };
    expect(toggleNoteMark(config, 1, 1, 'bold')).toEqual({});
    expect(toggleNoteMark(config, NaN, 2, 'bold')).toEqual({});
    expect(selectionHasNoteMark({ ...config, noteBold: true }, 1, 1, 'bold')).toBe(false);
  });

  it('reads legacy formatting only when marks are absent and migrates it on editing', () => {
    const config = { noteText: 'hello', noteBold: true, noteItalic: true };
    expect(getNoteMarks(config)).toEqual([{ start: 0, end: 5, bold: true, italic: true }]);
    expect(getNoteMarks({ ...config, noteMarks: [] })).toEqual([]);
    expect(toggleNoteMark(config, 0, 2, 'bold')).toEqual({
      noteBold: false,
      noteItalic: false,
      noteStrikethrough: false,
      noteMarks: [
        { start: 0, end: 2, italic: true },
        { start: 2, end: 5, bold: true, italic: true },
      ],
    });
  });

  it('normalizes adjacent identical marks and renders markup as literal text', () => {
    const config: StepConfig = {
      noteText: '<b>hello</b>!',
      noteMarks: [
        { start: 0, end: 3, bold: true, italic: false },
        { start: 3, end: 8, bold: true },
        { start: 8, end: 12, bold: false },
      ],
    };
    expect(getNoteSegments(config)).toEqual([{ text: '<b>hello', bold: true }, { text: '</b>!' }]);
    expect(getNoteSegments({})).toEqual([]);
  });

  it('shifts ranges for inserted plain text and inherits styling inside an existing run', () => {
    const config: StepConfig = {
      noteText: 'Hello world',
      noteMarks: [{ start: 6, end: 11, bold: true }],
    };
    expect(editNoteText(config, 'Say Hello world').noteMarks).toEqual([
      { start: 10, end: 15, bold: true },
    ]);
    expect(editNoteText(config, 'Hello woXrld').noteMarks).toEqual([
      { start: 6, end: 12, bold: true },
    ]);
    expect(editNoteText(config, 'Hello brave world').noteMarks).toEqual([
      { start: 12, end: 17, bold: true },
    ]);
  });

  it('retains surrounding styles when replacing or deleting text', () => {
    const config: StepConfig = {
      noteText: 'abcdef',
      noteMarks: [
        { start: 0, end: 3, bold: true },
        { start: 3, end: 6, italic: true },
      ],
    };
    expect(editNoteText(config, 'abXXef').noteMarks).toEqual([
      { start: 0, end: 4, bold: true },
      { start: 4, end: 6, italic: true },
    ]);
    expect(editNoteText(config, 'abef').noteMarks).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 2, end: 4, italic: true },
    ]);
    expect(editNoteText(config, '').noteMarks).toEqual([]);
    expect(editNoteText(config, config.noteText ?? '').noteMarks).toEqual(config.noteMarks);
  });

  it('uses UTF-16 offsets and inherits formatting at the beginning and end of a run', () => {
    const config: StepConfig = {
      noteText: 'A😀B',
      noteMarks: [{ start: 1, end: 3, strikethrough: true }],
    };
    expect(editNoteText(config, 'A😀!B').noteMarks).toEqual([
      { start: 1, end: 4, strikethrough: true },
    ]);
    const beginning = editNoteText({ noteText: 'word', noteBold: true }, 'New word');
    expect(beginning.noteMarks).toEqual([{ start: 0, end: 8, bold: true }]);
  });

  it('rejects invalid offsets, bounds, order, overlaps, and flag types', () => {
    for (const marks of [
      null,
      {},
      [{ start: -1, end: 2 }],
      [{ start: 2, end: 2 }],
      [{ start: 0.5, end: 2 }],
      [{ start: 0, end: Infinity }],
      [{ start: 0, end: 4 }],
      [{ start: 0, end: 2, bold: 'true' }],
      [{ start: 0, end: 2, italic: null }],
      [
        { start: 1, end: 3 },
        { start: 0, end: 1 },
      ],
      [
        { start: 0, end: 2 },
        { start: 1, end: 3 },
      ],
    ])
      expect(isNoteMarks(marks, 3)).toBe(false);
    expect(isNoteMarks([], 0)).toBe(true);
    expect(isNoteMarks([{ start: 0, end: 3, bold: false }], 3)).toBe(true);
  });
});
