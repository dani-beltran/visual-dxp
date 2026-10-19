import { generateText, streamText } from 'ai';
import { beforeEach, expect, it, vi } from 'vitest';
import { parseAIChatRequest, parseAIChatResponse } from '../../src/lib/ai';
import { runLocalAgent } from '../../src/server/ai/agent';
import { reviewVersion, reviewWorkflow } from '../../src/server/ai/review';
import { experimentReviewFacts, reviewBehaviorFacts } from '../../src/server/ai/reviewFacts';
import {
  type AIChatRequest,
  parseAIChatRequest as parseServerRequest,
} from '../../src/server/ai/workflow/ai';
import { experimentExplanationRequest, experimentKeyRequest } from './headline-experiment-fixture';

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
  // Every editing/review scenario first reads the authoritative canvas.
  if (turns[0]?.toolCalls[0]?.toolName !== 'read_workflow')
    turns.unshift(result('', [['read_workflow', {}]]));
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

it('corrects the logged successful implementation finding with a null alternative', async () => {
  const nodeId = 'delay-f1aed7f1-ce39-4f6d-9a3d-e0cb3945d22e';
  const loggedReview = {
    summary:
      'Draft correctly implements adding a 3-second delay after the existing 2-second delay to achieve a 5-second total before the welcome popover appears. Execution order is valid (trigger → 2s delay → 3s delay → popover) with no cycles. The original direct edge from the first delay to the popover was properly removed and rewired through the new intermediate delay node.',
    findings: [
      {
        category: 'implementation',
        nodeIds: [nodeId],
        evidence:
          'New delay node added with config.duration: 3000, positioned after the first delay and before the popover. Edges correctly connect trigger→delay1, delay1→delay2, delay2→popover.',
        consequence: 'Total wait time is now 5 seconds (2s + 3s) as requested by user.',
        alternative: null,
      },
    ],
    question: '',
  };
  const corrected = { summary: loggedReview.summary, findings: [], question: '' };
  const request = input();
  request.messages = [
    {
      role: 'user',
      content: 'add a 3 seconds delay node after the delay to have 5 seconds delay in total',
    },
  ];
  request.workflow.nodes.push(
    {
      id: 'delay',
      type: 'workflow',
      position: { x: 300, y: 0 },
      data: { kind: 'delay', label: '2 Second Delay', config: { duration: 2000 } },
    },
    {
      id: 'popover',
      type: 'workflow',
      position: { x: 600, y: 0 },
      data: {
        kind: 'popover',
        label: 'Welcome',
        config: { contentType: 'html', content: '<p>Welcome!</p>', position: 'center', width: 400 },
      },
    },
  );
  request.workflow.edges = [
    { id: 'first', source: 'start', target: 'delay' },
    { id: 'old', source: 'delay', target: 'popover' },
  ];
  const draft = structuredClone(request.workflow);
  const node = {
    id: nodeId,
    type: 'workflow' as const,
    position: { x: 450, y: 0 },
    data: { kind: 'delay' as const, label: '3 Second Delay', config: { duration: 3000 } },
  };
  draft.nodes.push(node);
  draft.edges = [
    draft.edges[0],
    { id: 'second', source: 'delay', target: nodeId },
    { id: 'third', source: nodeId, target: 'popover' },
  ];
  const reviews = setup([], [loggedReview, corrected]);
  const response = await reviewWorkflow({
    model: {} as never,
    config: {
      provider: 'local',
      source: 'browser',
      apiKey: '',
      model: 'test',
      baseURL: 'http://127.0.0.1:11434/v1',
    },
    signal: new AbortController().signal,
    request,
    draft,
    operations: [
      { type: 'add_node', node },
      { type: 'remove_edge', id: 'old' },
      ...draft.edges.slice(1).map((edge) => ({ type: 'add_edge' as const, edge })),
    ],
    runtimeInstructions: '',
  });
  expect(response).toEqual(corrected);
  expect(reviews).toHaveLength(2);
  expect(reviews[1]).toEqual(reviews[0]);
  expect(reviews[0].technicalIssues).toEqual([]);
  const options = vi.mocked(generateText).mock.calls[1][0];
  expect(options.system).toContain('Response JSON Schema');
  expect(options.system).toContain('never list successful changes');
  expect(options.messages?.[1].content).toContain('findings.0.alternative');
});

