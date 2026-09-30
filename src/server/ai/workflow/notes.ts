import type { NoteMark } from './types';

/** Ranges use JavaScript string (UTF-16) offsets; patches can omit the text. */
export function parseNoteMarks(value: unknown, textLength = Infinity): NoteMark[] {
  if (!Array.isArray(value)) throw new Error('Note marks must be an array.');
  let previousEnd = 0;
  return value.map((entry): NoteMark => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('Every note mark must be an object.');
    const input = entry as Record<string, unknown>;
    if (
      typeof input.start !== 'number' ||
      !Number.isInteger(input.start) ||
      typeof input.end !== 'number' ||
      !Number.isInteger(input.end) ||
      input.start < previousEnd ||
      input.end <= input.start ||
      input.end > textLength
    )
      throw new Error('Note marks must be sorted, non-overlapping ranges within the note text.');
    const mark: NoteMark = { start: input.start, end: input.end };
    for (const key of ['bold', 'italic', 'strikethrough'] as const) {
      if (input[key] === undefined) continue;
      if (typeof input[key] !== 'boolean')
        throw new Error('Note mark formatting parameters must be booleans.');
      mark[key] = input[key];
    }
    previousEnd = input.end;
    return mark;
  });
}
