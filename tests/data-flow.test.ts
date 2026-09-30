// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function node(id: string, kind: WorkflowNode['data']['kind'], config: StepConfig): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function graph(response: StepConfig = {}, condition: StepConfig = {}): Workflow {
  return {
    version: 1,
    name: 'Response data',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#start' }),
      node('http', 'http', { url: 'https://api.example.com', ...response }),
      node('pass', 'dom', { selector: '#result', value: 'waiting' }),
      node('condition', 'fork', {
        conditionType: 'data',
        conditionOperator: 'greater-than',
        conditionValue: '10',
        ...condition,
      }),
      node('yes', 'dom', { selector: '#result', value: 'yes' }),
      node('no', 'dom', { selector: '#result', value: 'no' }),
    ],
    edges: [
      { id: 'a', source: 'start', target: 'http' },
      { id: 'b', source: 'http', target: 'pass' },
      { id: 'c', source: 'pass', target: 'condition' },
      { id: 'd', source: 'condition', target: 'yes', sourceHandle: 'true' },
      { id: 'e', source: 'condition', target: 'no', sourceHandle: 'false' },
    ],
  };
}
const instances: ReturnType<typeof createRuntime>[] = [];
beforeEach(() => {
  document.body.innerHTML = '<button id="start">Run</button><p id="result">waiting</p>';
});
afterEach(() => {
  for (const runtime of instances.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
});

it.each(['direct', 'exported'] as const)(
  'routes complete bodies and nested selections in the %s runtime',
  async (mode) => {
    for (const selected of [false, true]) {
      for (const price of [12, 4]) {
        const workflow = graph(
          selected ? { responseDataPath: 'data.items[0].price' } : {},
          selected ? {} : { conditionDataPath: 'data.items[0].price' },
        );
        const fetcher = vi
          .spyOn(globalThis, 'fetch')
          .mockImplementation(
            async () => new Response(JSON.stringify({ data: { items: [{ price }] } })),
          );
        let runtime: ReturnType<typeof createRuntime>;
        if (mode === 'direct') runtime = createRuntime(workflow, { fetch: fetcher });
        else {
          new Function('window', 'document', exportWorkflow(workflow))(window, document);
          runtime = (window as Window & { dlbDXP?: ReturnType<typeof createRuntime> }).dlbDXP!;
        }
        instances.push(runtime);
        await runtime.run();
        expect(document.querySelector('#result')!.textContent).toBe(price > 10 ? 'yes' : 'no');
        runtime.destroy();
        fetcher.mockRestore();
      }
    }
  },
);

it.each([
  ['null', { responseDataPath: '' }, { conditionOperator: 'is-null' }, 'yes'],
  ['{}', { responseDataPath: 'missing' }, { conditionOperator: 'not-exists' }, 'yes'],
  ['{}', { responseDataPath: 'missing' }, { conditionOperator: 'exists' }, 'no'],
  ['{}', { responseDataPath: 'missing' }, { conditionOperator: 'is-null' }, 'no'],
  ['{"item":null}', { responseDataPath: 'item' }, { conditionOperator: 'exists' }, 'yes'],
  ['{}', {}, { conditionDataPath: 'item', conditionOperator: 'not-exists' }, 'yes'],
  [
    'plain text',
    { responseDataPath: 'item' },
    { conditionOperator: 'equal', conditionValue: 'plain text' },
    'yes',
  ],
  ['{"item":12}', { responseDataPath: 'item' }, {}, 'yes'],
  ['false', {}, { conditionOperator: 'is-false' }, 'yes'],
  ['0', {}, { conditionOperator: 'is-empty' }, 'no'],
] as [string, StepConfig, StepConfig, string][])(
  'propagates %s with %j',
  async (body, response, condition, expected) => {
    const runtime = createRuntime(graph(response, condition), {
      fetch: vi.fn<typeof fetch>().mockImplementation(async () => new Response(body)),
    });
    instances.push(runtime);
    await runtime.run();
    expect(document.querySelector('#result')!.textContent).toBe(expected);
  },
);

it.each([
  ['{}', { responseDataPath: 'items[' }, {}, 'http', 'Invalid data path'],
  [
    '"text"',
    {},
    { conditionOperator: 'matches', conditionValue: '[' },
    'condition',
    'Invalid regular expression',
  ],
  ['{}', {}, { conditionDataPath: 'missing' }, 'condition', 'could not be resolved'],
  [
    'false',
    {},
    { conditionOperator: 'contains', conditionValue: 'false' },
    'condition',
    'not supported',
  ],
] as [string, StepConfig, StepConfig, string, string][])(
  'logs errors at the failing node for %s %j %j',
  async (body, response, condition, nodeId, error) => {
    const logs: RunLog[] = [];
    const runtime = createRuntime(graph(response, condition), {
      fetch: vi.fn<typeof fetch>().mockImplementation(async () => new Response(body)),
      onLog: (entry) => logs.push(entry),
    });
    instances.push(runtime);
    await expect(runtime.run()).rejects.toThrow(error);
    expect(logs).toContainEqual(
      expect.objectContaining({ nodeId, status: 'error', message: expect.stringContaining(error) }),
    );
    expect(logs.some((entry) => ['yes', 'no'].includes(entry.nodeId))).toBe(false);
  },
);

it('retains data configuration through JSON saving/reloading and AI request/operation contracts', () => {
  const workflow = graph(
    { responseDataPath: 'data.items[0].price' },
    { conditionOperator: 'less-than-or-equal', conditionDataPath: '', conditionValue: '12' },
  );
  const saved: unknown = JSON.parse(JSON.stringify(workflow));
  expect(isWorkflow(saved)).toBe(true);
  if (!isWorkflow(saved)) throw new Error('Invalid saved workflow');
  expect(validateWorkflow(saved)).toEqual([]);
  expect(
    parseAIChatRequest({
      workflow: saved,
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [],
    }).workflow.nodes,
  ).toEqual(saved.nodes);
  const operations = saved.nodes.map((entry) => ({
    type: 'update_node',
    id: entry.id,
    config: entry.data.config,
  }));
  const response = parseAIChatResponse({ message: 'Updated', operations });
  expect(applyWorkflowOperations(saved, response.operations).nodes).toEqual(saved.nodes);
});

it('isolates incoming data between sibling paths and concurrent runs', async () => {
  const workflow = graph({}, { conditionOperator: 'equal', conditionValue: '1' });
  workflow.nodes.push(node('other-http', 'http', { url: 'https://api.example.com/other' }));
  workflow.edges.splice(1, 0, { id: 'sibling', source: 'http', target: 'other-http' });
  let calls = 0;
  const results: string[] = [];
  const runtime = createRuntime(workflow, {
    fetch: vi
      .fn<typeof fetch>()
      .mockImplementation(
        async (url) => new Response(String(String(url).endsWith('/other') ? 99 : ++calls)),
      ),
    onLog: (entry) => {
      if (entry.nodeId === 'condition' && entry.status === 'success') results.push(entry.message);
    },
  });
  instances.push(runtime);
  await Promise.all([runtime.run(), runtime.run()]);
  expect(results.sort()).toEqual(['Condition is false', 'Condition is true']);
});

it('starts each invocation without stale response data', async () => {
  const workflow = graph({}, { conditionOperator: 'not-exists' });
  workflow.nodes.push(node('empty', 'trigger', { event: 'click', selector: '#start' }));
  workflow.edges.push({ id: 'empty-condition', source: 'empty', target: 'condition' });
  const runtime = createRuntime(workflow, {
    fetch: vi.fn<typeof fetch>().mockImplementation(async () => new Response('null')),
  });
  instances.push(runtime);
  await runtime.run('start');
  expect(document.querySelector('#result')!.textContent).toBe('no');
  await runtime.run('empty');
  expect(document.querySelector('#result')!.textContent).toBe('yes');
});

it('continues an exported flow with undefined output from a missing response path', async () => {
  const workflow = graph(
    { responseDataPath: 'items[2].price' },
    { conditionOperator: 'not-exists' },
  );
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"items":[]}'));
  new Function('window', 'document', exportWorkflow(workflow))(window, document);
  const runtime = (window as Window & { dlbDXP?: ReturnType<typeof createRuntime> }).dlbDXP;
  if (!runtime) throw new Error('Expected exported runtime');
  instances.push(runtime);
  await runtime.run();
  expect(document.querySelector('#result')?.textContent).toBe('yes');
});