it('retries invalid review JSON without replaying edits or committing early', async () => {
  const reviews = setup([rename, result('', [['finish_workflow', {}]])], ['not JSON', pass]);
  const ready = vi.fn(() => expect(reviews).toHaveLength(2));
  const response = await runLocalAgent(
    input(),
    new AbortController().signal,
    config,
    vi.fn(),
    undefined,
    ready,
  );
  expect(response.operations).toEqual([{ type: 'update_node', id: 'start', label: 'Welcome' }]);
  expect(reviews[1]).toEqual(reviews[0]);
  expect(ready).toHaveBeenCalledOnce();
});

it('stops after one review correction attempt and never commits invalid reviews', async () => {
  const reviews = setup([rename, result('Done')], ['not JSON', 'still not JSON', pass]);
  const ready = vi.fn();
  await expect(
    runLocalAgent(input(), new AbortController().signal, config, vi.fn(), undefined, ready),
  ).rejects.toThrow();
  expect(reviews).toHaveLength(2);
  expect(ready).not.toHaveBeenCalled();
});

it.each([new Error('offline'), { ...pass, summary: 'private-test-key' }])(
  'does not retry provider failures or unsafe responses',
  async (review) => {
    const reviews = setup([rename, result('Done')], [review, pass]);
    const ready = vi.fn();
    await expect(
      runLocalAgent(input(), new AbortController().signal, config, vi.fn(), undefined, ready),
    ).rejects.toThrow();
    expect(reviews).toHaveLength(1);
    expect(ready).not.toHaveBeenCalled();
  },
);

it('reviews positioned insertion and runs layout again after a structural semantic repair', async () => {
  const request = input();
  request.messages[0].content = 'Insert a delay, then connect the final step to Other.';
  request.workflow.nodes.push(
    ...[
      ['wait', 300, 0],
      ['end', 600, 0],
      ['other', 2000, 500],
    ].map(([id, x, y]) => ({
      id: String(id),
      type: 'workflow' as const,
      position: { x: Number(x), y: Number(y) },
      data: { kind: 'delay' as const, label: String(id), config: { duration: 10 } },
    })),
  );
  request.workflow.edges = [
    { id: 'e0', source: 'start', target: 'wait' },
    { id: 'e1', source: 'wait', target: 'end' },
  ];
  const reviews = setup(
    [
      result('', [['insert_node', { connectionId: 'e0', kind: 'delay' }]]),
      result('Done'),
      result('', [['update_connection', { id: 'e1', source: 'other' }]]),
      result('Repaired'),
    ],
    [{ ...pass, findings: [{ ...finding, category: 'implementation' }] }, pass],
  );
  const ready = vi.fn();
  const response = await runLocalAgent(
    request,
    new AbortController().signal,
    config,
    vi.fn(),
    undefined,
    ready,
  );
  const first = reviews[0].draft as AIChatRequest['workflow'];
  const second = reviews[1].draft as AIChatRequest['workflow'];
  expect(first.nodes.find((node) => node.id === 'end')?.position.x).toBe(900);
  expect(second.nodes.find((node) => node.id === 'end')?.position.x).toBe(2300);
  expect(response.operations).toContainEqual({
    type: 'update_node',
    id: 'end',
    position: { x: 2300, y: 0 },
  });
  expect(ready).toHaveBeenCalledOnce();
});

it('blocks review and commitment when the final structural layout violates an explicit position', async () => {
  const request = input();
  request.workflow.nodes.push({
    id: 'wait',
    type: 'workflow',
    position: { x: 10, y: 0 },
    data: { kind: 'delay', label: 'Wait', config: { duration: 10 } },
  });
  const reviews = setup([
    result('', [['update_node', { id: 'wait', position: { x: 10, y: 0 } }]]),
    result('', [['add_connection', { source: 'start', target: 'wait' }]]),
    result('Done'),
  ]);
  const ready = vi.fn();
  await expect(
    runLocalAgent(request, new AbortController().signal, config, vi.fn(), undefined, ready),
  ).rejects.toThrow();
  expect(reviews).toHaveLength(0);
  expect(ready).not.toHaveBeenCalled();
});

