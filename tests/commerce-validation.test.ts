// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { getNodeDataPorts } from '../src/lib/nodeData';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, StepConfig, Workflow } from '../src/lib/types';

const workflow: Workflow = {
  version: 1,
  name: 'Commerce',
  websiteUrl: 'https://example.com',
  nodes: [
    {
      id: 'start',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: {
        kind: 'trigger',
        label: 'Start',
        config: { event: 'commerce-product-added-to-cart', commercePlatform: 'shopify' },
      },
    },
  ],
  edges: [],
};
it('round-trips commerce settings through persistence, import and frontend AI contracts', () => {
  const saved = JSON.parse(JSON.stringify(workflow));
  expect(isWorkflow(saved)).toBe(true);
  expect(validateWorkflow(saved)).toEqual([]);
  expect(
    parseAIChatRequest({
      workflow: saved,
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [],
    }).workflow.nodes[0].data.config,
  ).toEqual(workflow.nodes[0].data.config);
  const response = parseAIChatResponse({
    message: 'Done',
    operations: [{ type: 'update_node', id: 'start', config: workflow.nodes[0].data.config }],
  });
  expect(applyWorkflowOperations(saved, response.operations).nodes).toEqual(workflow.nodes);
  expect(getNodeDataPorts(workflow.nodes[0].data).outputsData).toBe(true);
});

it.each([
  'woocommerce',
  'prestashop',
  'bigcommerce',
  'adobe-commerce',
  'ecwid',
  'wix-ecommerce',
  'unknown',
  '',
  'Shopify',
])(
  'rejects unsupported provider %s in imports, AI, export and unvalidated runtime',
  async (commercePlatform) => {
    const imported = structuredClone(workflow);
    imported.nodes[0].data.config.commercePlatform =
      commercePlatform as StepConfig['commercePlatform'];
    expect(isWorkflow(imported)).toBe(true); // Retain editable input and its explicit provider.
    expect(validateWorkflow(imported)).toEqual([
      { nodeId: 'start', message: 'Unsupported commerce platform. Only Shopify is supported.' },
    ]);
    expect(() => exportWorkflow(imported)).toThrow('Unsupported commerce platform');
    expect(() =>
      applyWorkflowOperations(workflow, [
        { type: 'update_node', id: 'start', config: { commercePlatform } },
      ]),
    ).toThrow('Unsupported commerce platform');
    const logs: RunLog[] = [];
    const runtime = createRuntime(imported, { onLog: (entry) => logs.push(entry) });
    runtime.start();
    document.dispatchEvent(
      Object.assign(new Event('shopify:cart:lines-update'), {
        action: 'add',
        lines: [{ merchandiseId: '123', quantity: 1 }],
        promise: Promise.resolve({ cart: { totalQuantity: 1 } }),
      }),
    );
    await Promise.resolve();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('Unsupported commerce platform. Only Shopify is supported.');
    await expect(runtime.run()).rejects.toThrow('Unsupported commerce platform');
    runtime.destroy();
    expect(imported.nodes[0].data.config.commercePlatform).toBe(commercePlatform);
  },
);

it('validates provider field types while keeping omitted Shopify defaults and old workflows unchanged', () => {
  for (const commercePlatform of [null, 42, {}, []]) {
    const invalid = structuredClone(workflow);
    invalid.nodes[0].data.config.commercePlatform =
      commercePlatform as StepConfig['commercePlatform'];
    expect(isWorkflow(invalid)).toBe(false);
    expect(validateWorkflow(invalid)).not.toEqual([]);
  }
  for (const config of [
    {},
    { event: 'page-load' },
    { event: 'click', selector: '#start' },
    { event: 'commerce-product-added-to-cart' },
  ] satisfies StepConfig[]) {
    const old = structuredClone(workflow);
    old.nodes[0].data.config = config;
    expect(isWorkflow(old)).toBe(true);
    expect(validateWorkflow(old)).toEqual([]);
    expect(JSON.parse(JSON.stringify(old)).nodes[0].data.config).toEqual(config);
  }
});
