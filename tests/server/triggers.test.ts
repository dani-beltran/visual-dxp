import { describe, expect, it } from 'vitest';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
} from '../../src/server/ai/workflow/ai';
import { triggerOptions } from '../../src/server/ai/workflow/triggers';
import type { StepConfig, Workflow } from '../../src/server/ai/workflow/types';
import { validateWorkflow } from '../../src/server/ai/workflow/validation';

const base: Workflow = {
  version: 1,
  name: 'Triggers',
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
  { event: 'zoom-in', selector: '#product-image' },
  { event: 'swipe', selector: '#product-image' },
  { event: 'exit-intent' },
  { event: 'rage-click', rageClickCount: 4, rageClickWindow: 800, rageClickRadius: 25 },
  { event: 'inactivity', duration: 5000 },
  {
    event: 'scroll-thrashing',
    scrollDirectionChanges: 3,
    scrollThrashWindow: 1500,
    scrollMinDistance: 40,
  },
  { event: 'scroll-depth', scrollThreshold: 60 },
  { event: 'custom-event', customEventName: 'cart:updated' },
];
describe('behavior trigger tools', () => {
  it.each(configs)(
    'retains settings through creation, editing, and transport: $event',
    async (config) => {
      const toolkit = createWorkflowTools(base, []);
      const add = toolkit.tools.find((item) => item.name === 'add_node')!;
      const added = JSON.parse(await add.invoke({ kind: 'trigger', config }));
      expect(added.ok).toBe(true);
      expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject(config);
      const update = toolkit.tools.find((item) => item.name === 'update_node')!;
      expect(JSON.parse(await update.invoke({ id: 'start', config })).ok).toBe(true);
      expect(toolkit.getWorkflow().nodes[0].data.config).toEqual(config);
      expect(validateWorkflow(toolkit.getWorkflow())).toEqual([]);
      const request = parseAIChatRequest({
        workflow: toolkit.getWorkflow(),
        messages: [{ role: 'user', content: 'Edit' }],
        selectedNodeIds: [],
      });
      expect(request.workflow.nodes[0].data.config).toEqual(config);
      const response = parseAIChatResponse({
        message: 'Updated',
        operations: toolkit.getOperations(),
      });
      expect(applyWorkflowOperations(base, response.operations).nodes[0].data.config).toEqual(
        config,
      );
    },
  );

  it('rejects invalid settings without staging edits', async () => {
    const toolkit = createWorkflowTools(base, []);
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    for (const [event, { settings }] of Object.entries(triggerOptions)) {
      for (const { key, min, max } of settings) {
        for (const value of [min - 1, max + 1, 1.5, Number.NaN, Infinity, '5', null]) {
          const config = { event, [key]: value } as StepConfig;
          expect(() =>
            applyWorkflowOperations(base, [{ type: 'update_node', id: 'start', config }]),
          ).toThrow();
        }
      }
    }
    // duration=0 is valid for delays but must be rejected for inactivity.
    expect(
      JSON.parse(await update.invoke({ id: 'start', config: { event: 'inactivity', duration: 0 } }))
        .ok,
    ).toBe(false);
    expect(toolkit.getOperations()).toEqual([]);
  });

  it.each([
    { event: 'zoom-in', selector: undefined },
    { event: 'zoom-in', selector: '' },
    { event: 'zoom-in', selector: '   ' },
    { event: 'swipe', selector: undefined },
    { event: 'swipe', selector: '' },
    { event: 'swipe', selector: '   ' },
  ] satisfies StepConfig[])('requires a target element for $event: $selector', async (config) => {
    const workflow = structuredClone(base);
    workflow.nodes[0].data.config = config;
    expect(validateWorkflow(workflow)).toEqual([
      { nodeId: 'start', message: 'Choose a target element for this trigger.' },
    ]);

    const toolkit = createWorkflowTools(base, []);
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    expect(JSON.parse(await update.invoke({ id: 'start', config }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('Choose a target element for this trigger.'),
    });
    expect(toolkit.getOperations()).toEqual([]);
    expect(toolkit.getWorkflow()).toEqual(base);
  });

  it.each([
    [{ event: 'custom-event' }, 'Enter a custom event name for this trigger.'],
    [{ event: 'custom-event', customEventName: '' }, 'Enter a custom event name for this trigger.'],
    [
      { event: 'custom-event', customEventName: '  ' },
      'Enter a custom event name for this trigger.',
    ],
  ] satisfies [StepConfig, string][])(
    'requires a custom event name: %j',
    async (config, message) => {
      const workflow = structuredClone(base);
      workflow.nodes[0].data.config = config;
      expect(validateWorkflow(workflow)).toEqual([{ nodeId: 'start', message }]);

      const toolkit = createWorkflowTools(base, []);
      const update = toolkit.tools.find((item) => item.name === 'update_node')!;
      expect(JSON.parse(await update.invoke({ id: 'start', config }))).toMatchObject({
        ok: false,
        error: expect.stringContaining(message),
      });
      expect(toolkit.getOperations()).toEqual([]);
      expect(toolkit.getWorkflow()).toEqual(base);
    },
  );

  it('does not require a selector for custom events and drops stale element settings', async () => {
    const toolkit = createWorkflowTools(
      {
        ...base,
        nodes: [
          {
            ...base.nodes[0],
            data: { ...base.nodes[0].data, config: { event: 'click', selector: '#buy' } },
          },
        ],
      },
      [],
    );
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    const config = { event: 'custom-event', customEventName: 'checkout:done' } as const;
    expect(JSON.parse(await update.invoke({ id: 'start', config })).ok).toBe(true);
    expect(toolkit.getWorkflow().nodes[0].data.config).toEqual(config);
    expect(triggerOptions['custom-event'].settings).toEqual([]);
    // Surrounding whitespace is trimmed at runtime, so it is not a validation error.
    const padded = { event: 'custom-event', customEventName: '  cart:updated ' } as const;
    expect(JSON.parse(await update.invoke({ id: 'start', config: padded })).ok).toBe(true);
    expect(validateWorkflow(toolkit.getWorkflow())).toEqual([]);
  });
});
