import { describe, expect, it } from 'vitest';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
} from '../../src/server/ai/workflow/ai';
import type { StepConfig, Workflow } from '../../src/server/ai/workflow/types';
import { validateWorkflow } from '../../src/server/ai/workflow/validation';

const base: Workflow = {
  version: 1,
  name: 'Condition workflow',
  websiteUrl: 'https://example.com',
  nodes: [
    {
      id: 'start',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind: 'trigger', label: 'Start', config: {} },
    },
  ],
  edges: [],
};
const configs: StepConfig[] = [
  { conditionType: 'time-of-day', conditionStartTime: '09:00', conditionEndTime: '17:00' },
  {
    conditionType: 'time-of-day',
    conditionStartTime: '22:00',
    conditionEndTime: '06:00',
    conditionTimeZone: 'local',
  },
  {
    conditionType: 'time-of-day',
    conditionStartTime: '08:30',
    conditionEndTime: '08:30',
    conditionTimeZone: 'utc',
  },
  {
    conditionType: 'time-of-day',
    conditionStartTime: '00:00',
    conditionEndTime: '23:59',
    conditionTimeZone: 'utc',
  },
  {
    conditionType: 'date-range',
    conditionStartDate: '2026-09-01',
    conditionEndDate: '2026-09-30',
    conditionTimeZone: 'local',
  },
  {
    conditionType: 'date-range',
    conditionStartDate: '2026-09-01',
    conditionEndDate: '2026-09-30',
    conditionTimeZone: 'utc',
  },
  { conditionType: 'date-range', conditionStartDate: '2026-09-01', conditionEndDate: '2026-09-30' },
  { conditionType: 'date-range', conditionStartDate: '2028-02-29', conditionEndDate: '2028-02-29' },
  { condition: '#legacy' },
  { conditionType: 'selector', condition: '#result' },
  { conditionType: 'device', conditionValue: 'desktop' },
  { conditionType: 'device', conditionValue: 'mobile' },
  { conditionType: 'language', conditionValue: 'en-US' },
  { conditionType: 'referrer', conditionValue: 'source.example' },
  { conditionType: 'referrer', conditionValue: 'http://source.example:8080/path?query=1' },
  { conditionType: 'query-param', conditionKey: 'utm_source', conditionValue: 'newsletter' },
  { conditionType: 'cookie', conditionKey: 'audience', conditionValue: '' },
  { conditionType: 'cookie', conditionKey: 'audience', conditionValue: 'returning' },
];
describe('visitor condition tools and contracts', () => {
  it.each(['UTC', 'Europe/Madrid', '', 42, null])(
    'rejects unsupported date-range time zone %j',
    (conditionTimeZone) => {
      expect(() =>
        applyWorkflowOperations(base, [
          {
            type: 'add_node',
            node: {
              id: 'branch',
              type: 'workflow',
              position: { x: 300, y: 0 },
              data: {
                kind: 'fork',
                label: 'Condition',
                config: {
                  conditionType: 'date-range',
                  conditionStartDate: '2026-09-01',
                  conditionEndDate: '2026-09-30',
                  conditionTimeZone,
                },
              },
            },
          },
        ]),
      ).toThrow();
    },
  );
  it.each(configs)('creates and retains %j through tool and AI boundaries', async (config) => {
    const toolkit = createWorkflowTools(base, []);
    const add = toolkit.tools.find((item) => item.name === 'add_node')!;
    const added = JSON.parse(await add.invoke({ kind: 'fork', config }));
    expect(added.ok).toBe(true);
    const id = added.operation.node.id;
    // Verify the persisted configuration independently of tool schema inference.
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject(config);
    expect(validateWorkflow(toolkit.getWorkflow())).toEqual([]);
    const request = parseAIChatRequest({
      workflow: toolkit.getWorkflow(),
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [id],
    });
    expect(request.workflow.nodes.at(-1)?.data.config).toMatchObject(config);
    const response = parseAIChatResponse({ message: 'Added', operations: toolkit.getOperations() });
    expect(
      applyWorkflowOperations(base, response.operations).nodes.at(-1)?.data.config,
    ).toMatchObject(config);
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    expect(
      JSON.parse(
        await update.invoke({ id, config: { conditionType: 'language', conditionValue: 'es' } }),
      ).ok,
    ).toBe(true);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject({
      conditionType: 'language',
      conditionValue: 'es',
    });
  });

  it.each([
    { conditionType: 'time-of-day' },
    { conditionType: 'time-of-day', conditionStartTime: '09:00' },
    { conditionType: 'time-of-day', conditionEndTime: '17:00' },
    { conditionType: 'time-of-day', conditionStartTime: '', conditionEndTime: '' },
    { conditionType: 'time-of-day', conditionStartTime: '24:00', conditionEndTime: '06:00' },
    { conditionType: 'time-of-day', conditionStartTime: '09:00', conditionEndTime: '12:60' },
    { conditionType: 'time-of-day', conditionStartTime: '9:00', conditionEndTime: '17:00' },
    { conditionType: 'time-of-day', conditionStartTime: '09:00:00', conditionEndTime: '17:00' },
    { conditionType: 'time-of-day', conditionStartTime: '09:00\n', conditionEndTime: '17:00' },
    { conditionType: 'time-of-day', conditionStartTime: 42, conditionEndTime: '17:00' },
    { conditionType: 'time-of-day', conditionStartTime: '09:00', conditionEndTime: null },
    {
      conditionType: 'time-of-day',
      conditionStartTime: '09:00',
      conditionEndTime: '17:00',
      conditionTimeZone: 'UTC',
    },
    {
      conditionType: 'time-of-day',
      conditionStartTime: '09:00',
      conditionEndTime: '17:00',
      conditionTimeZone: null,
    },
    { conditionType: 'date-range' },
    { conditionType: 'date-range', conditionStartDate: '2026-09-01' },
    { conditionType: 'date-range', conditionEndDate: '2026-09-30' },
    { conditionType: 'date-range', conditionStartDate: '', conditionEndDate: '' },
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-30',
      conditionEndDate: '2026-09-01',
    },
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-02-29',
      conditionEndDate: '2026-03-01',
    },
    {
      conditionType: 'date-range',
      conditionStartDate: '1900-02-29',
      conditionEndDate: '1900-03-01',
    },
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-01',
      conditionEndDate: '2026-09-31',
    },
    { conditionType: 'date-range', conditionStartDate: '2026-9-1', conditionEndDate: '2026-09-30' },
    {
      conditionType: 'date-range',
      conditionStartDate: '0000-01-01',
      conditionEndDate: '2026-09-30',
    },
    { conditionType: 'date-range', conditionStartDate: 42, conditionEndDate: '2026-09-30' },
    { conditionType: 'date-range', conditionStartDate: '2026-09-01', conditionEndDate: null },
    { conditionType: 'unknown' },
    { conditionType: 'device', conditionValue: 'tablet' },
    { conditionType: 'language', conditionValue: 'en_US' },
    { conditionType: 'referrer', conditionValue: '/relative' },
    { conditionType: 'referrer', conditionValue: 'not a domain' },
    { conditionType: 'referrer', conditionValue: 'example..com' },
    { conditionType: 'referrer', conditionValue: 'https://user@example.com' },
    { conditionType: 'cookie', conditionKey: '', conditionValue: '' },
    { conditionType: 'cookie', conditionKey: 'audience' },
    { conditionType: 'query-param', conditionKey: 'utm_source', conditionValue: 1 },
  ])('rejects invalid condition edits: %j', (config) => {
    expect(() =>
      applyWorkflowOperations(base, [
        {
          type: 'add_node',
          node: {
            id: 'branch',
            type: 'workflow',
            position: { x: 300, y: 0 },
            data: { kind: 'fork', label: 'Condition', config },
          },
        },
      ]),
    ).toThrow();
  });

  it('updates a time range and time zone through the tool without losing other settings', async () => {
    const toolkit = createWorkflowTools(base, []);
    const add = toolkit.tools.find((item) => item.name === 'add_node')!;
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    const added = JSON.parse(
      await add.invoke({
        kind: 'fork',
        config: {
          conditionType: 'time-of-day',
          conditionStartTime: '09:00',
          conditionEndTime: '17:00',
        },
      }),
    );
    expect(added.ok).toBe(true);
    const id = added.operation.node.id;
    expect(
      JSON.parse(
        await update.invoke({
          id,
          config: { conditionStartTime: '22:00', conditionTimeZone: 'utc' },
        }),
      ).ok,
    ).toBe(true);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject({
      conditionType: 'time-of-day',
      conditionStartTime: '22:00',
      conditionEndTime: '17:00',
      conditionTimeZone: 'utc',
    });
    expect(JSON.parse(await update.invoke({ id, config: { conditionEndTime: '24:00' } })).ok).toBe(
      false,
    );
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config.conditionEndTime).toBe('17:00');
  });

  it('updates a date range through the tool without losing either bound', async () => {
    const toolkit = createWorkflowTools(base, []);
    const add = toolkit.tools.find((item) => item.name === 'add_node')!;
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    const added = JSON.parse(
      await add.invoke({
        kind: 'fork',
        config: {
          conditionType: 'date-range',
          conditionStartDate: '2026-09-01',
          conditionEndDate: '2026-09-30',
        },
      }),
    );
    expect(added.ok).toBe(true);
    const id = added.operation.node.id;
    expect(
      JSON.parse(await update.invoke({ id, config: { conditionEndDate: '2026-10-01' } })).ok,
    ).toBe(true);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject({
      conditionType: 'date-range',
      conditionStartDate: '2026-09-01',
      conditionEndDate: '2026-10-01',
    });
    expect(
      JSON.parse(await update.invoke({ id, config: { conditionEndDate: '2026-08-31' } })).ok,
    ).toBe(false);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config.conditionEndDate).toBe('2026-10-01');
    for (const conditionTimeZone of ['utc', 'local'] as const) {
      expect(JSON.parse(await update.invoke({ id, config: { conditionTimeZone } })).ok).toBe(true);
      expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject({
        conditionTimeZone,
        conditionStartDate: '2026-09-01',
        conditionEndDate: '2026-10-01',
      });
    }
  });
});
