// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
  workflowFingerprint,
} from '../src/lib/ai';
import { createNode } from '../src/lib/catalog';
import type { ConnectionPreview } from '../src/lib/connectionMapping';
import {
  type DataTransformation,
  dataTransformTools,
  type JsonValue,
} from '../src/lib/dataTransform';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { StepConfig, Workflow, WorkflowNode } from '../src/lib/types';
import {
  parseAIChatRequest as serverRequest,
  parseAIChatResponse as serverResponse,
} from '../src/server/ai/workflow/ai';
import { validateWorkflow as serverValidate } from '../src/server/ai/workflow/validation';

const input = {
  exists: true,
  value: {
    user: { items: [{ name: '  aDA loVELACE  ', nil: null, empty: '', zero: 0, flag: false }] },
  },
};
const path = 'user.items[0].name';
function transform(value: unknown, transformations: DataTransformation[] = []) {
  return dataTransformTools.apply({ exists: true, value }, { transformations });
}
it.each([
  [path, true, '  aDA loVELACE  '],
  ['user.items[0].nil', true, null],
  ['user.items[0].empty', true, ''],
  ['user.items[0].zero', true, 0],
  ['user.items[0].flag', true, false],
  ['user.items[9].name', false, undefined],
  ['user.absent', false, undefined],
])('extracts %s and preserves missingness and types', (dataPath, exists, value) => {
  expect(dataTransformTools.apply(input, { dataPath: dataPath as string })).toEqual({
    exists,
    value,
  });
});
it('extracts root arrays and whole objects without transformations or coercion', () => {
  expect(
    dataTransformTools.apply(
      { exists: true, value: ['a', { title: 'b' }] },
      { dataPath: '[1].title' },
    ).value,
  ).toBe('b');
  expect(dataTransformTools.apply(input, { dataPath: '' })).toEqual(input);
  expect(dataTransformTools.apply({ exists: false, value: undefined }, {})).toEqual({
    exists: false,
    value: undefined,
  });
  expect(() => dataTransformTools.apply(input, { dataPath: 'user.items[-1]' })).toThrow(
    'Invalid data path',
  );
  expect(
    dataTransformTools.apply({ exists: true, value: {} }, { dataPath: 'constructor' }).exists,
  ).toBe(false);
});
it.each([
  ['capitalize', 'hELLO WORLD', 'Hello world'],
  ['lowercase', 'HeLLo', 'hello'],
  ['uppercase', 'HeLLo', 'HELLO'],
  ['title-case', 'hELLO wORLD éLÈVE', 'Hello World Élève'],
  ['trim', '\t hello \n', 'hello'],
] as const)('applies %s', (type, value, expected) =>
  expect(transform(value, [{ type }]).value).toBe(expected),
);
it('uses literal prefixes, suffixes, and all find/replace matches', () => {
  expect(
    transform('a.b a.b', [
      { type: 'replace', find: 'a.b', replacement: '$1' },
      { type: 'prefix', value: '<' },
      { type: 'suffix', value: '>' },
    ]).value,
  ).toBe('<$1 $1>');
  expect(() => transform('text', [{ type: 'replace', find: '', replacement: 'x' }])).toThrow(
    'nonempty text to find',
  );
});
it('runs operations in configured order', () => {
  expect(
    transform('  alice  ', [
      { type: 'trim' },
      { type: 'prefix', value: 'Hi ' },
      { type: 'uppercase' },
    ]).value,
  ).toBe('HI ALICE');
  expect(
    transform('  alice  ', [
      { type: 'uppercase' },
      { type: 'prefix', value: 'Hi ' },
      { type: 'trim' },
    ]).value,
  ).toBe('Hi   ALICE');
});
it.each([null, '', false, 0, { name: 'Ada' }, ['Ada']] satisfies JsonValue[])(
  'supports typed fallback %j only for missing or null',
  (value) => {
    for (const source of [
      { exists: false, value: undefined },
      { exists: true, value: null },
    ])
      expect(
        dataTransformTools.apply(source, { transformations: [{ type: 'fallback', value }] }),
      ).toEqual({ exists: true, value });
    for (const actual of ['', false, 0])
      expect(transform(actual, [{ type: 'fallback', value }]).value).toBe(actual);
  },
);
it('requires a fallback before text operations for missing and null values', () => {
  const operations: DataTransformation[] = [
    { type: 'fallback', value: '  aDA  ' },
    { type: 'trim' },
    { type: 'capitalize' },
  ];
  expect(
    dataTransformTools.apply(input, { dataPath: 'absent', transformations: operations }),
  ).toEqual({ exists: true, value: 'Ada' });
  expect(() =>
    dataTransformTools.apply(input, {
      dataPath: 'absent',
      transformations: [...operations].reverse(),
    }),
  ).toThrow('received missing data');
  expect(() => transform(null, [{ type: 'trim' }])).toThrow('received null');
});
it.each([42, true, {}, [], null])(
  'rejects incompatible text input %j without coercion',
  (value) => {
    expect(() => transform(value, [{ type: 'uppercase' }])).toThrow('requires text');
  },
);
it('validates malformed transforms and non-JSON fallback values', () => {
  for (const transformations of [
    null,
    [{}],
    [{ type: 'unsupported' }],
    [{ type: 'prefix', value: 2 }],
    [{ type: 'fallback', value: undefined }],
    [{ type: 'fallback', value: Infinity }],
  ])
    expect(() =>
      dataTransformTools.validate({ transformations: transformations as never }),
    ).toThrow();
});
function node(id: string, kind: WorkflowNode['data']['kind'], config: StepConfig): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function graph(): Workflow {
  document.body.innerHTML = '<button id="run"></button><p id="a"></p><p id="b"></p>';
  return {
    version: 1,
    name: 'Transforms',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#run' }),
      node('http', 'http', { url: 'https://example.com/data' }),
      node('transform', 'transform', {
        dataPath: path,
        transformations: [
          { type: 'trim' },
          { type: 'title-case' },
          { type: 'prefix', value: 'Hi ' },
        ],
      }),
      node('a', 'dom', { selector: '#a', value: '{{$}}' }),
      node('b', 'dom', { selector: '#b', value: '{{$}}' }),
    ],
    edges: [
      { id: 'start-http', source: 'start', target: 'http' },
      { id: 'http-transform', source: 'http', target: 'transform' },
      { id: 'transform-a', source: 'transform', target: 'a' },
      { id: 'a-b', source: 'a', target: 'b' },
    ],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
});
async function execute(
  workflow: Workflow,
  body: string,
  mode: 'direct' | 'exported',
  status = 200,
) {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(body, { status }));
  const samples: Record<string, ConnectionPreview> = {};
  let runtime: ReturnType<typeof createRuntime>;
  if (mode === 'direct')
    runtime = createRuntime(workflow, {
      fetch: fetcher,
      onConnectionPreview: (id, sample) => {
        samples[id] = sample;
      },
    });
  else {
    new Function('window', 'document', exportWorkflow(workflow))(window, document);
    runtime = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP!;
  }
  runtimes.push(runtime);
  await runtime.run();
  return samples;
}
it.each(['direct', 'exported'] as const)(
  'passes transformed output downstream (%s)',
  async (mode) => {
    const workflow = graph();
    expect(validateWorkflow(workflow)).toEqual([]);
    expect(
      serverValidate(
        serverRequest({
          workflow,
          messages: [{ role: 'user', content: 'Validate' }],
          selectedNodeIds: [],
        }).workflow,
      ),
    ).toEqual([]);
    const samples = await execute(workflow, JSON.stringify(input.value), mode);
    expect(document.querySelector('#a')?.textContent).toBe('Hi Ada Lovelace');
    expect(document.querySelector('#b')?.textContent).toBe('Hi Ada Lovelace');
    if (mode === 'direct')
      expect(samples['transform-a'].source).toEqual({ exists: true, value: 'Hi Ada Lovelace' });
  },
);
it.each(['direct', 'exported'] as const)(
  'keeps missing/null/empty distinct through a downstream condition (%s)',
  async (mode) => {
    for (const [dataPath, conditionOperator, expected] of [
      ['missing', 'not-exists', true],
      ['nil', 'is-null', true],
      ['empty', 'is-empty', true],
      ['nil', 'not-exists', false],
      ['empty', 'is-null', false],
    ] as const) {
      const workflow = graph();
      workflow.nodes[2].data.config = { dataPath, transformations: [] };
      workflow.nodes[3] = node('a', 'fork', { conditionType: 'data', conditionOperator });
      workflow.edges[3].sourceHandle = 'true';
      workflow.nodes[4].data.config.value = 'yes';
      await execute(workflow, '{"nil":null,"empty":""}', mode);
      expect(document.querySelector('#b')?.textContent).toBe(expected ? 'yes' : '');
    }
  },
);
it.each(['direct', 'exported'] as const)(
  'keeps independent sibling selections and HTTP request input (%s)',
  async (mode) => {
    const workflow = graph();
    workflow.nodes.push(node('other', 'transform', { dataPath: 'user.items[0].zero' }));
    workflow.edges = workflow.edges.filter((edge) => edge.id !== 'a-b');
    workflow.edges.push(
      { id: 'other', source: 'http', target: 'other' },
      { id: 'other-b', source: 'other', target: 'b' },
    );
    await execute(workflow, JSON.stringify(input.value), mode);
    expect(document.querySelector('#a')?.textContent).toBe('Hi Ada Lovelace');
    expect(document.querySelector('#b')?.textContent).toBe('0');
  },
);
it('stops downstream execution on incompatible input and logs the failing node', async () => {
  const workflow = graph();
  const logs: { nodeId: string; status: string; message: string }[] = [];
  const runtime = createRuntime(workflow, {
    fetch: vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"user":{"items":[{"name":42}]}}')),
    onLog: (log) => logs.push(log),
  });
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow('requires text');
  expect(logs).toContainEqual(
    expect.objectContaining({
      nodeId: 'transform',
      status: 'error',
      message: expect.stringContaining('number'),
    }),
  );
  expect(logs.some((log) => log.nodeId === 'a')).toBe(false);
});
it('persists configuration across JSON, AI contracts and fingerprints', () => {
  const workflow = graph();
  workflow.nodes[2].data.config.transformations!.unshift({ type: 'fallback', value: 'Ada' });
  const saved: unknown = JSON.parse(JSON.stringify(workflow));
  expect(isWorkflow(saved)).toBe(true);
  for (const parse of [parseAIChatRequest, serverRequest])
    expect(
      parse({ workflow: saved, messages: [{ role: 'user', content: 'Edit' }], selectedNodeIds: [] })
        .workflow.nodes[2].data.config,
    ).toEqual(workflow.nodes[2].data.config);
  const config: StepConfig = {
    dataPath: 'name',
    transformations: [
      { type: 'fallback', value: null },
      { type: 'prefix', value: 'Hi ' },
      { type: 'replace', find: 'a', replacement: 'b' },
    ],
  };
  for (const parse of [parseAIChatResponse, serverResponse])
    expect(
      parse({ message: 'Updated', operations: [{ type: 'update_node', id: 'transform', config }] })
        .operations[0],
    ).toMatchObject({ config });
  const updated = applyWorkflowOperations(workflow, [
    { type: 'update_node', id: 'transform', config },
  ]);
  expect(workflowFingerprint(updated)).not.toBe(workflowFingerprint(workflow));
  expect(
    isWorkflow({
      ...workflow,
      nodes: [
        node('invalid', 'transform', {
          transformations: [{ type: 'fallback', value: undefined }] as never,
        }),
      ],
    }),
  ).toBe(false);
  expect(
    isWorkflow({
      ...workflow,
      nodes: [
        node('draft', 'transform', {
          transformations: [{ type: 'replace', find: '', replacement: '' }],
        }),
      ],
      edges: [],
    }),
  ).toBe(true);
  expect(createNode('transform').data.config).toEqual({ dataPath: '', transformations: [] });
});

