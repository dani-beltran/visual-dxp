import { generateText, streamText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyWorkflowOperations as applyClient,
  parseAIChatResponse as parseClient,
  requestAIChat,
} from '../../src/lib/ai';
import { AIServiceError, runLocalAgent } from '../../src/server/ai/agent';
import { CHAT_TIMEOUT_MS, handleChat } from '../../src/server/ai/http';
import * as workflowTools from '../../src/server/ai/tools';
import type { AIChatRequest } from '../../src/server/ai/workflow/ai';

vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

const config = { apiKey: 'test-private-key', model: 'test-model', origin: 'https://builder.test' };
const scroll = {
  event: 'scroll-thrashing',
  scrollDirectionChanges: 4,
  scrollThrashWindow: 2000,
  scrollMinDistance: 50,
};
function request(): AIChatRequest {
  return {
    messages: [{ role: 'user', content: 'Change the selected step for a scroll trashing' }],
    selectedNodeIds: ['start'],
    workflow: {
      version: 1,
      name: 'Offer',
      websiteUrl: 'https://site.test',
      includeSubpages: false,
      nodes: [
        {
          id: 'start',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'trigger',
            label: 'Start',
            config: {
              event: 'rage-click',
              selector: '#old',
              rageClickCount: 3,
              rageClickWindow: 1000,
              rageClickRadius: 50,
            },
          },
        },
        {
          id: 'offer',
          type: 'workflow',
          position: { x: 300, y: 0 },
          data: {
            kind: 'popover',
            label: 'Offer',
            config: { contentType: 'html', content: '<p>Offer</p>', width: 360 },
          },
        },
      ],
      edges: [{ id: 'edge', type: 'smoothstep', source: 'start', target: 'offer' }],
    },
  };
}
type Call = [name: string, input: unknown];
const read: Call = ['read_workflow', {}];
const edit: Call = ['update_node', { id: 'start', config: scroll }];
let toolkit: ReturnType<typeof workflowTools.createWorkflowTools>;
const createTools = workflowTools.createWorkflowTools;

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.mocked(generateText).mockReset();
  vi.mocked(streamText).mockReset();
  vi.spyOn(workflowTools, 'createWorkflowTools').mockImplementation((...args) => {
    toolkit = createTools(...args);
    return toolkit;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function provider(
  calls: Call[],
  streaming: boolean,
  finalText = 'Changed the selected trigger to scroll thrashing.',
) {
  let turn = 0;
  function result() {
    const index = turn++;
    const call = calls[index];
    return {
      content: [],
      responseMessages: [],
      text: call ? '' : finalText,
      finishReason: call ? 'tool-calls' : 'stop',
      toolCalls: call ? [{ toolCallId: `unique-${index}`, toolName: call[0], input: call[1] }] : [],
    };
  }
  if (streaming)
    vi.mocked(streamText).mockImplementation(() => {
      const output = result();
      return {
        ...output,
        fullStream: (async function* () {
          yield { type: 'finish' };
        })(),
      } as never;
    });
  else vi.mocked(generateText).mockImplementation(async () => result() as never);
  return () => (streaming ? vi.mocked(streamText).mock.calls : vi.mocked(generateText).mock.calls);
}

describe.each([false, true])('agent progress (streaming: %s)', (streaming) => {
  const emit = () => (streaming ? vi.fn() : undefined);

  it('delivers one no-op correction opportunity and then rejects read/update repetition despite new IDs and key ordering', async () => {
    const input = request();
    const before = structuredClone(input);
    const reordered: Call = [
      'update_node',
      {
        config: {
          scrollMinDistance: 50,
          scrollThrashWindow: 2000,
          event: 'scroll-thrashing',
          scrollDirectionChanges: 4,
        },
        id: 'start',
      },
    ];
    const invocations = provider([read, edit, read, reordered, read, edit], streaming);
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      status: 422,
      code: 'repeated_tool_loop',
      message: expect.stringContaining('No workflow changes were applied'),
    });
    expect(invocations()).toHaveLength(6);
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(invocations()[4][0]?.messages).toContainEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'unique-3',
          toolName: 'update_node',
          output: { type: 'text', value: expect.stringContaining('"changed":false') },
        },
      ],
    });
    expect(input).toEqual(before);
  });

  it('finishes a correct edit after reading again and replays exactly the server draft', async () => {
    const input = request();
    provider([read, edit, read], streaming);
    const response = await runLocalAgent(input, new AbortController().signal, config, emit());
    expect(response.operations).toEqual([{ type: 'update_node', id: 'start', config: scroll }]);
    expect(response.message).toBe('Changed the selected trigger to scroll thrashing.');
    expect(
      applyClient(input.workflow, parseClient(JSON.parse(JSON.stringify(response))).operations),
    ).toEqual(toolkit.getWorkflow());
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('allows a no-op followed by a final summary and resets repetition detection after actual intervening edits', async () => {
    const input = request();
    const different: Call = ['update_node', { id: 'start', config: { scrollMinDistance: 75 } }];
    const invocations = provider([read, edit, read, edit, different, edit, read, edit], streaming);
    const response = await runLocalAgent(input, new AbortController().signal, config, emit());
    expect(response.operations).toHaveLength(3);
    expect(toolkit.getWorkflow().nodes[0].data.config).toEqual(scroll);
    expect(invocations()).toHaveLength(9);
  });

  it('classifies invalid mutations separately from provider failure and discards earlier staged edits', async () => {
    const input = request();
    const invocations = provider(
      [
        read,
        edit,
        ['update_node', { id: 'start', config: { iterations: 3, content: 'private payload' } }],
      ],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      status: 422,
      code: 'invalid_workflow_edit',
      message: expect.stringContaining('No workflow changes were applied'),
    });
    expect(invocations()).toHaveLength(3);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('keeps staged operations private when final output is empty', async () => {
    const input = request();
    provider([read, edit], streaming, '');
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({ code: 'provider_failed' });
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('discards staged edits if the subsequent provider turn is interrupted', async () => {
    const input = request();
    provider([read, edit], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked streaming provider.');
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) =>
        ++turn < 3
          ? complete(...args)
          : ({
              fullStream: (async function* () {
                yield { type: 'text-delta', text: 'Unfinished' };
              })(),
            } as never),
      );
    } else {
      const complete = vi.mocked(generateText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked provider.');
      let turn = 0;
      vi.mocked(generateText).mockImplementation(async (...args) =>
        ++turn < 3
          ? complete(...args)
          : ({
              content: [],
              responseMessages: [],
              text: 'Unfinished',
              finishReason: 'length',
              toolCalls: [],
            } as never),
      );
    }
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({ code: 'provider_failed' });
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('preserves cancellation after staging an edit and before accepting a final response', async () => {
    const input = request();
    const controller = new AbortController();
    const cancelled = new DOMException('Cancelled', 'AbortError');
    provider([read, edit], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked streaming provider.');
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) => {
        if (++turn === 3) controller.abort(cancelled);
        return complete(...args);
      });
    } else {
      const complete = vi.mocked(generateText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked provider.');
      let turn = 0;
      vi.mocked(generateText).mockImplementation((...args) => {
        if (++turn === 3) controller.abort(cancelled);
        return complete(...args);
      });
    }
    await expect(runLocalAgent(input, controller.signal, config, emit())).rejects.toBe(cancelled);
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('returns no operations when the HTTP deadline expires after staging, even if the provider ignores cancellation', async () => {
    vi.useFakeTimers();
    const input = request();
    let stalled!: () => void;
    const pending = new Promise<void>((resolve) => {
      stalled = resolve;
    });
    provider([read, edit], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked streaming provider.');
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) =>
        ++turn < 3
          ? complete(...args)
          : ({
              fullStream: (async function* () {
                stalled();
                await new Promise(() => {});
              })(),
            } as never),
      );
    } else {
      const complete = vi.mocked(generateText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked provider.');
      let turn = 0;
      vi.mocked(generateText).mockImplementation((...args) => {
        if (++turn < 3) return complete(...args);
        stalled();
        return new Promise(() => {});
      });
    }
    const response = handleChat(
      new Request('https://builder.test/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DXP-AI-Override': 'browser',
          'X-DXP-OpenAI-Key': config.apiKey,
          'X-DXP-OpenAI-Model': config.model,
          Accept: streaming ? 'application/x-ndjson' : 'application/json',
        },
        body: JSON.stringify(input),
      }),
    );
    await pending;
    await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS);
    const completed = await response;
    const body = await completed.text();
    expect(body).not.toContain('operations');
    if (streaming) expect(JSON.parse(body).type).toBe('error');
    else expect(completed.status).toBe(504);
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['invalid_workflow_edit', 'repeated_tool_loop'])(
    'reports sanitized %s through HTTP and the browser client without a result event',
    async (code) => {
      const input = request();
      const calls =
        code === 'invalid_workflow_edit'
          ? [
              read,
              edit,
              [
                'update_node',
                { id: 'start', config: { iterations: 3, content: 'private provider payload' } },
              ] as Call,
            ]
          : [read, edit, read, edit, read, edit];
      provider(calls, streaming);
      const response = await handleChat(
        new Request('https://builder.test/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DXP-AI-Override': 'browser',
            'X-DXP-OpenAI-Key': config.apiKey,
            'X-DXP-OpenAI-Model': config.model,
            Accept: streaming ? 'application/x-ndjson' : 'application/json',
          },
          body: JSON.stringify(input),
        }),
      );
      const body = await response.text();
      const failure = JSON.parse(body.trim());
      expect(failure.code).toBe(code);
      expect(failure.error).toContain('No workflow changes were applied');
      expect(body).not.toContain(config.apiKey);
      expect(body).not.toContain('private provider payload');
      expect(body).not.toContain('operations');
      if (streaming) expect(failure.type).toBe('error');
      else expect(response.status).toBe(422);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(body, { status: response.status, headers: response.headers }),
          ),
      );
      await expect(
        requestAIChat(
          { endpoint: 'https://builder.test/api/ai/chat' },
          input,
          undefined,
          config,
          emit(),
        ),
      ).rejects.toMatchObject({ code, message: failure.error });
      expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
    },
  );

  it('uses fixed messages for recognized failure codes even if an upstream supplies unsafe details', async () => {
    const input = request();
    const response = await handleChat(
      new Request('https://builder.test/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: streaming ? 'application/x-ndjson' : 'application/json',
        },
        body: JSON.stringify(input),
      }),
      async () => {
        throw new AIServiceError(422, 'private payload and credentials', 'repeated_tool_loop');
      },
    );
    const body = await response.text();
    expect(body).toContain('repeated_tool_loop');
    expect(body).not.toContain('private payload');
    expect(body).toContain('No workflow changes were applied');
    const unsafe = streaming
      ? `${JSON.stringify({
          type: 'error',
          code: 'repeated_tool_loop',
          error: 'raw internal exception',
        })}\n`
      : JSON.stringify({ code: 'repeated_tool_loop', error: 'raw internal exception' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(unsafe, {
          status: streaming ? 200 : 422,
          headers: { 'Content-Type': streaming ? 'application/x-ndjson' : 'application/json' },
        }),
      ),
    );
    await expect(
      requestAIChat(
        { endpoint: 'https://builder.test/api/ai/chat' },
        input,
        undefined,
        config,
        emit(),
      ),
    ).rejects.toMatchObject({
      code: 'repeated_tool_loop',
      message: expect.stringContaining('No workflow changes were applied'),
    });
  });
});
