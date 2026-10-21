import type { Workflow, WorkflowNode } from '../../src/server/ai/workflow/types';

export function diamond(kind: 'fork' | 'experiment' | 'loop' = 'fork'): Workflow {
  const make = (id: string): WorkflowNode => ({
    id,
    type: 'workflow',
    position: { x: 0, y: 220 },
    data: { kind: 'delay', label: id, config: { duration: 10 } },
  });
  const nodes = ['start', 'split', 'z-first', 'a-second', 'join'].map(make);
  nodes[0].data = { kind: 'trigger', label: 'Start', config: { event: 'page-load' } };
  nodes[1].data = {
    kind,
    label: 'Split',
    config:
      kind === 'fork'
        ? { conditionType: 'device', conditionValue: 'mobile' }
        : kind === 'loop'
          ? { iterations: 2 }
          : {},
  };
  const handles =
    kind === 'fork' ? ['true', 'false'] : kind === 'experiment' ? ['a', 'b'] : ['body', 'done'];
  return {
    version: 1,
    name: 'Dagre geometry',
    websiteUrl: '',
    nodes,
    edges: [
      { id: 'start', source: 'start', target: 'split' },
      { id: 'second', source: 'split', target: 'a-second', sourceHandle: handles[1] },
      { id: 'first', source: 'split', target: 'z-first', sourceHandle: handles[0] },
      { id: 'first-join', source: 'z-first', target: 'join' },
      { id: 'second-join', source: 'a-second', target: 'join' },
    ],
  };
}