it.each(['direct', 'exported'] as const)(
  'makes extracted objects available to downstream HTTP templates (%s)',
  async (mode) => {
    const workflow = graph();
    workflow.nodes[2].data.config = { dataPath: 'auth', transformations: [] };
    workflow.nodes[3] = node('a', 'http', {
      url: 'https://example.com/users/{{id}}',
      method: 'POST',
      headers: '{"Authorization":"Bearer {{token}}"}',
      body: '{"name":"{{name}}"}',
    });
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (url) =>
          new Response(
            String(url).endsWith('/data')
              ? '{"auth":{"id":42,"token":"secret","name":"Ada"}}'
              : '"saved"',
          ),
      );
    let runtime: ReturnType<typeof createRuntime>;
    if (mode === 'direct') runtime = createRuntime(workflow);
    else {
      new Function('window', 'document', exportWorkflow(workflow))(window, document);
      const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
        .visualDXP;
      if (!exported) throw new Error('Missing exported runtime');
      runtime = exported;
    }
    runtimes.push(runtime);
    await runtime.run();
    expect(fetcher.mock.calls[1]).toEqual([
      'https://example.com/users/42',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
        body: '{"name":"Ada"}',
      }),
    ]);
    expect(document.querySelector('#b')?.textContent).toBe('saved');
  },
);
it('keeps transformations isolated between overlapping invocations', async () => {
  const workflow = graph();
  const results: unknown[] = [];
  let count = 0;
  const runtime = createRuntime(workflow, {
    fetch: vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ user: { items: [{ name: ++count === 1 ? 'ada' : 'grace' }] } }),
          ),
      ),
    onConnectionPreview: (id, sample) => {
      if (id === 'transform-a') results.push(sample.source.value);
    },
  });
  runtimes.push(runtime);
  await Promise.all([runtime.run(), runtime.run()]);
  expect(results.sort()).toEqual(['Hi Ada', 'Hi Grace']);
});
it('treats an undefined field as missing and title-cases words with apostrophes', () => {
  expect(
    dataTransformTools.apply({ exists: true, value: { name: undefined } }, { dataPath: 'name' }),
  ).toEqual({ exists: false, value: undefined });
  expect(transform("DON'T STOP – ÉLÈVE", [{ type: 'title-case' }]).value).toBe(
    "Don't Stop – Élève",
  );
});
