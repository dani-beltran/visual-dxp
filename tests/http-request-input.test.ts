// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateConnectionMappings } from '../src/lib/connectionMapping';
import { dataTools } from '../src/lib/data';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import type { RunLog, StepConfig, Workflow } from '../src/lib/types';
import { dataTools as serverDataTools } from '../src/server/ai/workflow/data';
import type { Workflow as ServerWorkflow } from '../src/server/ai/workflow/types';
import { validateWorkflow as validateServerWorkflow } from '../src/server/ai/workflow/validation';

const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function workflow(config: StepConfig): Workflow & ServerWorkflow {
  return {
    version: 1,
    name: 'Chained requests',
    websiteUrl: window.location.href,
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: { event: 'click', selector: '#start' } },
      },
      {
        id: 'first',
        type: 'workflow',
        position: { x: 200, y: 0 },
        data: {
          kind: 'http',
          label: 'First',
          config: { url: '/api/first', responseDataPath: 'data' },
        },
      },
      {
        id: 'second',
        type: 'workflow',
        position: { x: 400, y: 0 },
        data: { kind: 'http', label: 'Second', config },
      },
      {
        id: 'result',
        type: 'workflow',
        position: { x: 600, y: 0 },
        data: {
          kind: 'dom',
          label: 'Result',
          config: { selector: '#result', valueSource: 'incoming-data' },
        },
      },
    ],
    edges: [
      { id: 'start-first', source: 'start', target: 'first' },
      { id: 'first-second', source: 'first', target: 'second' },
      { id: 'second-result', source: 'second', target: 'result' },
    ],
  };
}

describe.each([
  ['client', dataTools],
  ['server', serverDataTools],
] as const)('%s request templates', (_, tools) => {
  it('resolves repeated, nested and array paths without losing falsy values or re-templating data', () => {
    const input = {
      exists: true,
      value: {
        key: { subKey: { variableName: 'Ada' } },
        items: [{ id: 42 }],
        zero: 0,
        disabled: false,
        empty: '',
        nil: null,
        literal: '{{missing}}',
      },
    };
    expect(
      tools.requestTemplate(
        '/{{ key.subKey.variableName }}/{{items[0].id}}?again={{key.subKey.variableName}}',
        input,
      ),
    ).toBe('/Ada/42?again=Ada');
    expect(
      tools.requestTemplate('{{zero}}|{{disabled}}|{{empty}}|{{nil}}|{{literal}}', input, true),
    ).toBe('0|false||null|{{missing}}');
  });

  it('escapes JSON strings and preserves native values in JSON bodies and whole-value bodies', () => {
    const input = {
      exists: true,
      value: {
        name: 'Ada "quoted"\\path\nnext',
        id: 42,
        enabled: false,
        nil: null,
        payload: { items: [1, 'two'] },
      },
    };
    expect(
      JSON.parse(
        tools.requestTemplate(
          '{"name":"Hello {{name}}", "id":{{id}}, "enabled":{{enabled}}, "nil":{{nil}}, "payload":{{payload}}}',
          input,
          true,
        ),
      ),
    ).toEqual({ ...input.value, name: `Hello ${input.value.name}` });
    expect(JSON.parse(tools.requestTemplate('[{{name}}, {{payload}}]', input, true))).toEqual([
      input.value.name,
      input.value.payload,
    ]);
    expect(tools.requestTemplate('{{payload}}', input, true)).toBe('{"items":[1,"two"]}');
    expect(tools.requestTemplate('{{name}}', input, true)).toBe(input.value.name);
    expect(tools.requestTemplate('{raw: {{name}}}', input, true)).toBe(
      `{raw: ${input.value.name}}`,
    );
  });

  it.each(['{{}}', '{{  }}', '{{user..id}}', '{{items[-1]}}', '{{user.id}', '{{user.{{id}}'])(
    'rejects malformed templates %s',
    (url) => {
      expect(() => tools.validateRequest({ url })).toThrow();
      expect(() => tools.requestTemplate(url, { exists: true, value: {} })).toThrow();
    },
  );

  it.each(['missing', 'constructor', 'toString', 'user.id'])(
    'rejects missing and inherited data at %s',
    (path) => {
      expect(() =>
        tools.requestTemplate(`{{${path}}}`, { exists: true, value: { user: null } }),
      ).toThrow('could not be resolved');
      expect(() =>
        tools.requestTemplate(`{{${path}}}`, { exists: false, value: undefined }),
      ).toThrow('could not be resolved');
    },
  );
});

