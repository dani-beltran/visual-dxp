import { describe, expect, it } from 'vitest';
import { isWorkflow } from '../src/lib/serialization';
import type { Workflow } from '../src/lib/types';

const valid: Workflow = {
  version: 1,
  name: 'Journey',
  websiteUrl: '/site',
  nodes: [
    {
      id: 't',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind: 'trigger', label: 'Visit', config: { event: 'page-load' } },
    },
  ],
  edges: [],
};
describe('workflow import boundary', () => {
  it('accepts a valid workflow and incomplete editable configurations', () => {
    expect(isWorkflow(valid)).toBe(true);
    expect(
      isWorkflow({
        ...valid,
        nodes: [
          { ...valid.nodes[0], data: { kind: 'http', label: 'Request', config: { url: '' } } },
        ],
      }),
    ).toBe(true);
  });
  it('rejects malformed node config types before the UI renders them', () => {
    for (const config of [
      null,
      [],
      { url: 42 },
      { imageAlt: 42 },
      { width: 'wide' },
      { duration: Infinity },
    ])
      expect(
        isWorkflow({
          ...valid,
          nodes: [{ ...valid.nodes[0], data: { kind: 'http', label: 'Request', config } }],
        }),
      ).toBe(false);
  });
  it('round-trips notes with text, transparent or custom colors, and every formatting flag', () => {
    for (const noteColor of ['transparent', '#0Aa1fF']) {
      const graph: Workflow = {
        ...valid,
        nodes: [
          ...valid.nodes,
          {
            id: 'note',
            type: 'workflow',
            position: { x: 100, y: 80 },
            data: {
              kind: 'note',
              label: 'Note',
              config: {
                noteText: 'Review this journey\nBefore publishing',
                noteColor,
                noteBold: true,
                noteItalic: false,
                noteStrikethrough: true,
                noteMarks: [
                  { start: 0, end: 6, bold: true },
                  { start: 7, end: 11, italic: true, strikethrough: false },
                ],
              },
            },
          },
        ],
      };
      const restored: unknown = JSON.parse(JSON.stringify(graph));
      expect(isWorkflow(restored)).toBe(true);
      expect(restored).toEqual(graph);
    }
  });
  it('rejects malformed note text, colors, and formatting values', () => {
    for (const config of [
      { noteText: 42 },
      { noteColor: false },
      { noteColor: 'red' },
      { noteColor: '#fff' },
      { noteColor: 'url(https://example.com)' },
      { noteBold: 'true' },
      { noteItalic: 1 },
      { noteStrikethrough: null },
      { noteText: 'note', noteMarks: [{ start: 0, end: 5, bold: true }] },
      {
        noteText: 'note',
        noteMarks: [
          { start: 0, end: 2 },
          { start: 1, end: 3 },
        ],
      },
      { noteText: 'note', noteMarks: [{ start: 0, end: 2, italic: 'true' }] },
    ]) {
      expect(
        isWorkflow({
          ...valid,
          nodes: [{ ...valid.nodes[0], data: { kind: 'note', label: 'Note', config } }],
        }),
      ).toBe(false);
    }
    expect(
      isWorkflow({
        ...valid,
        nodes: [{ ...valid.nodes[0], data: { kind: 'note', label: 'Note', config: {} } }],
      }),
    ).toBe(true);
  });
  it('rejects duplicate node ids and broken connections', () => {
    expect(isWorkflow({ ...valid, nodes: [valid.nodes[0], valid.nodes[0]] })).toBe(false);
    expect(isWorkflow({ ...valid, edges: [{ id: 'e', source: 't', target: 'missing' }] })).toBe(
      false,
    );
  });
});
