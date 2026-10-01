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
const cases: ['http' | 'fork' | 'dom', StepConfig][] = [
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
      valueSource: 'incoming-data',
      valueDataPath: 'user.name',
    },
  ],
  [
    'dom',
    {
      selector: '#result',
      action: 'attribute',
      attribute: 'data-price',
      valueSource: 'incoming-data',
    },
  ],
  [
    'dom',
    {
      selector: '#result',
      action: 'hide',
      valueSource: 'incoming-data',
      valueDataPath: 'ignored[',
    },
  ],
  ['http', { url: 'https://example.com', responseDataPath: 'items[0].price' }],
  ['http', { url: 'https://example.com', responseDataPath: '' }],
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
      conditionDataPath: 'items[0].price',
      conditionOperator: 'greater-than',
      conditionValue: '12',
    },
  ],
  ['fork', { conditionType: 'data', conditionDataPath: '', conditionOperator: 'exists' }],
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

it.each([
  ['dom', { selector: '#result', value: '{{name' }],
  ['dom', { selector: '#result', value: '{{name()}}' }],
  ['dom', { selector: '#{{ }}', action: 'hide' }],
  ['dom', { selector: '#result', valueSource: 'unknown' }],
  ['dom', { selector: '#result', valueSource: 'incoming-data', valueDataPath: 'items[' }],
  ['http', { url: 'https://example.com', responseDataPath: 'items[' }],
  ['fork', { conditionType: 'data', conditionOperator: 'matches', conditionValue: '[' }],
  ['fork', { conditionType: 'data', conditionOperator: 'not-matches', conditionValue: '(' }],
  ['fork', { conditionType: 'data', conditionOperator: 'exists', conditionDataPath: 'items[-1]' }],
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
