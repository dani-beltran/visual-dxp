// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { migrateDataTransforms } from '../src/lib/dataTransformMigration';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { Workflow, WorkflowNode } from '../src/lib/types';

const node = (
  id: string,
  kind: WorkflowNode['data']['kind'],
  config: WorkflowNode['data']['config'],
): WorkflowNode => ({
  id,
  type: 'workflow',
  position: { x: 100, y: 100 },
  data: { kind, label: id, config },
});
function graph(): Workflow {
  document.body.innerHTML = '<button id="run"></button><p id="a"></p><p id="b"></p>';
  return {
    version: 1,
    name: 'Migration',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#run' }),
      node('http', 'http', { url: 'https://example.com' }),
      node('a', 'dom', { selector: '#a', valueSource: 'incoming-data' }),
    ],
    edges: [
      { id: 'start-http', source: 'start', target: 'http' },
      {
        id: 'http-a',
        source: 'http',
        target: 'a',
        label: 'Customer name',
        data: { mapping: { sourcePath: 'user.name', targetInput: 'value' } },
      },
    ],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
});
it('migrates mappings non-mutatingly and idempotently with labels and handles intact', () => {
  const original = graph();
  const migrated = migrateDataTransforms(original);
  expect(original.edges[1].data?.mapping).toBeDefined();
  expect(migrated.edges.every((edge) => !edge.data?.mapping)).toBe(true);
  const transform = migrated.nodes.find((entry) => entry.data.kind === 'transform')!;
  expect(transform.data.config).toEqual({ dataPath: 'user.name', transformations: [] });
  expect(migrated.edges.find((edge) => edge.id === 'http-a')).toMatchObject({
    source: transform.id,
    target: 'a',
    label: 'Customer name',
    sourceHandle: null,
  });
  expect(migrateDataTransforms(migrated)).toBe(migrated);
  expect(isWorkflow(JSON.parse(JSON.stringify(migrated)))).toBe(true);
  expect(validateWorkflow(migrated)).toEqual([]);
});
it.each(['direct', 'exported'] as const)(
  'automatically executes safe legacy edge mappings (%s)',
  async (mode) => {
    const workflow = graph();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"user":{"name":"Ada"}}'));
    let runtime: ReturnType<typeof createRuntime>;
    if (mode === 'direct') runtime = createRuntime(workflow);
    else {
      new Function('window', 'document', exportWorkflow(workflow))(window, document);
      runtime = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP!;
    }
    runtimes.push(runtime);
    await runtime.run();
    expect(document.querySelector('#a')?.textContent).toBe('Ada');
  },
);
it('flags consumer mappings whose downstream data would change and keeps the review across reloads', async () => {
  const workflow = graph();
  workflow.nodes.push(node('b', 'dom', { selector: '#b', value: '{{$}}' }));
  workflow.edges.push({ id: 'a-b', source: 'a', target: 'b' });
  const migrated = migrateDataTransforms(workflow);
  const transform = migrated.nodes.find((entry) => entry.data.kind === 'transform')!;
  expect(transform.data.config.migrationWarning).toContain('forwarded the original data');
  expect(validateWorkflow(migrated)).toContainEqual(
    expect.objectContaining({
      nodeId: transform.id,
      message: transform.data.config.migrationWarning,
    }),
  );
  expect(() => exportWorkflow(migrated)).toThrow('forwarded the original data');
  const reloaded = migrateDataTransforms(JSON.parse(JSON.stringify(migrated)));
  expect(
    reloaded.nodes.find((entry) => entry.id === transform.id)?.data.config.migrationWarning,
  ).toBe(transform.data.config.migrationWarning);
  const runtime = createRuntime(migrated, {
    fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{"user":{"name":"Ada"}}')),
  });
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow('Review downstream');
});
it.each(['Plain text', '"JSON text"', '{"user":{"name":"Ada"}}', '{"user":null}', '{}'])(
  'preserves imported JSON-only response extraction for %s',
  async (body) => {
    const workflow = graph();
    workflow.nodes[1].data.config.responseDataPath = 'user';
    workflow.edges[1].data = { mapping: { sourcePath: '', targetInput: 'data' } };
    const migrated = migrateDataTransforms(workflow);
    expect(migrated.nodes[1].data.config.responseDataPath).toBeUndefined();
    expect(
      migrated.nodes.find((entry) => entry.data.kind === 'transform')?.data.config.legacyJsonOnly,
    ).toBe(true);
    const runtime = createRuntime(migrated, {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(body)),
    });
    runtimes.push(runtime);
    await runtime.run();
    expect(document.querySelector('#a')?.textContent).toBe(
      body === 'Plain text' ? body : body.includes('Ada') ? '{"name":"Ada"}' : '',
    );
  },
);
it('keeps request failures intact for imported response selection', async () => {
  const workflow = graph();
  workflow.nodes[1].data.config.responseDataPath = 'user';
  workflow.edges[1].data = { mapping: { sourcePath: '', targetInput: 'data' } };
  const runtime = createRuntime(migrateDataTransforms(workflow), {
    fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('Unavailable', { status: 503 })),
  });
  runtimes.push(runtime);
  await runtime.run();
  expect(JSON.parse(document.querySelector('#a')!.textContent!)).toMatchObject({
    error: { code: 503 },
  });
});
it('migrates every incoming connection, respects explicit mappings, and retains unrelated edge data', () => {
  const workflow = graph();
  workflow.nodes[2].data.config.valueDataPath = 'legacy';
  workflow.edges[1].data!.extra = 'keep';
  workflow.edges.push({ id: 'other', source: 'start', target: 'a' });
  const migrated = migrateDataTransforms(workflow);
  expect(
    migrated.nodes
      .filter((entry) => entry.data.kind === 'transform')
      .map((entry) => entry.data.config.dataPath),
  ).toEqual(['user.name', 'legacy']);
  expect(migrated.nodes[2].data.config.valueDataPath).toBeUndefined();
  expect(migrated.nodes[2].data.config.valueSource).toBeUndefined();
  expect(migrated.nodes[2].data.config.value).toBe('{{$}}');
  expect(migrated.edges.find((edge) => edge.id === 'http-a')?.data).toEqual({ extra: 'keep' });
});
it('makes disconnected active paths explicit and surfaces dormant legacy paths', () => {
  const workflow = graph();
  workflow.edges = [];
  workflow.nodes[1].data.config.responseDataPath = 'user';
  workflow.nodes[2].data.config.valueDataPath = 'name';
  const migrated = migrateDataTransforms(workflow);
  expect(
    migrated.nodes
      .filter((entry) => entry.data.kind === 'transform')
      .map((entry) => entry.data.config.dataPath),
  ).toEqual(['user', 'name']);
  expect(migrateDataTransforms(migrated)).toBe(migrated);
  workflow.nodes[2].data.config.valueSource = 'manual';
  const dormant = migrateDataTransforms(workflow);
  expect(dormant.nodes[2].data.config.migrationWarning).toContain('name');
  expect(dormant.nodes[2].data.config.valueDataPath).toBeUndefined();
  expect(migrateDataTransforms(dormant)).toBe(dormant);
});
it('preserves branch handles, avoids ID collisions and keeps frame membership', () => {
  const workflow = graph();
  workflow.nodes[1].data.kind = 'fork';
  workflow.nodes[1].data.config = { condition: '#a' };
  workflow.edges[1].sourceHandle = 'false';
  workflow.nodes.push(
    node('transform-http-a-1', 'delay', { duration: 0 }),
    node('frame', 'frame', {}),
  );
  workflow.nodes[1].parentId = 'frame';
  workflow.nodes[2].parentId = 'frame';
  const migrated = migrateDataTransforms(workflow);
  const transform = migrated.nodes.find((entry) => entry.data.kind === 'transform')!;
  expect(transform.id).not.toBe('transform-http-a-1');
  expect(transform.parentId).toBe('frame');
  expect(migrated.edges.find((edge) => edge.target === transform.id)?.sourceHandle).toBe('false');
});
it('marks inactive and incompatible mappings for manual attention', () => {
  const workflow = graph();
  workflow.nodes[2].data.config = { selector: '#a', value: 'Static' };
  const migrated = migrateDataTransforms(workflow);
  expect(
    migrated.nodes.find((entry) => entry.data.kind === 'transform')?.data.config.migrationWarning,
  ).toContain('inactive or incompatible');
});
