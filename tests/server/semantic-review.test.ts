import { generateText, streamText } from 'ai';
import { beforeEach, expect, it, vi } from 'vitest';
import { parseAIChatRequest, parseAIChatResponse } from '../../src/lib/ai';
import { runLocalAgent } from '../../src/server/ai/agent';
import { reviewVersion } from '../../src/server/ai/review';
import {
  type AIChatRequest,
  parseAIChatRequest as parseServerRequest,
} from '../../src/server/ai/workflow/ai';

vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));
const config = { apiKey: 'private-test-key', model: 'test', origin: 'https://builder.test' };
const input = (): AIChatRequest => ({
  messages: [{ role: 'user', content: 'Rename the trigger to Welcome.' }],
  selectedNodeIds: [],
  workflow: {
    version: 1,
    name: 'Test',
    websiteUrl: 'https://site.test',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: { event: 'page-load' } },
      },
    ],
    edges: [],
  },
});
const pass = { summary: 'Renamed the trigger to Welcome.', findings: [], question: '' };
const finding = {
  category: 'design',
  nodeIds: ['start'],
  evidence: 'The event fires on page load.',
  consequence: 'It counts views rather than purchases.',
  alternative: 'Track offer views here and purchases only after a confirmed purchase signal.',
};
function result(text = '', calls: [string, unknown][] = []) {
  const toolCalls = calls.map(([toolName, input], i) => ({
    toolName,
    input,
    toolCallId: `call-${i}`,
  }));
  return {
    text,
    toolCalls,
    finishReason: calls.length ? 'tool-calls' : 'stop',
    content: [{ type: 'text', text }],
    responseMessages: calls.length
      ? [{ role: 'assistant', content: toolCalls.map((call) => ({ type: 'tool-call', ...call })) }]
      : [],
  };
}
function setup(turns: ReturnType<typeof result>[], reviews: unknown[] = [pass]) {
  const reviewInputs: Record<string, unknown>[] = [];
  vi.mocked(generateText).mockImplementation(async (options) => {
    if (String(options.system).startsWith('You are a read-only workflow reviewer.')) {
      expect(options).not.toHaveProperty('tools');
      reviewInputs.push(JSON.parse(String(options.messages?.[0].content)));
      const review = reviews.shift();
      if (review instanceof Error) throw review;
      return result(typeof review === 'string' ? review : JSON.stringify(review)) as never;
    }
    const turn = turns.shift();
    if (!turn) throw new Error('Unexpected editor call');
    return turn as never;
  });
  vi.mocked(streamText).mockImplementation(() => {
    const turn = turns.shift();
    if (!turn) throw new Error('Unexpected editor call');
    return {
      ...turn,
      fullStream: (async function* () {
        if (turn.text) yield { type: 'text-delta', text: turn.text };
        yield { type: 'finish' };
      })(),
    } as never;
  });
  return reviewInputs;
}
beforeEach(() => {
  vi.mocked(generateText).mockReset();
  vi.mocked(streamText).mockReset();
});
const rename = result('', [['update_node', { id: 'start', label: 'Welcome' }]]);

it.each(['text', 'finish', 'local-marker'] as const)(
  'requires review on the %s completion path',
  async (path) => {
    const request = input();
    const turns =
      path === 'local-marker'
        ? [
            result('', [['read_workflow', {}]]),
            rename,
            result('<tool_call><function=finish_workflow></function></tool_call>'),
          ]
        : [
            rename,
            path === 'finish'
              ? result('', [['finish_workflow', {}]])
              : result('Unreviewed success'),
          ];
    const reviews = setup(turns);
    const ready = vi.fn(() => expect(reviews).toHaveLength(1));
    const text = vi.fn();
    const response = await runLocalAgent(
      request,
      new AbortController().signal,
      path === 'local-marker'
        ? { ...config, provider: 'local', baseURL: 'http://127.0.0.1:11434/v1' }
        : config,
      text,
      undefined,
      ready,
    );
    expect(response.message).toBe(pass.summary);
    expect(reviews[0]).toMatchObject({ draft: { nodes: [{ data: { label: 'Welcome' } }] } });
    expect(ready).toHaveBeenCalledOnce();
    expect(text.mock.calls.flat().join('')).toBe(pass.summary);
    expect(request.workflow.nodes[0].data.label).toBe('Start');
  },
);

it('reviews every mutation in a batch even when finish appears before an edit', async () => {
  const reviews = setup([
    result('', [
      ['finish_workflow', {}],
      ['update_node', { id: 'start', label: 'Welcome' }],
    ]),
  ]);
  await runLocalAgent(input(), new AbortController().signal, config, vi.fn(), undefined, vi.fn());
  expect(reviews[0]).toMatchObject({ draft: { nodes: [{ data: { label: 'Welcome' } }] } });
});

