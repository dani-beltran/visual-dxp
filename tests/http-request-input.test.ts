// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataTools } from '../src/lib/data';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import type { RunLog, StepConfig, Workflow } from '../src/lib/types';
import { dataTools as serverDataTools } from '../src/server/ai/workflow/data';
import type { Workflow as ServerWorkflow } from '../src/server/ai/workflow/types';
import { validateWorkflow as validateServerWorkflow } from '../src/server/ai/workflow/validation';

import { insertTransform } from './helpers/data-transform';

const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function workflow(config: StepConfig): Workflow & ServerWorkflow {
  const graph: Workflow & ServerWorkflow = {
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
          config: { url: '/api/first' },
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
          config: { selector: '#result', value: '{{$}}' },
        },
      },
    ],
    edges: [
      { id: 'start-first', source: 'start', target: 'first' },
      { id: 'first-second', source: 'first', target: 'second' },
      { id: 'second-result', source: 'second', target: 'result' },
    ],
  };
  insertTransform(graph, 'first-second', { dataPath: 'data' });
  return graph;
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
    });
    insertTransform(graph, 'second-result', { dataPath: 'receipt' });
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

describe.each(['direct', 'exported'] as const)('%s HTTP header templates', (mode) => {
  it.each(['GET', 'HEAD', 'POST'])(
    'resolves header variables as strings, preserving escaped and literal data for %s',
    async (method) => {
      const graph = workflow({
        url: '/api/second',
        method,
        headers: JSON.stringify({
          Authorization: 'Bearer {{token}}',
          'X-User': '{{user.name}} / {{user.name}}',
          'X-Item': '{{items[0].id}}',
          'X-Values': '{{zero}}|{{disabled}}|{{empty}}|{{nil}}|{{payload}}',
          'X-{{headerName}}': 'static',
        }),
      });
      graph.edges = graph.edges.filter((edge) => edge.id !== 'second-result');
      const token = 'quoted"\\token{{missing}}';
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                token,
                user: { name: 'Ada' },
                items: [{ id: 42 }],
                zero: 0,
                disabled: false,
                empty: '',
                nil: null,
                payload: { id: 7 },
                headerName: 'Custom',
              },
            }),
          ),
        )
        .mockResolvedValueOnce(new Response('{}'));
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
      expect(fetcher.mock.calls[1][1]).toMatchObject({
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User': 'Ada / Ada',
          'X-Item': '42',
          'X-Values': '0|false||null|{"id":7}',
          'X-Custom': 'static',
        },
      });
    },
  );
});

it.each([
  { url: '/api/{{missing}}' },
  { url: '/api/second', method: 'POST', body: '{{missing}}' },
  { url: '/api/second', headers: '{"Authorization":"Bearer {{missing}}"}' },
  { url: '/api/second', headers: '{"X-Id":"{{items[-1]}}"}' },
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
  graph.edges = graph.edges.filter((edge) => edge.id !== 'second-result');
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
  { url: '/api/second', headers: '{"Authorization":"Bearer {{token}}"}' },
])('accepts dynamic URLs without requiring input data at validation time: %j', (config) => {
  const graph = workflow(config);
  expect(validateWorkflow(graph)).toEqual([]);
  expect(validateServerWorkflow(graph)).toEqual([]);
});

it.each([
  { url: '/api/{{items[-1]}}' },
  { url: '/api/{{id}' },
  { url: '/api/second', method: 'POST', body: '{"id":{{}}}' },
  { url: '/api/second', headers: '{"X-Id":"{{items[-1]}}"}' },
  { url: '/api/second', method: 'HEAD', headers: '{"X-Id":"{{id}"}' },
  { url: '/api/second', headers: '{"X-Id":"{{}}"}' },
])('validates templates in both workflow validators: %j', (config) => {
  for (const validate of [validateWorkflow, validateServerWorkflow])
    expect(validate(workflow(config))).toContainEqual(
      expect.objectContaining({ nodeId: 'second' }),
    );
});

it.each(['direct', 'exported'] as const)(
  'uses Data Transform nodes before HTTP and element templates (%s)',
  async (mode) => {
    document.body.innerHTML = '<button id="start">Start</button><p id="result"></p>';
    const original = workflow({
      url: '/api/users/{{id}}',
      method: 'POST',
      headers: '{"X-User-Id":"{{id}}"}',
      body: '{"name":"{{name}}"}',
    });
    insertTransform(original, 'first-second-transform-out', { dataPath: 'user' });
    insertTransform(original, 'second-result', { dataPath: 'receipt' });
    original.nodes[3].data.config = { selector: '#result', value: 'Saved {{name}}' };
    const graph = original;
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
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ 'X-User-Id': '42' });
    expect(document.querySelector('#result')?.textContent).toBe('Saved Ada');
  },
);