it('grounds a headline experiment explanation in runtime facts without creating a proposal or mutation', async () => {
  const request = experimentExplanationRequest();
  const before = structuredClone(request);
  const explanation = {
    summary:
      'On page load, this 50/50 A/B test selects one headline: Hola or Adios on h1. The default node ID keeps the assignment in browser storage on the website origin. Version changes and redeployments alone do not reset it.',
    findings: [],
    question: '',
  };
  const reviews = setup([result('Unreviewed recommendation to add a key')], [explanation]);
  const response = await runLocalAgent(request, new AbortController().signal, config);
  expect(response).toEqual({ message: explanation.summary, operations: [] });
  expect(response.reviewProposal).toBeUndefined();
  expect(request).toEqual(before);
  const id = request.workflow.nodes[1].id;
  expect(reviews[0].experimentFacts).toEqual([
    {
      nodeId: id,
      usesNodeId: true,
      storageKey: `visual-dxp-experiment-v1:${id}`,
      previousStorageKey: `visual-dxp-experiment-v1:${id}`,
      storageKeyChanged: false,
      trafficPercent: { a: 50, b: 50 },
      branchTargets: {
        a: [request.workflow.nodes[2].id],
        b: [request.workflow.nodes[3].id],
      },
    },
  ]);
  const options = vi.mocked(generateText).mock.calls.at(-1)?.[0];
  expect(options?.system).toContain('A read-only explanation request');
  expect(options?.system).toContain('unless it demonstrates a material defect');
  expect(options?.system).toContain('Do not append unsupported recommendations in summary');
  expect(options?.system).toContain(JSON.stringify(reviewBehaviorFacts));
  expect(options?.system).toContain(
    'workflow version changes and redeployments alone do not reset',
  );
  expect(options?.system).toContain(
    'Notes cannot track events; exposure alone is not a confirmed conversion',
  );
});

it('allows the accepted custom key edit and supplies its actual assignment-bucket consequence to review', async () => {
  const request = experimentKeyRequest();
  const id = request.selectedNodeIds[0];
  const changed = {
    summary:
      'Added headline-test-v1. It selects a different assignment bucket, so visitors may receive new assignments; it does not migrate the old bucket.',
    findings: [],
    question: '',
  };
  const reviews = setup(
    [
      result('', [['update_node', { id, config: { experimentKey: 'headline-test-v1' } }]]),
      result('Done'),
    ],
    [changed],
  );
  const response = await runLocalAgent(request, new AbortController().signal, config);
  expect(response.operations).toEqual([
    { type: 'update_node', id, config: { experimentKey: 'headline-test-v1' } },
  ]);
  expect(response.message).toBe(changed.summary);
  expect(response.reviewProposal).toBeUndefined();
  expect(reviews[0].experimentFacts).toEqual([
    expect.objectContaining({
      nodeId: id,
      usesNodeId: false,
      storageKey: 'visual-dxp-experiment-v1:headline-test-v1',
      previousStorageKey: `visual-dxp-experiment-v1:${id}`,
      storageKeyChanged: true,
    }),
  ]);
});

it('does not invent a bucket reset for whitespace-equivalent keys, a label change, or a reporting version change', () => {
  const original = experimentKeyRequest().workflow;
  original.nodes[1].data.config.experimentKey = ' headline-test-v1 ';
  const draft = structuredClone(original);
  draft.name = 'Redeployed';
  draft.analytics = { provider: 'none', workflowVersion: '2' };
  draft.nodes[1].data.label = 'New label';
  draft.nodes[1].data.config.experimentKey = 'headline-test-v1';
  expect(experimentReviewFacts(original, draft)[0]).toMatchObject({
    storageKeyChanged: false,
  });
  draft.nodes[1].id = 'replacement';
  expect(experimentReviewFacts(original, draft)[0]).toMatchObject({
    storageKeyChanged: null,
    usesNodeId: false,
  });
  expect(experimentReviewFacts(original, draft)[0].storageKey).toBe(
    'visual-dxp-experiment-v1:headline-test-v1',
  );
});

it.each([
  [
    'Can notes record impressions or conversions for these headlines?',
    'Notes are canvas annotations and never execute or collect analytics.',
  ],
  [
    'Does displaying Hola or Adios prove a conversion?',
    'It establishes exposure only. A conversion needs a signal confirming the intended outcome.',
  ],
])(
  'answers tracking questions without proposing unsupported changes: %s',
  async (question, answer) => {
    const request = experimentExplanationRequest();
    request.messages = [{ role: 'user', content: question }];
    const reviews = setup(
      [result('Provisional answer')],
      [{ summary: answer, findings: [], question: '' }],
    );
    const response = await runLocalAgent(request, new AbortController().signal, config);
    expect(response).toEqual({ message: answer, operations: [] });
    expect(reviews[0].conversation).toEqual(request.messages);
    expect(vi.mocked(generateText).mock.calls.at(-1)?.[0].system).toContain(
      JSON.stringify(reviewBehaviorFacts),
    );
  },
);
