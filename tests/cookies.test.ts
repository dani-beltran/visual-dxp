// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop/product"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { createNode } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { NodeKind, RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

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
    websiteUrl: 'https://example.com',
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
const runtimes: ReturnType<typeof createRuntime>[] = [];
const exported = window as Window & { FormaDXP?: ReturnType<typeof createRuntime> };
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
  exported.FormaDXP?.destroy();
  delete exported.FormaDXP;
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
    await exported.FormaDXP?.run();
    expect(document.querySelector('#result')?.textContent).toBe('yes');
    expect(document.cookie).toBe(cookie);
  },
);

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

it.each(valid)('preserves cookie configuration %j through JSON and AI editing', (config) => {
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
