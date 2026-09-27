import { expect, it } from 'vitest';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
} from '../../src/server/ai/workflow/ai';
import type { Workflow } from '../../src/server/ai/workflow/types';
import { validateWorkflow } from '../../src/server/ai/workflow/validation';

const base: Workflow = {
  version: 1,
  name: 'Cookies',
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

it.each([
  { cookieName: 'audience', cookieValue: 'returning' },
  { cookieName: 'audience', cookieValue: '', cookieDays: 0 },
  { cookieName: 'campaign%code', cookieValue: 'summer; token=a=b & café 🍪', cookieDays: 30 },
  { cookieName: '__Host-audience', cookieValue: 'returning', cookieDays: 400 },
])('creates and edits a cookie node through the tools and AI contracts: %j', async (config) => {
  const toolkit = createWorkflowTools(base, []);
  const add = toolkit.tools.find((item) => item.name === 'add_node')!;
  const update = toolkit.tools.find((item) => item.name === 'update_node')!;
  const added = JSON.parse(await add.invoke({ kind: 'cookie', config }));
  expect(added.ok).toBe(true);
  const id = added.operation.node.id;
  expect(toolkit.getWorkflow().nodes.at(-1)?.data).toMatchObject({
    kind: 'cookie',
    label: 'Set cookie',
    config,
  });
  const connect = toolkit.tools.find((item) => item.name === 'add_connection')!;
  expect(JSON.parse(await connect.invoke({ source: 'start', target: id })).ok).toBe(true);
  expect(validateWorkflow(toolkit.getWorkflow())).toEqual([]);
  expect(
    parseAIChatRequest({
      workflow: toolkit.getWorkflow(),
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [id],
    }).workflow.nodes.at(-1)?.data.config,
  ).toMatchObject(config);
  const response = parseAIChatResponse({ message: 'Added', operations: toolkit.getOperations() });
  expect(
    applyWorkflowOperations(base, response.operations).nodes.at(-1)?.data.config,
  ).toMatchObject(config);
  expect(
    JSON.parse(await update.invoke({ id, config: { cookieDays: 0, cookieValue: 'updated' } })).ok,
  ).toBe(true);
  expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toMatchObject({
    cookieName: config.cookieName,
    cookieValue: 'updated',
    cookieDays: 0,
  });
  expect(JSON.parse(await update.invoke({ id, config: { cookieName: 'bad; name' } })).ok).toBe(
    false,
  );
  expect(toolkit.getWorkflow().nodes.at(-1)?.data.config.cookieName).toBe(config.cookieName);
});

it.each([
  {},
  { cookieName: '', cookieValue: '' },
  { cookieName: 'bad name', cookieValue: 'x' },
  { cookieName: 'a=b', cookieValue: 'x' },
  { cookieName: 'a; Path=/', cookieValue: 'x' },
  { cookieName: '__Http-session', cookieValue: 'x' },
  { cookieName: 'audience' },
  { cookieName: 'audience', cookieValue: 42 },
  { cookieName: 'audience', cookieValue: '\uD800' },
  { cookieName: 'audience', cookieValue: 'x'.repeat(4096) },
  { cookieName: 'audience', cookieValue: 'x', cookieDays: -1 },
  { cookieName: 'audience', cookieValue: 'x', cookieDays: 1.5 },
  { cookieName: 'audience', cookieValue: 'x', cookieDays: 401 },
  { cookieName: 'audience', cookieValue: 'x', cookieDays: '30' },
  { cookieName: 'audience', cookieValue: 'x', cookieDays: null },
])('rejects invalid cookie edits: %j', (config) => {
  expect(() =>
    applyWorkflowOperations(base, [
      {
        type: 'add_node',
        node: {
          id: 'cookie',
          type: 'workflow',
          position: { x: 300, y: 0 },
          data: { kind: 'cookie', label: 'Set cookie', config },
        },
      },
    ]),
  ).toThrow();
});
