// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
  workflowFingerprint,
} from '../src/lib/ai';
import {
  type ConnectionPreview,
  connectionTools,
  migrateConnectionMappings,
} from '../src/lib/connectionMapping';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { StepConfig, Workflow, WorkflowNode } from '../src/lib/types';
import {
  parseAIChatRequest as serverRequest,
  parseAIChatResponse as serverResponse,
} from '../src/server/ai/workflow/ai';

function node(id: string, kind: WorkflowNode['data']['kind'], config: StepConfig): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function graph(): Workflow {
  document.body.innerHTML = '<button id="run"></button><p id="a"></p><p id="b"></p><p id="c"></p>';
  return {
    version: 1,
    name: 'Mappings',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#run' }),
      node('http', 'http', { url: 'https://example.com/data' }),
      node('a', 'dom', { selector: '#a', valueSource: 'incoming-data' }),
      node('b', 'dom', { selector: '#b', valueSource: 'incoming-data' }),
      node('c', 'dom', { selector: '#c', valueSource: 'incoming-data' }),
    ],
    edges: [
      { id: 'start-http', source: 'start', target: 'http' },
      {
        id: 'http-a',
        source: 'http',
        target: 'a',
        data: { mapping: { sourcePath: 'user.name', targetInput: 'value' } },
      },
      {
        id: 'http-b',
        source: 'http',
        target: 'b',
        data: { mapping: { sourcePath: 'user.age', targetInput: 'value' } },
      },
      { id: 'a-c', source: 'a', target: 'c' },
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
  'maps sibling connections independently and preserves original data downstream (%s)',
  async (mode) => {
    const workflow = graph();
    const source = { user: { name: 'Ada', age: 37 } };
    const samples = await execute(workflow, JSON.stringify(source), mode);
    expect(document.querySelector('#a')?.textContent).toBe('Ada');
    expect(document.querySelector('#b')?.textContent).toBe('37');
    expect(JSON.parse(document.querySelector('#c')!.textContent!)).toEqual(source);
    if (mode === 'direct')
      expect(samples['http-a']).toEqual({
        source: { exists: true, value: source },
        jsonResponse: true,
      });
  },
);

it.each(['direct', 'exported'] as const)(
  'can intentionally replace forwarded data (%s)',
  async (mode) => {
    const workflow = graph();
    workflow.edges[1].data!.mapping!.targetInput = 'data';
    await execute(workflow, '{"user":{"name":"Ada","age":37}}', mode);
    expect(document.querySelector('#c')?.textContent).toBe('Ada');
  },
);

it.each(['direct', 'exported'] as const)(
  'migrates response and element paths without changing forwarding (%s)',
  async (mode) => {
    const workflow = graph();
    workflow.nodes[1].data.config.responseDataPath = 'user';
    workflow.nodes[2].data.config.valueDataPath = 'name';
    workflow.nodes[3].data.config.valueDataPath = 'age';
    delete workflow.edges[1].data;
    delete workflow.edges[2].data;
    const migrated = migrateConnectionMappings(workflow);
    expect(workflow.nodes[1].data.config.responseDataPath).toBe('user');
    expect(migrated.nodes[1].data.config.responseDataPath).toBeUndefined();
    expect(migrated.nodes[2].data.config.valueDataPath).toBeUndefined();
    expect(migrateConnectionMappings(migrated)).toBe(migrated);
    await execute(migrated, '{"user":{"name":"Ada","age":37}}', mode);
    expect(document.querySelector('#a')?.textContent).toBe('Ada');
    expect(document.querySelector('#b')?.textContent).toBe('37');
    expect(JSON.parse(document.querySelector('#c')!.textContent!)).toEqual({
      name: 'Ada',
      age: 37,
    });
  },
);

it.each(['direct', 'exported'] as const)(
  'migrates condition paths while preserving the HTTP error payload (%s)',
  async (mode) => {
    const workflow = graph();
    workflow.nodes[1].data.config.responseDataPath = 'user';
    workflow.nodes[2] = node('a', 'fork', {
      conditionType: 'data',
      conditionDataPath: 'error.code',
      conditionOperator: 'equal',
      conditionValue: '503',
    });
    delete workflow.edges[1].data;
    workflow.edges = workflow.edges.filter((edge) => edge.id !== 'http-b');
    workflow.edges.at(-1)!.sourceHandle = 'true';
    const migrated = migrateConnectionMappings(workflow);
    await execute(migrated, 'Unavailable', mode, 503);
    expect(JSON.parse(document.querySelector('#c')!.textContent!)).toMatchObject({
      error: { code: 503 },
    });
  },
);

it.each(['direct', 'exported'] as const)(
  'keeps non-JSON text intact for migrated response selections (%s)',
  async (mode) => {
    const workflow = graph();
    workflow.nodes[1].data.config.responseDataPath = 'user';
    delete workflow.edges[1].data;
    delete workflow.edges[2].data;
    await execute(migrateConnectionMappings(workflow), 'Plain text', mode);
    expect(document.querySelector('#a')?.textContent).toBe('Plain text');
  },
);

it('distinguishes missing, null, false and zero and rejects invalid paths/inputs', () => {
  const preview = {
    source: { exists: true, value: { nil: null, flag: false, count: 0 } },
    jsonResponse: false,
  };
  for (const [path, exists, value] of [
    ['absent', false, undefined],
    ['nil', true, null],
    ['flag', true, false],
    ['count', true, 0],
  ] as const)
    expect(
      connectionTools.resolve({ sourcePath: path, targetInput: 'data' }, preview).selected,
    ).toEqual({ exists, value });
  expect(() =>
    connectionTools.resolve({ sourcePath: 'user[', targetInput: 'value' }, preview),
  ).toThrow('Invalid data path');
  const workflow = graph();
  workflow.edges[1].data!.mapping!.targetInput = 'condition';
  expect(validateWorkflow(workflow)).toContainEqual(
    expect.objectContaining({
      edgeId: 'http-a',
      message: expect.stringContaining('not available'),
    }),
  );
});

it('migrates every incoming edge and defers dormant/disconnected legacy settings', () => {
  const workflow = graph();
  workflow.nodes[2].data.config.valueDataPath = 'name';
  workflow.edges[1].data = undefined;
  workflow.edges.push({ id: 'b-a', source: 'b', target: 'a' });
  const migrated = migrateConnectionMappings(workflow);
  expect(
    migrated.edges
      .filter((edge) => edge.target === 'a')
      .map((edge) => edge.data?.mapping?.sourcePath),
  ).toEqual(['name', 'name']);
  const disconnected = { ...workflow, edges: [] };
  expect(migrateConnectionMappings(disconnected)).toBe(disconnected);
  workflow.nodes[2].data.config.valueSource = 'manual';
  workflow.nodes[2].data.config.valueDataPath = 'ignored[';
  expect(migrateConnectionMappings(workflow).nodes[2].data.config.valueDataPath).toBe('ignored[');
});

it('preserves mappings across JSON, frontend/server AI contracts and fingerprints', () => {
  const workflow = graph();
  const saved: unknown = JSON.parse(JSON.stringify(workflow));
  expect(isWorkflow(saved)).toBe(true);
  const request = {
    workflow: saved,
    messages: [{ role: 'user', content: 'Edit' }],
    selectedNodeIds: [],
  };
  for (const parse of [parseAIChatRequest, serverRequest])
    expect(parse(request).workflow.edges[1].data).toEqual(workflow.edges[1].data);
  const data = { mapping: { sourcePath: 'user.age', targetInput: 'value' } };
  const response = { message: 'Mapped', operations: [{ type: 'update_edge', id: 'http-a', data }] };
  for (const parse of [parseAIChatResponse, serverResponse])
    expect(parse(response).operations[0]).toMatchObject({ data });
  const updated = applyWorkflowOperations(workflow, parseAIChatResponse(response).operations);
  expect(updated.edges[1].data).toEqual(data);
  expect(workflowFingerprint(updated)).not.toBe(workflowFingerprint(workflow));
  expect(
    applyWorkflowOperations(updated, [{ type: 'update_edge', id: 'http-a', data: {} }]).edges[1]
      .data,
  ).toEqual({});
  expect(
    isWorkflow({
      ...workflow,
      edges: [{ ...workflow.edges[0], data: { mapping: { sourcePath: 42, targetInput: 'data' } } }],
    }),
  ).toBe(false);
});