it('returns design issues and an unapplied alternative with the reviewed version', async () => {
  setup(
    [rename, result('Done')],
    [{ ...pass, findings: [finding], question: 'Would you like me to make that change?' }],
  );
  const response = await runLocalAgent(input(), new AbortController().signal, config);
  expect(response.operations).toEqual([{ type: 'update_node', id: 'start', label: 'Welcome' }]);
  expect(response.message).toContain(finding.consequence);
  expect(response.message).toContain(finding.alternative);
  expect(response.message).toContain('Would you like');
  const draft = input().workflow;
  draft.nodes[0].data.label = 'Welcome';
  expect(response.reviewProposal?.workflowVersion).toBe(reviewVersion(draft));
  expect(parseAIChatResponse(response).reviewProposal).toEqual(response.reviewProposal);
  const followUp = parseAIChatRequest({
    ...input(),
    messages: [
      { role: 'assistant', content: response.message, reviewProposal: response.reviewProposal },
      { role: 'user', content: 'Yes, do that.' },
    ],
  });
  expect(followUp.messages[0].reviewProposal).toEqual(response.reviewProposal);
  setup([result('Current canvas differs')]);
  await runLocalAgent(parseServerRequest(followUp), new AbortController().signal, config);
  const options = vi.mocked(generateText).mock.calls.at(-2)?.[0];
  expect(JSON.stringify(options?.messages)).toContain('currentWorkflowVersion');
  expect(JSON.stringify(options?.messages)).toContain('reassess');
});

it('repairs implementation mistakes and reviews the new draft before committing', async () => {
  const reviews = setup(
    [
      rename,
      result('Done'),
      result('', [['update_node', { id: 'start', label: 'Correct' }]]),
      result('Done'),
    ],
    [{ ...pass, findings: [{ ...finding, category: 'implementation' }] }, pass],
  );
  const ready = vi.fn(() => expect(reviews).toHaveLength(2));
  const response = await runLocalAgent(
    input(),
    new AbortController().signal,
    config,
    vi.fn(),
    undefined,
    ready,
  );
  expect(reviews[1]).toMatchObject({ draft: { nodes: [{ data: { label: 'Correct' } }] } });
  expect(response.operations).toHaveLength(2);
  expect(ready).toHaveBeenCalledOnce();
});

it('bounds implementation repairs without committing a known defective draft', async () => {
  const failure = { ...pass, findings: [{ ...finding, category: 'implementation' }] };
  const reviews = setup(
    [rename, result('Done'), result('Done'), result('Done')],
    [failure, failure, failure],
  );
  const ready = vi.fn();
  await expect(
    runLocalAgent(input(), new AbortController().signal, config, vi.fn(), undefined, ready),
  ).rejects.toMatchObject({ code: 'semantic_review_failed' });
  expect(reviews).toHaveLength(3);
  expect(ready).not.toHaveBeenCalled();
});

it.each([
  'not JSON',
  new Error('offline'),
  { ...pass, findings: [finding], question: '' },
  { ...pass, findings: [{ ...finding, nodeIds: ['invented'] }], question: 'Apply?' },
  { ...pass, summary: 'private-test-key' },
])('fails closed on invalid or unavailable reviews (%s)', async (review) => {
  setup([rename, result('Unreviewed success')], [review]);
  const ready = vi.fn();
  const text = vi.fn();
  await expect(
    runLocalAgent(input(), new AbortController().signal, config, text, undefined, ready),
  ).rejects.toThrow();
  expect(ready).not.toHaveBeenCalled();
  expect(text).not.toHaveBeenCalled();
});

it('does not review or commit after unresolved technical errors', async () => {
  const reviews = setup([
    result('', [['update_node', { id: 'missing', label: 'Invalid' }]]),
    result('Done'),
  ]);
  const ready = vi.fn();
  await expect(
    runLocalAgent(input(), new AbortController().signal, config, vi.fn(), undefined, ready),
  ).rejects.toThrow();
  expect(reviews).toHaveLength(0);
  expect(ready).not.toHaveBeenCalled();
});

it('asks for essential context without generating alternative mutations', async () => {
  setup(
    [result('Need context')],
    [
      {
        ...pass,
        summary: 'No changes made.',
        findings: [
          { ...finding, category: 'context', evidence: 'The purchase signal is unspecified.' },
        ],
        question: 'Which confirmed purchase event should this use?',
      },
    ],
  );
  const response = await runLocalAgent(input(), new AbortController().signal, config);
  expect(response.operations).toEqual([]);
  expect(response.message).toContain('Which confirmed purchase event');
});

it('does not commit if cancellation arrives during review', async () => {
  const controller = new AbortController();
  setup([rename, result('Done')]);
  const implementation = vi.mocked(generateText).getMockImplementation();
  vi.mocked(generateText).mockImplementation(async (options) => {
    if (!implementation) throw new Error('Missing mock');
    const output = await implementation(options);
    if (String(options.system).startsWith('You are a read-only')) controller.abort();
    return output;
  });
  const ready = vi.fn();
  await expect(
    runLocalAgent(input(), controller.signal, config, vi.fn(), undefined, ready),
  ).rejects.toThrow();
  expect(ready).not.toHaveBeenCalled();
});
