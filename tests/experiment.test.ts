// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/shop"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest } from '../src/lib/ai';
import { createNode } from '../src/lib/catalog';
import { createExperimentTools } from '../src/lib/experiment';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { NodeKind, RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';
import {
  applyWorkflowOperations as serverApply,
  parseAIChatRequest as serverParse,
} from '../src/server/ai/workflow/ai';
import type { Workflow as ServerWorkflow } from '../src/server/ai/workflow/types';
import { validateWorkflow as serverValidate } from '../src/server/ai/workflow/validation';

function graph(config: StepConfig = {}): Workflow {
  const node = (id: string, kind: NodeKind, config: StepConfig = {}): WorkflowNode => ({
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind, label: id, config },
  });
  return {
    version: 1,
    name: 'A/B test',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#result' }),
      node('experiment', 'experiment', config),
      node('a', 'dom', { selector: '#result', value: 'A' }),
      node('b', 'dom', { selector: '#result', value: 'B' }),
    ],
    edges: [
      { id: 'start-test', source: 'start', target: 'experiment' },
      { id: 'test-a', source: 'experiment', target: 'a', sourceHandle: 'a' },
      { id: 'test-b', source: 'experiment', target: 'b', sourceHandle: 'b' },
    ],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
const exported = window as Window & { visualDXP?: ReturnType<typeof createRuntime> };
beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '<button id="result">Waiting</button>';
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  exported.visualDXP?.destroy();
  delete exported.visualDXP;
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it.each([
  [undefined, 0.49, 'A'],
  [undefined, 0.5, 'B'],
  [25, 0.249, 'A'],
  [25, 0.25, 'B'],
  [0, 0, 'B'],
  [100, 0.9999, 'A'],
] as const)(
  'routes split %s and sample %s exclusively to %s in runtime and export',
  async (split, sample, expected) => {
    vi.spyOn(Math, 'random').mockReturnValue(sample);
    const workflow = graph(split === undefined ? {} : { experimentSplit: split });
    const logs: RunLog[] = [];
    const runtime = createRuntime(workflow, { onLog: (entry) => logs.push(entry) });
    runtimes.push(runtime);
    await runtime.run();
    expect(document.querySelector('#result')?.textContent).toBe(expected);
    expect(logs.filter((entry) => entry.status === 'success').map((entry) => entry.nodeId)).toEqual(
      ['start', 'experiment', expected.toLowerCase()],
    );
    expect(
      logs.find((entry) => entry.nodeId === 'experiment' && entry.status === 'success')?.message,
    ).toBe(`Experiment assigned variant ${expected}`);
    localStorage.clear();
    document.querySelector('#result')?.replaceChildren('Waiting');
    new Function('window', 'document', exportWorkflow(workflow))(window, document);
    await exported.visualDXP?.run();
    expect(document.querySelector('#result')?.textContent).toBe(expected);
  },
);

it('keeps browser assignments across runtime restarts and split changes; a new key resets assignment', async () => {
  const workflow = graph({ experimentKey: 'campaign', experimentSplit: 100 });
  let runtime = createRuntime(workflow);
  runtimes.push(runtime);
  await runtime.run();
  runtime.destroy();
  workflow.nodes[1].data.config.experimentSplit = 0;
  runtime = createRuntime(workflow);
  runtimes.push(runtime);
  await runtime.run();
  expect(document.querySelector('#result')?.textContent).toBe('A');
  workflow.nodes[1].data.config.experimentKey = 'campaign-v2';
  await runtime.run();
  expect(document.querySelector('#result')?.textContent).toBe('B');
});

it.each(['get', 'set'] as const)(
  'continues consistently when storage %s is unavailable',
  (operation) => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValue(0.9);
    if (operation === 'get')
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new Error('Denied');
      });
    else
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Full');
      });
    const tools = createExperimentTools();
    expect(tools.assign('one', {}, window)).toBe('a');
    expect(tools.assign('one', {}, window)).toBe('a');
    expect(random).toHaveBeenCalledTimes(1);
    expect(createExperimentTools().assign('one', {}, window)).toBe('b');
  },
);

it('ignores corrupted storage and isolates default node IDs', () => {
  localStorage.setItem('visual-dxp-experiment-v1:one', 'invalid');
  const tools = createExperimentTools();
  expect(tools.assign('one', { experimentSplit: 100 }, window)).toBe('a');
  expect(tools.assign('two', { experimentSplit: 0 }, window)).toBe('b');
  expect(localStorage.getItem('visual-dxp-experiment-v1:one')).toBe('a');
});

