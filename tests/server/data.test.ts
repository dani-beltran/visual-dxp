import { expect, it } from 'vitest';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
} from '../../src/server/ai/workflow/ai';
import type { StepConfig, Workflow } from '../../src/server/ai/workflow/types';
import { validateWorkflow } from '../../src/server/ai/workflow/validation';

const base: Workflow = {
  version: 1,
  name: 'Data',
  websiteUrl: 'https://example.com',
  nodes: [
    {
      id: 'start',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind: 'trigger', label: 'Start', config: {} },
    },
  ],
  edges: [],
};
const cases: ['http' | 'fork' | 'dom' | 'transform', StepConfig][] = [
  ['dom', { selector: '#{{id}}', action: 'text', value: 'Hello {{name}}' }],
  [
    'dom',
    { selector: '#result', action: 'attribute', attribute: 'data-{{key}}', value: '{{value}}' },
  ],
  ['dom', { selector: '#{{id}}', action: 'hide' }],
  [
    'dom',
    {
      selector: '#result',
      action: 'text',
      value: '{{user.name}}',
    },
  ],
  [
    'dom',
    {
      selector: '#result',
      action: 'attribute',
      attribute: 'data-price',
      value: '{{$}}',
    },
  ],
  ['transform', { dataPath: 'items[0].price' }],
  ['transform', { dataPath: '' }],
  [
    'http',
    {
      url: 'https://example.com:{{port}}/users/{{user.id}}',
      method: 'POST',
      body: '{"name":"{{user.name}}"}',
    },
  ],
  [
    'fork',
    {
      conditionType: 'data',
      conditionOperator: 'greater-than',
      conditionValue: '12',
    },
  ],
  ['fork', { conditionType: 'data', conditionOperator: 'exists' }],
  ['fork', { conditionType: 'data', conditionOperator: 'matches', conditionValue: '^premium' }],
];
it.each(cases)('retains %s config through tools and transport', async (kind, config) => {
  const toolkit = createWorkflowTools(base, []);
  const add = toolkit.tools.find((tool) => tool.name === 'add_node')!;
  const result = JSON.parse(await add.invoke({ kind, config }));
  expect(result.ok).toBe(true);
  const workflow = toolkit.getWorkflow();
  expect(workflow.nodes.at(-1)!.data.config).toMatchObject(config);
  expect(validateWorkflow(workflow)).toEqual([]);
  const request = parseAIChatRequest({
    workflow,
    messages: [{ role: 'user', content: 'Edit' }],
    selectedNodeIds: [],
  });
  expect(request.workflow.nodes.at(-1)!.data.config).toMatchObject(config);
  const response = parseAIChatResponse({ message: 'Added', operations: toolkit.getOperations() });
  expect(
    applyWorkflowOperations(base, response.operations).nodes.at(-1)!.data.config,
  ).toMatchObject(config);
});

it('preserves historical inactive DOM values but rejects new AI writes to them', () => {
  const config: StepConfig = { selector: '#result', action: 'hide', value: '{{ignored[}}' };
  const workflow: Workflow = {
    ...base,
    nodes: [
      ...base.nodes,
      {
        id: 'hidden',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: { kind: 'dom', label: 'Hidden', config },
      },
    ],
  };
  expect(validateWorkflow(workflow)).toEqual([]);
  const parsed = parseAIChatRequest({
    workflow,
    messages: [{ role: 'user', content: 'Rename' }],
    selectedNodeIds: [],
  });
  const toolkit = createWorkflowTools(parsed.workflow, []);
  expect(
    JSON.parse(toolkit.invokePrivate('update_node', { id: 'hidden', label: 'Renamed' })).ok,
  ).toBe(true);
  expect(toolkit.getWorkflow().nodes[1].data.config).toEqual(config);
  expect(
    JSON.parse(toolkit.invokePrivate('update_node', { id: 'hidden', config: { value: 'New' } })),
  ).toMatchObject({ ok: false });
  expect(toolkit.getOperations()).toHaveLength(1);
});

it.each([
  ['dom', { selector: '#result', value: '{{name' }],
  ['dom', { selector: '#result', value: '{{name()}}' }],
  ['dom', { selector: '#{{ }}', action: 'hide' }],
  ['dom', { selector: '#result', value: '{{items[}}' }],
  ['transform', { dataPath: 'items[' }],
  ['fork', { conditionType: 'data', conditionOperator: 'matches', conditionValue: '[' }],
  ['fork', { conditionType: 'data', conditionOperator: 'not-matches', conditionValue: '(' }],
  ['transform', { dataPath: 'items[-1]' }],
  ['fork', { conditionType: 'data', conditionOperator: 'unsupported' }],
  ['fork', { conditionType: 'data', conditionOperator: 'equal' }],
])('validates invalid %s configs', (kind, config) => {
  const workflow = {
    ...base,
    nodes: [
      ...base.nodes,
      {
        id: 'invalid',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind, label: 'Invalid', config },
      },
    ],
  } as Workflow;
  expect(validateWorkflow(workflow).some((issue) => issue.nodeId === 'invalid')).toBe(true);
});
