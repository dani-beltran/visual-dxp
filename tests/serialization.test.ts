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
    for (const config of [null, [], { url: 42 }, { width: 'wide' }, { duration: Infinity }])
      expect(
        isWorkflow({
          ...valid,
          nodes: [{ ...valid.nodes[0], data: { kind: 'http', label: 'Request', config } }],
        }),
      ).toBe(false);
  });
  it('rejects duplicate node ids and broken connections', () => {
    expect(isWorkflow({ ...valid, nodes: [valid.nodes[0], valid.nodes[0]] })).toBe(false);
    expect(isWorkflow({ ...valid, edges: [{ id: 'e', source: 't', target: 'missing' }] })).toBe(
      false,
    );
  });
});
