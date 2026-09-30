// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { NodeKind, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function graph(config: StepConfig): Workflow {
  const node = (id: string, kind: NodeKind, settings: StepConfig): WorkflowNode => ({
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: settings },
  });
  return {
    version: 1,
    name: 'Time of day',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#result' }),
      node('condition', 'fork', config),
      node('yes', 'dom', { selector: '#result', value: 'yes' }),
      node('no', 'dom', { selector: '#result', value: 'no' }),
    ],
    edges: [
      { id: 'start-condition', source: 'start', target: 'condition' },
      { id: 'condition-yes', source: 'condition', target: 'yes', sourceHandle: 'true' },
      { id: 'condition-no', source: 'condition', target: 'no', sourceHandle: 'false' },
    ],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
const exported = window as Window & { visualDXP?: ReturnType<typeof createRuntime> };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  document.body.innerHTML = '<p id="result">waiting</p>';
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  exported.visualDXP?.destroy();
  delete exported.visualDXP;
  vi.useRealTimers();
  document.body.innerHTML = '';
});

async function expectBranches(config: StepConfig, matches: boolean) {
  const runtime = createRuntime(graph(config));
  runtimes.push(runtime);
  await runtime.run();
  expect(document.querySelector('#result')?.textContent).toBe(matches ? 'yes' : 'no');
  document.querySelector('#result')?.replaceChildren('waiting');
  new Function('window', 'document', exportWorkflow(graph(config)))(window, document);
  await exported.visualDXP?.run();
  expect(document.querySelector('#result')?.textContent).toBe(matches ? 'yes' : 'no');
}

describe.each(['local', 'utc'] as const)('%s time-of-day routing', (conditionTimeZone) => {
  it.each([
    ['09:00', '17:00', '08:59:59.999', false],
    ['09:00', '17:00', '09:00:00.000', true],
    ['09:00', '17:00', '12:30:00.000', true],
    ['09:00', '17:00', '17:00:59.999', true],
    ['09:00', '17:00', '17:01:00.000', false],
    ['22:00', '06:00', '21:59:59.999', false],
    ['22:00', '06:00', '22:00:00.000', true],
    ['22:00', '06:00', '23:59:59.999', true],
    ['22:00', '06:00', '00:00:00.000', true],
    ['22:00', '06:00', '06:00:59.999', true],
    ['22:00', '06:00', '06:01:00.000', false],
    ['22:00', '06:00', '12:00:00.000', false],
    ['08:30', '08:30', '08:29:59.999', false],
    ['08:30', '08:30', '08:30:00.000', true],
    ['08:30', '08:30', '08:30:59.999', true],
    ['08:30', '08:30', '08:31:00.000', false],
    ['00:00', '23:59', '00:00:00.000', true],
    ['00:00', '23:59', '23:59:59.999', true],
    ['00:00', '00:00', '00:01:00.000', false],
  ] as const)(
    '%s–%s at %s matches %s in preview and exports',
    async (start, end, time, matches) => {
      vi.setSystemTime(new Date(`2026-09-22T${time}${conditionTimeZone === 'utc' ? 'Z' : ''}`));
      await expectBranches(
        {
          conditionType: 'time-of-day',
          conditionStartTime: start,
          conditionEndTime: end,
          conditionTimeZone,
        },
        matches,
      );
    },
  );
});

it.each([new Date(2026, 8, 22, 0, 30), new Date(2026, 8, 22, 23, 59)])(
  'uses the selected clock at local time %s and defaults to visitor local time',
  async (now) => {
    vi.setSystemTime(now);
    const time = now.getHours() === 0 ? '00:30' : '23:59';
    for (const conditionTimeZone of [undefined, 'local', 'utc'] as const) {
      await expectBranches(
        {
          conditionType: 'time-of-day',
          conditionStartTime: time,
          conditionEndTime: time,
          ...(conditionTimeZone ? { conditionTimeZone } : {}),
        },
        conditionTimeZone !== 'utc' ||
          (now.getUTCHours() === now.getHours() && now.getUTCMinutes() === now.getMinutes()),
      );
    }
  },
);

it('reads the current time on every run across midnight', async () => {
  const runtime = createRuntime(
    graph({
      conditionType: 'time-of-day',
      conditionStartTime: '22:00',
      conditionEndTime: '06:00',
      conditionTimeZone: 'utc',
    }),
  );
  runtimes.push(runtime);
  for (const [now, expected] of [
    ['2026-09-22T21:59:59.999Z', 'no'],
    ['2026-09-22T22:00:00.000Z', 'yes'],
    ['2026-09-23T00:00:00.000Z', 'yes'],
    ['2026-09-23T06:01:00.000Z', 'no'],
  ]) {
    vi.setSystemTime(new Date(now));
    await runtime.run();
    expect(document.querySelector('#result')?.textContent).toBe(expected);
  }
});

it.each([
  { conditionStartTime: '09:00', conditionEndTime: '17:00' },
  { conditionStartTime: '22:00', conditionEndTime: '06:00', conditionTimeZone: 'local' },
  { conditionStartTime: '08:30', conditionEndTime: '08:30', conditionTimeZone: 'utc' },
] satisfies StepConfig[])(
  'preserves time settings through JSON and AI operations: %j',
  (settings) => {
    const config: StepConfig = { conditionType: 'time-of-day', ...settings };
    const workflow = JSON.parse(JSON.stringify(graph(config)));
    expect(isWorkflow(workflow)).toBe(true);
    expect(validateWorkflow(workflow)).toEqual([]);
    const request = parseAIChatRequest({
      workflow,
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [],
    });
    expect(request.workflow.nodes[1].data.config).toEqual(config);
    const response = parseAIChatResponse({
      message: 'Updated',
      operations: [{ type: 'update_node', id: 'condition', config }],
    });
    expect(
      applyWorkflowOperations(graph({ condition: '#result' }), response.operations).nodes[1].data
        .config,
    ).toMatchObject(config);
  },
);

it.each([
  { conditionStartTime: undefined },
  { conditionEndTime: undefined },
  { conditionStartTime: '' },
  { conditionEndTime: '' },
  { conditionStartTime: '24:00' },
  { conditionEndTime: '12:60' },
  { conditionStartTime: '9:00' },
  { conditionStartTime: '09:0' },
  { conditionStartTime: '09:00:00' },
  { conditionEndTime: '17:00Z' },
  { conditionStartTime: ' 09:00' },
  { conditionStartTime: '09:00\n' },
  { conditionStartTime: '09:00 AM' },
  { conditionStartTime: '2026-09-22' },
  { conditionStartTime: 42 },
  { conditionEndTime: null },
  { conditionTimeZone: 'UTC' },
  { conditionTimeZone: '' },
  { conditionTimeZone: 'Europe/Madrid' },
  { conditionTimeZone: null },
])('rejects invalid time settings before following a branch: %j', async (settings) => {
  const config = {
    conditionType: 'time-of-day',
    conditionStartTime: '09:00',
    conditionEndTime: '17:00',
    ...settings,
  } as StepConfig;
  expect(validateWorkflow(graph(config))).toEqual([
    { nodeId: 'condition', message: expect.any(String) },
  ]);
  expect(() => exportWorkflow(graph(config))).toThrow();
  const runtime = createRuntime(graph(config));
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow();
  expect(document.querySelector('#result')?.textContent).toBe('waiting');
});

it.each(['conditionStartTime', 'conditionEndTime'])('rejects non-string %s on import', (field) => {
  expect(isWorkflow(graph({ [field]: 42 }))).toBe(false);
});
