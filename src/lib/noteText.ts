import type { NoteMark, StepConfig } from './types';

export type NoteFormat = 'bold' | 'italic' | 'strikethrough';
export type NoteSegment = Pick<NoteMark, NoteFormat> & { text: string };

const formats: NoteFormat[] = ['bold', 'italic', 'strikethrough'];
const clearedLegacy = { noteBold: false, noteItalic: false, noteStrikethrough: false };

/** Validate untrusted runs, optionally deferring text bounds for a partial AI update. */
export function isNoteMarks(value: unknown, textLength = Infinity): value is NoteMark[] {
  if (!Array.isArray(value)) return false;
  let previousEnd = 0;
  for (const mark of value) {
    if (
      !mark ||
      typeof mark !== 'object' ||
      Array.isArray(mark) ||
      !Number.isInteger(mark.start) ||
      !Number.isInteger(mark.end) ||
      mark.start < previousEnd ||
      mark.end <= mark.start ||
      mark.end > textLength ||
      formats.some((format) => mark[format] !== undefined && typeof mark[format] !== 'boolean')
    )
      return false;
    previousEnd = mark.end;
  }
  return true;
}

function style(mark?: Partial<NoteMark>): Pick<NoteMark, NoteFormat> {
  return {
    ...(mark?.bold ? { bold: true } : {}),
    ...(mark?.italic ? { italic: true } : {}),
    ...(mark?.strikethrough ? { strikethrough: true } : {}),
  };
}

/** Merge adjacent identical styles and omit false flags and unstyled runs. */
function normalize(marks: NoteMark[], length: number): NoteMark[] {
  const result: NoteMark[] = [];
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (!Number.isInteger(mark.start) || !Number.isInteger(mark.end)) continue;
    const previous = result.at(-1);
    const start = Math.max(0, previous?.end ?? 0, mark.start);
    const end = Math.min(length, mark.end);
    const flags = style(mark);
    if (start >= end || !formats.some((format) => flags[format])) continue;
    if (previous?.end === start && formats.every((format) => !!previous[format] === !!flags[format]))
      previous.end = end;
    else result.push({ start, end, ...flags });
  }
  return result;
}

export function getNoteMarks(config: StepConfig): NoteMark[] {
  const length = (config.noteText ?? '').length;
  if (config.noteMarks !== undefined) return normalize(config.noteMarks, length);
  return normalize(
    [{ start: 0, end: length, bold: config.noteBold, italic: config.noteItalic, strikethrough: config.noteStrikethrough }],
    length,
  );
}

function selection(config: StepConfig, start: number, end: number): [number, number] {
  const length = (config.noteText ?? '').length;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [0, 0];
  return [
    Math.max(0, Math.min(length, Math.trunc(Math.min(start, end)))),
    Math.max(0, Math.min(length, Math.trunc(Math.max(start, end)))),
  ];
}

export function selectionHasNoteMark(
  config: StepConfig,
  start: number,
  end: number,
  format: NoteFormat,
): boolean {
  const [from, to] = selection(config, start, end);
  if (from === to) return false;
  let covered = from;
  for (const mark of getNoteMarks(config)) {
    if (mark.end <= covered) continue;
    if (mark.start > covered || !mark[format]) return false;
    covered = mark.end;
    if (covered >= to) return true;
  }
  return false;
}

export function toggleNoteMark(
  config: StepConfig,
  start: number,
  end: number,
  format: NoteFormat,
): Partial<StepConfig> {
  const [from, to] = selection(config, start, end);
  if (from === to) return {};
  const length = (config.noteText ?? '').length;
  const marks = getNoteMarks(config);
  const enabled = !selectionHasNoteMark(config, from, to, format);
  const boundaries = [...new Set([0, length, from, to, ...marks.flatMap((mark) => [mark.start, mark.end])])].sort((a, b) => a - b);
  const result: NoteMark[] = [];
  let index = 0;
  for (let part = 0; part < boundaries.length - 1; part += 1) {
    const rangeStart = boundaries[part];
    const rangeEnd = boundaries[part + 1];
    while (index < marks.length && marks[index].end <= rangeStart) index += 1;
    const flags = style(marks[index]?.start <= rangeStart ? marks[index] : undefined);
    if (rangeStart >= from && rangeEnd <= to) flags[format] = enabled;
    result.push({ start: rangeStart, end: rangeEnd, ...flags });
  }
  return { ...clearedLegacy, noteMarks: normalize(result, length) };
}

/** Preserve ranges around a contiguous text edit, including UTF-16 emoji offsets. */
export function editNoteText(config: StepConfig, newText: string): Partial<StepConfig> {
  const oldText = config.noteText ?? '';
  const marks = getNoteMarks(config);
  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start += 1;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  const offset = newEnd - oldEnd;
  const inheritedIndex = oldEnd > start ? start : Math.max(0, start - 1);
  const inherited = marks.find((mark) => mark.start <= inheritedIndex && mark.end > inheritedIndex);
  const result: NoteMark[] = [];
  for (const mark of marks) {
    if (mark.start < start) result.push({ ...mark, end: Math.min(mark.end, start) });
    if (mark.end > oldEnd) result.push({ ...mark, start: Math.max(mark.start, oldEnd) + offset, end: mark.end + offset });
  }
  if (newEnd > start) result.push({ start, end: newEnd, ...style(inherited) });
  return { noteText: newText, ...clearedLegacy, noteMarks: normalize(result, newText.length) };
}

export function getNoteSegments(config: StepConfig): NoteSegment[] {
  const text = config.noteText ?? '';
  const result: NoteSegment[] = [];
  let offset = 0;
  for (const mark of getNoteMarks(config)) {
    if (mark.start > offset) result.push({ text: text.slice(offset, mark.start) });
    result.push({ text: text.slice(mark.start, mark.end), ...style(mark) });
    offset = mark.end;
  }
  if (offset < text.length) result.push({ text: text.slice(offset) });
  return result;
}