it('forwards the original data only to the assigned branch', async () => {
  const workflow = graph({ experimentSplit: 100 });
  workflow.nodes[0].data = { kind: 'trigger', label: 'start', config: {} };
  workflow.nodes.push({
    ...createNode('http'),
    id: 'request',
    data: { kind: 'http', label: 'request', config: { url: 'https://example.com/data' } },
  });
  workflow.edges[0].target = 'request';
  workflow.edges.push({ id: 'request-test', source: 'request', target: 'experiment' });
  workflow.nodes[2].data.config.value = '{{message}}';
  const previews: string[] = [];
  const runtime = createRuntime(workflow, {
    fetch: vi.fn().mockResolvedValue(new Response('{"message":"Hello A"}')),
    onConnectionPreview: (id) => previews.push(id),
  });
  runtimes.push(runtime);
  await runtime.run();
  expect(document.querySelector('#result')?.textContent).toBe('Hello A');
  expect(previews).toContain('test-a');
  expect(previews).not.toContain('test-b');
});

it.each([-1, 101, 20.5, NaN, Infinity, '50', null])(
  'rejects invalid split %s in both validators and runtime',
  async (split) => {
    const workflow = graph({ experimentSplit: split as number });
    // Explicit null is malformed even though omission selects the default.
    expect(validateWorkflow(workflow).length).toBeGreaterThan(0);
    expect(serverValidate(workflow as ServerWorkflow).length).toBeGreaterThan(0);
    const runtime = createRuntime(workflow);
    runtimes.push(runtime);
    await expect(runtime.run()).rejects.toThrow('whole percentage');
  },
);

it.each([undefined, 'true', 'body', 'A'])(
  'rejects invalid output %s in both validators',
  (handle) => {
    const workflow = graph();
    workflow.edges[1].sourceHandle = handle;
    expect(validateWorkflow(workflow).some((issue) => issue.message.includes('A or B'))).toBe(true);
    expect(
      serverValidate(workflow as ServerWorkflow).some((issue) => issue.message.includes('A or B')),
    ).toBe(true);
  },
);

it('round trips Experiment through import and both assistant boundaries', () => {
  const workflow = graph({ experimentKey: 'test', experimentSplit: 30 });
  expect(createNode('experiment').data.config).toEqual({ experimentSplit: 50 });
  expect(validateWorkflow(workflow)).toEqual([]);
  expect(serverValidate(workflow as ServerWorkflow)).toEqual([]);
  expect(isWorkflow(JSON.parse(JSON.stringify(workflow)))).toBe(true);
  const request = {
    messages: [{ role: 'user', content: 'Test this' }],
    workflow,
    selectedNodeIds: [],
  };
  expect(parseAIChatRequest(request).workflow.nodes[1].data.config).toEqual(
    workflow.nodes[1].data.config,
  );
  expect(serverParse(request).workflow.nodes[1].data.config).toEqual(workflow.nodes[1].data.config);
  for (const apply of [applyWorkflowOperations, serverApply]) {
    const changed = apply(workflow as Workflow & ServerWorkflow, [
      { type: 'update_node', id: 'experiment', config: { experimentSplit: 70 } },
    ]);
    expect(changed.nodes[1].data.config.experimentSplit).toBe(70);
  }
});

it('uses the same assignment key for runtime storage and reviewer evidence', () => {
  const tools = createExperimentTools();
  expect(tools.assignmentKey('one', {})).toBe('visual-dxp-experiment-v1:one');
  expect(tools.assignmentKey('one', { experimentKey: '  ' })).toBe('visual-dxp-experiment-v1:one');
  expect(tools.assignmentKey('one', { experimentKey: ' campaign ' })).toBe(
    'visual-dxp-experiment-v1:campaign',
  );
  tools.assign('one', { experimentKey: ' campaign ', experimentSplit: 100 }, window);
  expect(localStorage.getItem(tools.assignmentKey('one', { experimentKey: 'campaign' }))).toBe('a');
  expect(
    createExperimentTools().assign(
      'one',
      { experimentKey: 'campaign', experimentSplit: 0 },
      window,
    ),
  ).toBe('a');
});

it('keeps default node-ID assignments after redeployment and reporting version changes in runtime and export', async () => {
  const workflow = graph({ experimentSplit: 100 });
  const first = createRuntime(workflow);
  runtimes.push(first);
  await first.run();
  first.destroy();
  workflow.name = 'Redeployed headline test';
  workflow.analytics = { provider: 'none', workflowVersion: '2' };
  workflow.nodes[1].data.config.experimentSplit = 0;
  const restarted = createRuntime(workflow);
  runtimes.push(restarted);
  await restarted.run();
  expect(document.querySelector('#result')?.textContent).toBe('A');
  restarted.destroy();
  new Function('window', 'document', exportWorkflow(workflow))(window, document);
  await exported.visualDXP?.run();
  expect(document.querySelector('#result')?.textContent).toBe('A');
  expect(localStorage.getItem('visual-dxp-experiment-v1:experiment')).toBe('a');
});
