import { expect, it } from 'vitest';
import { getNodeDataFlow } from '../src/lib/nodeData';
import type { NodeKind, StepConfig } from '../src/lib/types';

function node(id: string, kind: NodeKind, config: StepConfig = {}) {
  return { id, data: { kind, label: id, config } };
}

it('labels producers, forwarding steps and receivers across intermediate steps', () => {
  const nodes = [
    node('http', 'http'),
    node('delay', 'delay'),
    node('condition', 'fork', { conditionType: 'selector' }),
    node('element', 'dom'),
    node('request', 'http'),
  ];
  const edges = [
    { source: 'http', target: 'delay' },
    { source: 'delay', target: 'condition' },
    { source: 'condition', target: 'element' },
    { source: 'condition', target: 'request' },
  ];
  expect(nodes.map(({ id }) => getNodeDataFlow(id, nodes, edges))).toEqual([
    'produces',
    'forwards',
    'forwards',
    'receives',
    'produces',
  ]);
  expect(getNodeDataFlow('delay', nodes, edges.slice(0, 1))).toBe('receives');
  expect(getNodeDataFlow('element', nodes, edges.slice(1))).toBeUndefined();
  expect(getNodeDataFlow('request', nodes, [])).toBe('produces');
});

it.each(['dom', 'fork', 'delay', 'cookie', 'popover', 'loop'] as const)(
  '%s forwards data regardless of whether its settings consume it',
  (kind) => {
    const nodes = [node('http', 'http'), node('middle', kind), node('end', 'dom')];
    const edges = [
      { source: 'http', target: 'middle' },
      { source: 'middle', target: 'end' },
    ];
    expect(getNodeDataFlow('middle', nodes, edges)).toBe('forwards');
    expect(getNodeDataFlow('end', nodes, edges)).toBe('receives');
  },
);

it('does not infer data from conditions alone, missing sources or cycles without a producer', () => {
  const nodes = [node('condition', 'fork', { conditionType: 'data' }), node('element', 'dom')];
  const edges = [
    { source: 'missing', target: 'condition' },
    { source: 'condition', target: 'element' },
    { source: 'element', target: 'condition' },
  ];
  expect(getNodeDataFlow('element', nodes, edges)).toBeUndefined();
  expect(getNodeDataFlow('condition', nodes, edges)).toBeUndefined();
});

it.each(['note', 'frame', 'trigger'] as const)('does not trace data through %s nodes', (kind) => {
  const nodes = [node('http', 'http'), node('blocked', kind), node('element', 'dom')];
  const edges = [
    { source: 'http', target: 'blocked' },
    { source: 'blocked', target: 'element' },
  ];
  expect(getNodeDataFlow('blocked', nodes, edges)).toBeUndefined();
  expect(getNodeDataFlow('element', nodes, edges)).toBeUndefined();
});
