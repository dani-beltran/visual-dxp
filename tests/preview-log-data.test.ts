import { expect, it } from 'vitest';
import { readPreviewMessage } from '../src/components/IsolatedPreview/previewMessages';
import type { Workflow } from '../src/lib/types';

const workflow: Workflow = {
  version: 1,
  name: 'Log data',
  websiteUrl: '/demo-site.html',
  nodes: [
    {
      id: 'signup',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind: 'popover', label: 'Signup', config: {} },
    },
  ],
  edges: [],
};
const read = (log: Record<string, unknown>) =>
  readPreviewMessage(
    {
      type: 'log',
      runId: 'run',
      log: { nodeId: 'signup', status: 'success', message: 'Done', ...log },
    },
    { workflow, runId: 'run', picking: false, stepLabel: 'Step', now: 1 },
  );

it('keeps bounded text data on log entries for debugging', () => {
  expect(read({ data: '{\n  "email": "ada@example.com"\n}' })).toEqual({
    type: 'log',
    log: {
      nodeId: 'signup',
      label: 'Signup',
      status: 'success',
      message: 'Done',
      data: '{\n  "email": "ada@example.com"\n}',
      timestamp: 1,
    },
  });
});

it.each([
  ['non-text data', { email: 'ada@example.com' }],
  ['oversized data', 'x'.repeat(10001)],
])('drops %s but keeps the log entry', (_name, data) => {
  const message = read({ data });
  expect(message).toMatchObject({ type: 'log', log: { message: 'Done' } });
  expect(message?.type === 'log' && 'data' in message.log).toBe(false);
});
