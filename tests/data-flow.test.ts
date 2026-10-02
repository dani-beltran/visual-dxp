// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

import { insertTransform } from './helpers/data-transform';

function node(id: string, kind: WorkflowNode['data']['kind'], config: StepConfig): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function graph(response: StepConfig = {}, condition: StepConfig = {}): Workflow {
  const workflow: Workflow = {
    version: 1,
    name: 'Response data',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#start' }),
      node('http', 'http', { url: 'https://api.example.com' }),
      node('pass', 'dom', { selector: '#result', value: 'waiting' }),
      node('condition', 'fork', {
        conditionType: 'data',
        conditionOperator: 'greater-than',
        conditionValue: '10',
        ...condition,
        dataPath: undefined,
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
  if (response.dataPath !== undefined) insertTransform(workflow, 'b', response);
  if (condition.dataPath !== undefined)
    insertTransform(workflow, 'c', { dataPath: condition.dataPath });
  return workflow;
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
  'passes request errors as data and routes downstream conditions in the %s runtime',
  async (mode) => {
    const failures = [
      {
        fetch: async () => new Response('Unavailable', { status: 503, statusText: 'Unavailable' }),
        code: 503,
        message: 'Request failed: HTTP 503 Unavailable.',
      },
      {
        fetch: async () => new Response('Missing', { status: 404 }),
        code: 404,
        message: 'Request failed: HTTP 404.',
      },
      {
        fetch: async () => {
          throw new TypeError('Failed to fetch');
        },
        code: 'NETWORK_ERROR',
        message: 'Failed to fetch',
      },
      {
        fetch: async () => {
          const response = new Response('partial');
          vi.spyOn(response, 'text').mockRejectedValue(new Error('Connection lost'));
          return response;
        },
        code: 'NETWORK_ERROR',
        message: 'Connection lost',
      },
    ];
    for (const failure of failures) {
      const workflow = graph(
        {},
        {
          dataPath: 'error.code',
          conditionOperator: 'equal',
          conditionValue: String(failure.code),
        },
      );
      workflow.nodes.find((item) => item.id === 'yes')!.data.config = {
        selector: '#result',
        value: '{{$}}',
      };
      const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(failure.fetch);
      let runtime: ReturnType<typeof createRuntime>;
      if (mode === 'direct') runtime = createRuntime(workflow, { fetch: fetcher });
      else {
        new Function('window', 'document', exportWorkflow(workflow))(window, document);
        runtime = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP!;
      }
      instances.push(runtime);
      await expect(runtime.run()).resolves.toBeUndefined();
      expect(document.querySelector('#result')!.textContent).toBe(String(failure.code));
      runtime.destroy();
      fetcher.mockRestore();
    }
  },
);

it.each(['direct', 'exported'] as const)(
  'routes complete bodies and nested selections in the %s runtime',
  async (mode) => {
    for (const selected of [false, true]) {
      for (const price of [12, 4]) {
        const workflow = graph(
          selected ? { dataPath: 'data.items[0].price' } : {},
          selected ? {} : { dataPath: 'data.items[0].price' },
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
          runtime = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
            .visualDXP!;
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
  ['null', { dataPath: '' }, { conditionOperator: 'is-null' }, 'yes'],
  ['{}', { dataPath: 'missing' }, { conditionOperator: 'not-exists' }, 'yes'],
  ['{}', { dataPath: 'missing' }, { conditionOperator: 'exists' }, 'no'],
  ['{}', { dataPath: 'missing' }, { conditionOperator: 'is-null' }, 'no'],
  ['{"item":null}', { dataPath: 'item' }, { conditionOperator: 'exists' }, 'yes'],
  ['{}', {}, { dataPath: 'item', conditionOperator: 'not-exists' }, 'yes'],
  ['plain text', {}, { conditionOperator: 'equal', conditionValue: 'plain text' }, 'yes'],
  ['{"item":12}', { dataPath: 'item' }, {}, 'yes'],
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
  ['{}', { dataPath: 'items[' }, {}, 'b-transform', 'Invalid data path'],
  [
    '"text"',
    {},
    { conditionOperator: 'matches', conditionValue: '[' },
    'condition',
    'Invalid regular expression',
  ],
  ['{}', {}, { dataPath: 'missing' }, 'condition', 'could not be resolved'],
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
    { dataPath: 'data.items[0].price' },
    { conditionOperator: 'less-than-or-equal', dataPath: '', conditionValue: '12' },
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

it('continues an exported flow with undefined output from a missing transform path', async () => {
  const workflow = graph({ dataPath: 'items[2].price' }, { conditionOperator: 'not-exists' });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"items":[]}'));
  new Function('window', 'document', exportWorkflow(workflow))(window, document);
  const runtime = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP;
  if (!runtime) throw new Error('Expected exported runtime');
  instances.push(runtime);
  await runtime.run();
  expect(document.querySelector('#result')?.textContent).toBe('yes');
});

it.each(['direct', 'exported'] as const)(
  'uses HTTP values for every element action in the %s runtime',
  async (mode) => {
    const cases: [StepConfig['action'], unknown, string][] = [
      ['text', 'Ada', 'Ada'],
      ['text', 0, '0'],
      ['text', false, 'false'],
      ['text', { name: 'Ada' }, '{"name":"Ada"}'],
      ['text', [1, 2], '[1,2]'],
      ['text', null, ''],
      ['text', undefined, ''],
      ['html', '<b>Ada</b>', '<b>Ada</b>'],
      ['attribute', 42, '42'],
      ['add-class', 'active premium', 'base active premium'],
      ['add-class', ['active', 'premium'], 'base active premium'],
      ['remove-class', ['active', 'premium'], 'base'],
    ];
    for (const selectedBeforeElement of [false, true]) {
      for (const [action, value, expected] of cases) {
        document.querySelector('#target')?.remove();
        const target = document.createElement('div');
        target.id = 'target';
        target.className = action === 'remove-class' ? 'base active premium' : 'base';
        target.textContent = 'before';
        document.body.appendChild(target);
        const workflow = graph(selectedBeforeElement ? { dataPath: 'item' } : {}, {
          conditionOperator: 'not-exists',
          dataPath: selectedBeforeElement ? '' : 'item',
        });
        workflow.nodes[2].data.config = {
          selector: '#target',
          action,
          attribute: 'data-value',
          value: selectedBeforeElement ? '{{$}}' : '{{item}}',
        };
        vi.spyOn(globalThis, 'fetch').mockImplementation(
          async () => new Response(JSON.stringify({ item: value })),
        );
        let runtime: ReturnType<typeof createRuntime>;
        if (mode === 'direct') runtime = createRuntime(workflow);
        else {
          new Function('window', 'document', exportWorkflow(workflow))(window, document);
          const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
            .visualDXP;
          if (!exported) throw new Error('Expected exported runtime');
          runtime = exported;
        }
        instances.push(runtime);
        await runtime.run();
        const actual =
          action === 'attribute'
            ? target.getAttribute('data-value')
            : action?.includes('class')
              ? target.className
              : action === 'html'
                ? target.innerHTML
                : target.textContent;
        expect(actual).toBe(expected);
        // The element action must forward the original data, including missingness.
        expect(document.querySelector('#result')?.textContent).toBe(
          value === undefined ? 'yes' : 'no',
        );
        runtime.destroy();
        vi.restoreAllMocks();
      }
    }
  },
);

it('preserves incoming element settings across save/reload and AI edits', () => {
  const workflow = graph();
  const config: StepConfig = {
    selector: '#result',
    action: 'text',
    value: '{{items[0].name}}',
  };
  workflow.nodes[2].data.config = config;
  const saved = JSON.parse(JSON.stringify(workflow));
  expect(isWorkflow(saved)).toBe(true);
  expect(validateWorkflow(saved)).toEqual([]);
  const parsed = parseAIChatRequest({
    workflow: saved,
    messages: [{ role: 'user', content: 'Edit' }],
    selectedNodeIds: [],
  });
  expect(parsed.workflow.nodes[2].data.config).toEqual(config);
  const response = parseAIChatResponse({
    message: 'Updated',
    operations: [{ type: 'update_node', id: 'pass', config }],
  });
  expect(applyWorkflowOperations(saved, response.operations).nodes[2].data.config).toEqual(config);
});

it('keeps manual values and hide/show independent of incoming-data settings', async () => {
  for (const config of [
    { value: 'manual' },
    { action: 'hide', value: '{{ignored[}}' },
    { action: 'show', value: '{{ignored[}}' },
  ] as StepConfig[]) {
    const workflow = graph({}, { conditionOperator: 'exists' });
    workflow.nodes[2].data.config = { selector: '#result', ...config };
    // Stop after Update element so its content and visibility can be inspected.
    workflow.edges = workflow.edges.slice(0, 2);
    expect(validateWorkflow(workflow)).toEqual([]);
    const runtime = createRuntime(workflow, {
      fetch: vi.fn<typeof fetch>().mockImplementation(async () => new Response('null')),
    });
    instances.push(runtime);
    await runtime.run();
    const target = document.querySelector<HTMLElement>('#result');
    if (config.action === 'hide') expect(target?.style.display).toBe('none');
    else if (config.action === 'show') expect(target?.style.display).not.toBe('none');
    else expect(target?.textContent).toBe('manual');
  }
});

it('validates incoming element paths and rejects unsupported CSS class data before mutation', async () => {
  const workflow = graph();
  workflow.nodes[2].data.config = {
    selector: '#result',
    action: 'text',
    value: '{{items[}}',
  };
  expect(validateWorkflow(workflow)).toContainEqual(
    expect.objectContaining({
      nodeId: 'pass',
      message: expect.stringContaining('Invalid data path'),
    }),
  );
  workflow.nodes[2].data.config = {
    selector: '#result',
    action: 'add-class',
    value: '{{$}}',
  };
  const runtime = createRuntime(workflow, {
    fetch: vi.fn<typeof fetch>().mockImplementation(async () => new Response('{"class":"active"}')),
  });
  instances.push(runtime);
  await expect(runtime.run()).rejects.toThrow('Incoming CSS classes');
  expect(document.querySelector('#result')?.className).toBe('');
});
