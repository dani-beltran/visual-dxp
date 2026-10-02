// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop/product"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { createNode } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { NodeKind, RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';
import { validateWorkflow as serverValidate } from '../src/server/ai/workflow/validation';

function graph(config: StepConfig): Workflow {
  const node = (id: string, kind: NodeKind, settings: StepConfig): WorkflowNode => ({
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: settings },
  });
  return {
    version: 1,
    name: 'Set a cookie',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#result' }),
      node('write', 'cookie', config),
      node('check', 'fork', {
        conditionType: 'cookie',
        conditionKey: config.cookieName,
        conditionValue: config.cookieValue,
      }),
      node('yes', 'dom', { selector: '#result', value: 'yes' }),
      node('no', 'dom', { selector: '#result', value: 'no' }),
    ],
    edges: [
      { id: 'start-write', source: 'start', target: 'write' },
      { id: 'write-check', source: 'write', target: 'check' },
      { id: 'check-yes', source: 'check', target: 'yes', sourceHandle: 'true' },
      { id: 'check-no', source: 'check', target: 'no', sourceHandle: 'false' },
    ],
  };
}

function dataGraph(config: StepConfig, name = 'audience', value = ''): Workflow {
  const workflow = graph(config);
  workflow.nodes.push({
    id: 'request',
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind: 'http', label: 'Request', config: { url: 'https://example.com/data' } },
  });
  workflow.nodes[2].data.config = {
    conditionType: 'cookie',
    conditionKey: name,
    conditionValue: value,
  };
  workflow.nodes[3].data.config.value = '{{$}}';
  workflow.edges[0].target = 'request';
  workflow.edges.push({ id: 'request-write', source: 'request', target: 'write' });
  return workflow;
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
const exported = window as Window & { visualDXP?: ReturnType<typeof createRuntime> };
const valid: StepConfig[] = [
  { cookieName: 'audience', cookieValue: 'returning' },
  { cookieName: 'audience', cookieValue: '', cookieDays: 0 },
  {
    cookieName: 'campaign%code',
    cookieValue: 'summer sale; Path=/other; token=a=b & café 🍪',
    cookieDays: 30,
  },
  { cookieName: '__Host-audience', cookieValue: 'returning', cookieDays: 400 },
];
function clearCookies() {
  for (const entry of document.cookie.split(';')) {
    const name = entry.trim().split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0; Secure`;
  }
}
beforeEach(() => {
  document.body.innerHTML = '<p id="result">waiting</p>';
  clearCookies();
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  exported.visualDXP?.destroy();
  delete exported.visualDXP;
  vi.restoreAllMocks();
  clearCookies();
  document.body.innerHTML = '';
});

it.each(valid)(
  'writes %j before the next condition in preview and exported scripts',
  async (config) => {
    const write = vi.spyOn(document, 'cookie', 'set');
    const runtime = createRuntime(graph(config));
    runtimes.push(runtime);
    await runtime.run();
    expect(document.querySelector('#result')?.textContent).toBe('yes');
    const cookie = `${encodeURIComponent(config.cookieName ?? '')}=${encodeURIComponent(config.cookieValue ?? '')}`;
    expect(document.cookie).toBe(cookie);
    expect(write).toHaveBeenLastCalledWith(
      `${cookie}; Path=/; SameSite=Lax${config.cookieDays ? `; Max-Age=${config.cookieDays * 86400}` : ''}; Secure`,
    );
    clearCookies();
    document.querySelector('#result')?.replaceChildren('waiting');
    new Function('window', 'document', exportWorkflow(graph(config)))(window, document);
    await exported.visualDXP?.run();
    expect(document.querySelector('#result')?.textContent).toBe('yes');
    expect(document.cookie).toBe(cookie);
  },
);

it.each([
  {
    config: {
      cookieName: 'audience_{{ user.id }}',
      cookieValue: '{{user.label}}/{{items[0].id}}/{{enabled}}/{{count}}',
      cookieDays: 7,
    },
    input: {
      user: { id: 42, label: 'café; token=a=b 🍪' },
      items: [{ id: 0 }],
      enabled: false,
      count: 0,
    },
    name: 'audience_42',
    value: 'café; token=a=b 🍪/0/false/0',
  },
  {
    config: { cookieName: '{{$.name}}', cookieValue: '{{user}}' },
    input: { name: 'audience', user: { id: 42 } },
    name: 'audience',
    value: '{"id":42}',
  },
  {
    config: { cookieName: 'audience', cookieValue: '{{$}}' },
    input: 42,
    name: 'audience',
    value: '42',
  },
  {
    config: { cookieName: 'audience', cookieValue: '{{$}}' },
    input: false,
    name: 'audience',
    value: 'false',
  },
  {
    config: { cookieName: 'audience', cookieValue: '{{$}}' },
    input: null,
    name: 'audience',
    value: '',
  },
  {
    config: { cookieName: 'audience', cookieValue: '{{$}}' },
    input: ['one', 'two'],
    name: 'audience',
    value: '["one","two"]',
  },
  {
    config: { cookieName: '{{$[0]}}', cookieValue: '{{ $[1] }}' },
    input: ['audience', 'returning'],
    name: 'audience',
    value: 'returning',
  },
  {
    config: { cookieName: 'audience', cookieValue: '{{missing}}|{{nil}}|{{literal}}' },
    input: { nil: null, literal: '{{name}}' },
    name: 'audience',
    value: '||{{name}}',
  },
])(
  'resolves cookie templates $config and forwards incoming data in preview and exports',
  async ({ config, input, name, value }) => {
    const workflow = dataGraph(config, name, value);
    expect(validateWorkflow(workflow)).toEqual([]);
    expect(serverValidate(workflow as Parameters<typeof serverValidate>[0])).toEqual([]);
    const fetcher = vi.fn(async () => new Response(JSON.stringify(input)));
    vi.stubGlobal('fetch', fetcher);
    try {
      for (const mode of ['preview', 'exported']) {
        clearCookies();
        document.querySelector('#result')?.replaceChildren('waiting');
        const write = vi.spyOn(document, 'cookie', 'set');
        let runtime: ReturnType<typeof createRuntime>;
        if (mode === 'preview') runtime = createRuntime(workflow, { fetch: fetcher });
        else {
          new Function('window', 'document', exportWorkflow(workflow))(window, document);
          if (!exported.visualDXP) throw new Error('Missing exported runtime');
          runtime = exported.visualDXP;
        }
        runtimes.push(runtime);
        await runtime.run();
        const pair = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        expect(document.cookie).toBe(pair);
        expect(write).toHaveBeenLastCalledWith(
          `${pair}; Path=/; SameSite=Lax${config.cookieDays ? `; Max-Age=${config.cookieDays * 86400}` : ''}; Secure`,
        );
        expect(document.querySelector('#result')?.textContent).toBe(
          input === null ? '' : typeof input === 'object' ? JSON.stringify(input) : String(input),
        );
        runtime.destroy();
        write.mockRestore();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it.each([
  {
    input: {},
    config: { cookieName: 'audience_{{missing}}', cookieValue: 'value' },
    error: 'missing in the cookie name',
  },
  {
    input: { name: null },
    config: { cookieName: 'audience_{{name}}', cookieValue: 'value' },
    error: 'missing in the cookie name',
  },
  {
    input: { name: '' },
    config: { cookieName: '{{name}}', cookieValue: 'value' },
    error: 'Enter a cookie name',
  },
  {
    input: { name: 'bad name' },
    config: { cookieName: '{{name}}', cookieValue: 'value' },
    error: 'Enter a cookie name',
  },
  {
    input: { name: 'bad; Path=/' },
    config: { cookieName: '{{name}}', cookieValue: 'value' },
    error: 'Enter a cookie name',
  },
  {
    input: { name: '__Http-session' },
    config: { cookieName: '{{name}}', cookieValue: 'value' },
    error: 'HttpOnly',
  },
  {
    input: { name: '{{other}}' },
    config: { cookieName: '{{name}}', cookieValue: 'value' },
    error: 'Enter a cookie name',
  },
  {
    input: { value: 'x'.repeat(4096) },
    config: { cookieName: 'audience', cookieValue: '{{value}}' },
    error: '4,096 bytes',
  },
  {
    input: { value: '\uD800' },
    config: { cookieName: 'audience', cookieValue: '{{value}}' },
    error: 'valid Unicode',
  },
])(
  'rejects invalid resolved cookie fields before writing: $error ($config)',
  async ({ input, config, error }) => {
    const workflow = dataGraph(config);
    expect(validateWorkflow(workflow)).toEqual([]);
    const fetcher = vi.fn(async () => new Response(JSON.stringify(input)));
    vi.stubGlobal('fetch', fetcher);
    try {
      for (const mode of ['preview', 'exported']) {
        const write = vi.spyOn(document, 'cookie', 'set');
        const logs: RunLog[] = [];
        let runtime: ReturnType<typeof createRuntime>;
        if (mode === 'preview')
          runtime = createRuntime(workflow, { fetch: fetcher, onLog: (entry) => logs.push(entry) });
        else {
          new Function('window', 'document', exportWorkflow(workflow))(window, document);
          if (!exported.visualDXP) throw new Error('Missing exported runtime');
          runtime = exported.visualDXP;
        }
        runtimes.push(runtime);
        await expect(runtime.run()).rejects.toThrow(error);
        expect(write).not.toHaveBeenCalled();
        expect(document.querySelector('#result')?.textContent).toBe('waiting');
        if (mode === 'preview')
          expect(
            logs.filter((entry) => entry.status === 'error').map((entry) => entry.nodeId),
          ).toEqual(['write']);
        runtime.destroy();
        write.mockRestore();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it('uses a Data Transform output as the cookie template root', async () => {
  const workflow = dataGraph({ cookieName: 'audience', cookieValue: '{{$}}' }, 'audience', '42');
  workflow.nodes.push({
    id: 'select',
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind: 'transform', label: 'Select', config: { dataPath: 'user.id' } },
  });
  const incoming = workflow.edges.find((edge) => edge.id === 'request-write');
  if (!incoming) throw new Error('Missing request connection');
  incoming.target = 'select';
  workflow.edges.push({ id: 'select-write', source: 'select', target: 'write' });
  const runtime = createRuntime(workflow, {
    fetch: vi.fn(async () => new Response('{"user":{"id":42}}')),
  });
  runtimes.push(runtime);
  await runtime.run();
  expect(document.cookie).toBe('audience=42');
  expect(document.querySelector('#result')?.textContent).toBe('42');
});

it('overwrites the same cookie, preserves other cookies, and makes it available on all paths', async () => {
  document.cookie = 'audience=old; Path=/; Secure';
  document.cookie = 'unrelated=keep; Path=/; Secure';
  const runtime = createRuntime(
    graph({ cookieName: 'audience', cookieValue: 'new', cookieDays: 1 }),
  );
  runtimes.push(runtime);
  await runtime.run();
  const original = window.location.href;
  try {
    window.history.replaceState(null, '', '/another-page');
    expect(document.cookie.split('; ').sort()).toEqual(['audience=new', 'unrelated=keep']);
  } finally {
    window.history.replaceState(null, '', original);
  }
  runtime.destroy();
  expect(document.cookie).toContain('audience=new');
});

it.each(['http:', 'https:'])(
  'writes to the supplied preview document with %s attributes',
  async (protocol) => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Missing preview document');
    doc.body.innerHTML = '<p id="result">waiting</p>';
    let saved = '';
    const write = vi.spyOn(doc, 'cookie', 'set').mockImplementation((value) => {
      saved = value.split(';')[0];
    });
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => saved);
    const editorWrite = vi.spyOn(document, 'cookie', 'set');
    const runtime = createRuntime(graph({ cookieName: 'preview', cookieValue: 'only' }), {
      document: doc,
      window: { location: { protocol } } as Window,
    });
    runtimes.push(runtime);
    await runtime.run();
    expect(write).toHaveBeenCalledWith(
      `preview=only; Path=/; SameSite=Lax${protocol === 'https:' ? '; Secure' : ''}`,
    );
    expect(editorWrite).not.toHaveBeenCalled();
    expect(doc.querySelector('#result')?.textContent).toBe('yes');
    expect(document.querySelector('#result')?.textContent).toBe('waiting');
  },
);

it.each(['denied', 'ignored'])(
  'reports %s cookie writes and stops downstream steps',
  async (failure) => {
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      if (failure === 'denied') throw new DOMException('Blocked', 'SecurityError');
    });
    const logs: RunLog[] = [];
    const runtime = createRuntime(graph(valid[0]), { onLog: (entry) => logs.push(entry) });
    runtimes.push(runtime);
    await expect(runtime.run()).rejects.toThrow('The browser could not save this cookie');
    expect(logs.filter((entry) => entry.status === 'error').map((entry) => entry.nodeId)).toEqual([
      'write',
    ]);
    expect(document.querySelector('#result')?.textContent).toBe('waiting');
  },
);

it.each([
  ...valid,
  { cookieName: 'audience_{{user.id}}', cookieValue: '{{items[0].label}}' },
  { cookieName: '{{$.name}}', cookieValue: 'Value: {{$}}', cookieDays: 30 },
])('preserves cookie configuration %j through JSON and AI editing', (config) => {
  const workflow = JSON.parse(JSON.stringify(graph(config)));
  expect(isWorkflow(workflow)).toBe(true);
  expect(validateWorkflow(workflow)).toEqual([]);
  expect(
    parseAIChatRequest({
      workflow,
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [],
    }).workflow.nodes[1].data.config,
  ).toEqual(config);
  const response = parseAIChatResponse({
    message: 'Updated',
    operations: [{ type: 'update_node', id: 'write', config }],
  });
  expect(
    applyWorkflowOperations(graph(valid[0]), response.operations).nodes[1].data.config,
  ).toEqual(config);
});

it('creates a valid Set cookie node from the catalog', () => {
  const node = createNode('cookie');
  expect(node.data.label).toBe('Set cookie');
  expect(validateWorkflow(graph(node.data.config))).toEqual([]);
  const workflow = graph(valid[0]);
  workflow.nodes.splice(1, 1);
  workflow.edges = [];
  expect(
    applyWorkflowOperations(workflow, [{ type: 'add_node', node }]).nodes.at(-1)?.data,
  ).toEqual(node.data);
});

it.each([
  {},
  { cookieName: '' },
  { cookieName: 'bad name' },
  { cookieName: 'injected; Path=/' },
  { cookieName: 'name=value' },
  { cookieName: '__Http-session' },
  { cookieName: '__Host-Http-session' },
  { cookieName: '{{ }}' },
  { cookieName: '{{user.id' },
  { cookieName: '{{user[id]}}' },
  { cookieName: 'bad {{name}}' },
  { cookieName: '__Http-{{name}}' },
  { cookieValue: '{{ }}' },
  { cookieValue: '{{user.name' },
  { cookieValue: '{{name.toUpperCase()}}' },
  { cookieName: 42 },
  { cookieValue: undefined },
  { cookieValue: 42 },
  { cookieValue: '\uD800' },
  { cookieValue: 'x'.repeat(4096) },
  { cookieDays: -1 },
  { cookieDays: 1.5 },
  { cookieDays: 401 },
  { cookieDays: null },
  { cookieDays: '30' },
  { cookieDays: Infinity },
])('rejects invalid cookie configuration %j before writing', async (patch) => {
  const config = (Object.keys(patch).length ? { ...valid[0], ...patch } : {}) as StepConfig;
  expect(validateWorkflow(graph(config)).some((issue) => issue.nodeId === 'write')).toBe(true);
  expect(() => exportWorkflow(graph(config))).toThrow();
  const write = vi.spyOn(document, 'cookie', 'set');
  const runtime = createRuntime(graph(config));
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
});

it.each([{ cookieName: 42 }, { cookieValue: 42 }, { cookieDays: '30' }])(
  'rejects wrong cookie field types on import: %j',
  (config) => {
    expect(isWorkflow(graph(config as unknown as StepConfig))).toBe(false);
  },
);