it.each(['direct', 'exported'] as const)(
  'chains requests using URL/body templates and forwards the second response in the %s runtime',
  async (mode) => {
    document.body.innerHTML = '<button id="start">Start</button><p id="result"></p>';
    const graph = workflow({
      url: '/api/users/{{user.id}}?item={{items[0].id}}',
      method: 'POST',
      headers: '{"Content-Type":"application/json"}',
      body: '{"name":"{{user.name}}", "id":{{user.id}}, "enabled":{{enabled}}}',
      responseDataPath: 'receipt',
    });
    const name = 'Ada "Lovelace"\n{{literal}}';
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { user: { id: 42, name }, items: [{ id: 7 }], enabled: false } }),
        ),
      )
      .mockResolvedValueOnce(new Response('{"receipt":{"saved":true}}'));
    expect(validateWorkflow(graph)).toEqual([]);
    expect(validateServerWorkflow(graph)).toEqual([]);
    let runtime: ReturnType<typeof createRuntime>;
    if (mode === 'direct') runtime = createRuntime(graph);
    else {
      new Function('window', 'document', exportWorkflow(graph))(window, document);
      const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
        .visualDXP;
      if (!exported) throw new Error('Expected exported runtime');
      runtime = exported;
    }
    runtimes.push(runtime);
    await runtime.run();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe(new URL('/api/users/42?item=7', document.baseURI).href);
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual({
      name,
      id: 42,
      enabled: false,
    });
    expect(document.querySelector('#result')?.textContent).toBe('{"saved":true}');
    // A second invocation must use its own response data.
    fetcher
      .mockResolvedValueOnce(
        new Response(
          '{"data":{"user":{"id":99,"name":"Grace"},"items":[{"id":8}],"enabled":true}}',
        ),
      )
      .mockResolvedValueOnce(new Response('{"receipt":"second run"}'));
    await runtime.run();
    expect(fetcher.mock.calls[3][0]).toBe(new URL('/api/users/99?item=8', document.baseURI).href);
    expect(document.querySelector('#result')?.textContent).toBe('second run');
  },
);

it.each([
  { url: '/api/{{missing}}' },
  { url: '/api/second', method: 'POST', body: '{{missing}}' },
  { url: '{{url}}' },
] as StepConfig[])('stops before sending unresolved or non-HTTP requests: %j', async (config) => {
  const logs: RunLog[] = [];
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('{"data":{"url":"javascript:alert(1)"}}'));
  const runtime = createRuntime(workflow(config), {
    fetch: fetcher,
    onLog: (entry) => logs.push(entry),
  });
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(logs).toContainEqual(expect.objectContaining({ nodeId: 'second', status: 'error' }));
});

it.each(['GET', 'HEAD', 'get', 'head'])('ignores unused body templates for %s', async (method) => {
  const graph = workflow({ url: '/api/second', method, body: '{{invalid[' });
  expect(validateWorkflow(graph)).toEqual([]);
  expect(validateServerWorkflow(graph)).toEqual([]);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}'));
  const runtime = createRuntime(graph, { fetch: fetcher });
  runtimes.push(runtime);
  graph.edges.pop();
  await runtime.run();
  expect(fetcher.mock.calls[1][1]).not.toHaveProperty('body');
});

it.each([
  {
    url: 'https://api.example.com:{{port}}/users/{{user.id}}',
    method: 'POST',
    body: '{"id":{{user.id}}}',
  },
  { url: '{{nextUrl}}' },
])('accepts dynamic URLs without requiring input data at validation time: %j', (config) => {
  const graph = workflow(config);
  expect(validateWorkflow(graph)).toEqual([]);
  expect(validateServerWorkflow(graph)).toEqual([]);
});

it.each([
  { url: '/api/{{items[-1]}}' },
  { url: '/api/{{id}' },
  { url: '/api/second', method: 'POST', body: '{"id":{{}}}' },
])('validates templates in both workflow validators: %j', (config) => {
  for (const validate of [validateWorkflow, validateServerWorkflow])
    expect(validate(workflow(config))).toContainEqual(
      expect.objectContaining({ nodeId: 'second' }),
    );
});

it.each(['direct', 'exported'] as const)(
  'uses connection mappings before HTTP and element templates (%s)',
  async (mode) => {
    document.body.innerHTML = '<button id="start">Start</button><p id="result"></p>';
    const original = workflow({
      url: '/api/users/{{id}}',
      method: 'POST',
      body: '{"name":"{{name}}"}',
    });
    original.edges[1].data = { mapping: { sourcePath: 'user', targetInput: 'data' } };
    original.edges[2].data = { mapping: { sourcePath: 'receipt', targetInput: 'value' } };
    original.nodes[3].data.config = { selector: '#result', value: 'Saved {{name}}' };
    const graph = migrateConnectionMappings(original);
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"data":{"user":{"id":42,"name":"Ada"}}}'))
      .mockResolvedValueOnce(new Response('{"receipt":{"name":"Ada"}}'));
    expect(validateWorkflow(graph)).toEqual([]);
    let runtime: ReturnType<typeof createRuntime>;
    if (mode === 'direct') runtime = createRuntime(graph);
    else {
      new Function('window', 'document', exportWorkflow(graph))(window, document);
      const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
        .visualDXP;
      if (!exported) throw new Error('Expected exported runtime');
      runtime = exported;
    }
    runtimes.push(runtime);
    await runtime.run();
    expect(fetcher.mock.calls[1][0]).toBe(new URL('/api/users/42', document.baseURI).href);
    expect(fetcher.mock.calls[1][1]?.body).toBe('{"name":"Ada"}');
    expect(document.querySelector('#result')?.textContent).toBe('Saved Ada');
  },
);
