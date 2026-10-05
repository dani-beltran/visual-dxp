import { afterEach, expect, it, vi } from 'vitest';
import { requestAIChat } from '../../src/lib/ai';
import { safeTextEmitter } from '../../src/lib/aiStream';
import { runLocalAgent, runRemoteAgent } from '../../src/server/ai/agent';
import { graph } from '../../src/server/ai/graph';
import { handleChat } from '../../src/server/ai/http';

const input = {
  messages: [{ role: 'user' as const, content: 'Explain this workflow' }],
  selectedNodeIds: [],
  workflow: {
    version: 1 as const,
    name: 'Test',
    websiteUrl: 'https://site.test',
    nodes: [],
    edges: [],
  },
};
const encoder = new TextEncoder();
function channel() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  return {
    body,
    writeBytes: (bytes: Uint8Array) => controller.enqueue(bytes),
    write: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('delivers text through HTTP and the client before the final validated result', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const response = await handleChat(
    new Request('https://builder.test/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify(input),
    }),
    async (_input, _signal, _config, emit, reasoning) => {
      reasoning?.('Checking the workflow.');
      emit?.('Hello ');
      await pending;
      emit?.('world');
      return { message: 'Hello world', operations: [] };
    },
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const text: string[] = [];
  const reasoning: string[] = [];
  const result = requestAIChat(
    { endpoint: 'https://builder.test/api/ai/chat' },
    input,
    undefined,
    undefined,
    (chunk) => text.push(chunk),
    (chunk) => reasoning.push(chunk),
  );
  await vi.waitFor(() => expect(text).toEqual(['Hello ']));
  expect(reasoning).toEqual(['Checking the workflow.']);
  finish();
  expect(await result).toEqual({ message: 'Hello world', operations: [] });
  expect(text).toEqual(['Hello ', 'world']);
});

it('rejects a truncated stream without returning workflow changes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('{"type":"text","text":"Partial"}\n', {
        headers: { 'Content-Type': 'application/x-ndjson' },
      }),
    ),
  );
  await expect(
    requestAIChat(
      { endpoint: 'https://builder.test/api/ai/chat' },
      input,
      undefined,
      undefined,
      () => {},
    ),
  ).rejects.toThrow('interrupted');
});

it('cancels the agent when the response reader is cancelled', async () => {
  let signal!: AbortSignal;
  const response = await handleChat(
    new Request('https://builder.test/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify(input),
    }),
    async (_input, current, _config, emit) => {
      signal = current;
      emit?.('Working');
      return new Promise(() => {});
    },
  );
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  expect(signal.aborted).toBe(true);
});

it('does not expose a credential split across text deltas', () => {
  const text: string[] = [];
  const emit = safeTextEmitter('secret-key', (chunk) => text.push(chunk));
  emit('Hello sec');
  expect(text).toEqual(['Hello ']);
  expect(() => emit('ret-key')).toThrow('Unsafe');
  expect(text.join('')).toBe('Hello ');
});

it('streams deployment custom events before receiving the final state', async () => {
  vi.stubEnv('LANGGRAPH_API_URL', 'https://agent.test');
  const source = channel();
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(source.body, { headers: { 'Content-Type': 'text/event-stream' } }),
    );
  vi.stubGlobal('fetch', fetcher);
  const chunks: string[] = [];
  const reasoning: string[] = [];
  const result = runRemoteAgent(
    input,
    new AbortController().signal,
    (text) => chunks.push(text),
    (text) => reasoning.push(text),
  );
  source.write('event: custom\ndata: {"type":"reasoning","text":"Checking."}\n\n');
  source.write('event: custom\ndata: {"type":"text","text":"Hola"}\n\n');
  await vi.waitFor(() => expect(chunks).toEqual(['Hola']));
  expect(reasoning).toEqual(['Checking.']);
  source.write('event: values\ndata: {"response":{"message":"Hola","operations":[]}}\n\n');
  source.close();
  expect((await result).message).toBe('Hola');
  expect(String(fetcher.mock.calls[0][0])).toBe('https://agent.test/runs/stream');
});

it.each([false, true])(
  'streams provider tokens before generation finishes (graph: %s)',
  async (useGraph) => {
    vi.stubEnv('OPENAI_API_KEY', 'test-private-key');
    const source = channel();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(source.body, { headers: { 'Content-Type': 'text/event-stream' } }),
        ),
    );
    const chunks: string[] = [];
    const reasoning: string[] = [];
    const result = useGraph
      ? (async () => {
          const events = await graph.stream(
            { request: input },
            {
              streamMode: ['custom', 'values'],
              configurable: { streamAIText: true },
            },
          );
          let message = '';
          for await (const [mode, value] of events) {
            if (mode === 'custom' && value.type === 'text') chunks.push(value.text);
            if (mode === 'custom' && value.type === 'reasoning') reasoning.push(value.text);
            if (mode === 'values' && value.response) message = value.response.message;
          }
          return { message };
        })()
      : runLocalAgent(
          input,
          new AbortController().signal,
          undefined,
          (text) => chunks.push(text),
          (text) => reasoning.push(text),
        );
    const event = (value: unknown) => source.write(`data: ${JSON.stringify(value)}\n\n`);
    event({ type: 'response.created', response: { id: 'resp-1', created_at: 1, model: 'test' } });
    event({
      type: 'response.output_item.added',
      output_index: 1,
      item: { type: 'reasoning', id: 'reason-1', summary: [], encrypted_content: 'opaque-secret' },
    });
    event({
      type: 'response.reasoning_summary_text.delta',
      item_id: 'reason-1',
      output_index: 1,
      summary_index: 0,
      delta: 'Checking connections.',
    });
    await vi.waitFor(() => expect(reasoning).toEqual(['Checking connections.']));
    expect(chunks).toEqual([]);
    event({
      type: 'response.output_item.done',
      output_index: 1,
      item: {
        type: 'reasoning',
        id: 'reason-1',
        summary: [{ type: 'summary_text', text: 'Checking connections.' }],
        encrypted_content: 'opaque-secret',
      },
    });
    event({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: 'msg-1', role: 'assistant', content: [] },
    });
    event({
      type: 'response.output_text.delta',
      item_id: 'msg-1',
      output_index: 0,
      content_index: 0,
      delta: 'Hello',
    });
    await vi.waitFor(() => expect(chunks).toEqual(['Hello']));
    event({
      type: 'response.completed',
      response: {
        id: 'resp-1',
        status: 'completed',
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      },
    });
    source.close();
    expect((await result).message).toBe('Hello');
  },
);

it('reads fragmented UTF-8 and JSON records without waiting for EOF', async () => {
  const source = channel();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(source.body, { headers: { 'Content-Type': 'application/x-ndjson' } }),
      ),
  );
  const chunks: string[] = [];
  const result = requestAIChat(
    { endpoint: 'https://builder.test/api/ai/chat' },
    input,
    undefined,
    undefined,
    (text) => chunks.push(text),
  );
  source.write('{"type":"text",');
  const bytes = encoder.encode('"text":"Hola 🌍"}\n');
  const split = bytes.indexOf(0xf0) + 2;
  source.writeBytes(bytes.slice(0, split));
  source.writeBytes(bytes.slice(split));
  await vi.waitFor(() => expect(chunks).toEqual(['Hola 🌍']));
  source.write('{"type":"result","response":{"message":"Hola 🌍","operations":[]}}\n');
  source.close();
  expect((await result).message).toBe('Hola 🌍');
});

it('rejects invalid staged operations after partial text instead of sending a result', async () => {
  const response = await handleChat(
    new Request('https://builder.test/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify(input),
    }),
    async (_input, _signal, _config, emit) => {
      emit?.('Editing');
      return { message: 'Done', operations: [{ type: 'remove_node', id: 'missing' }] };
    },
  );
  const events = (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(events.map((event) => event.type)).toEqual(['text', 'error']);
});

function sse(events: unknown[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

it.each(['reasoning_content', 'reasoning'])(
  'streams local %s separately across the required tool call',
  async (field) => {
    let turn = 0;
    const chunks: string[] = [];
    const summaries: string[] = [];
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.reasoning).toEqual({ summary: 'auto' });
      const first = turn++ === 0;
      const chunk = (delta: unknown, finish_reason: string | null = null) => ({
        id: `chat-${turn}`,
        model: 'local-model',
        created: 1,
        choices: [{ index: 0, delta, finish_reason }],
      });
      return sse([
        chunk({ [field]: first ? 'Read first.' : 'Workflow checked.' }),
        ...(first
          ? [
              chunk({
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-1',
                    type: 'function',
                    function: { name: 'read_workflow', arguments: '{}' },
                  },
                ],
              }),
            ]
          : [chunk({ content: 'Done.' })]),
        chunk({}, first ? 'tool_calls' : 'stop'),
      ]);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await runLocalAgent(
      input,
      new AbortController().signal,
      {
        provider: 'local',
        model: 'local-model',
        apiKey: '',
        origin: 'https://builder.test',
        baseURL: 'http://127.0.0.1:11434/v1',
      },
      (text) => chunks.push(text),
      (text) => summaries.push(text),
    );
    expect(response).toEqual({ message: 'Done.', operations: [] });
    expect(chunks.join('')).toBe('Done.');
    expect(summaries.join('')).toBe('Read first.\n\nWorkflow checked.');
    expect(fetcher).toHaveBeenCalledTimes(2);
  },
);

it('streams Claude summaries and preserves thinking signatures through tool calls', async () => {
  let turn = 0;
  const summaries: string[] = [];
  const chunks: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.thinking).toEqual({ type: 'adaptive', display: 'summarized' });
      const first = turn++ === 0;
      if (!first) {
        expect(
          body.messages.find((message: { role: string }) => message.role === 'assistant').content,
        ).toContainEqual({
          type: 'thinking',
          thinking: 'Read first.',
          signature: 'signed-thinking',
        });
      }
      return sse([
        {
          type: 'message_start',
          message: {
            id: `msg-${turn}`,
            model: 'claude-sonnet-4-6',
            usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'thinking', thinking: '' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: first ? 'Read first.' : 'Workflow checked.' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'signature_delta', signature: 'signed-thinking' },
        },
        { type: 'content_block_stop', index: 0 },
        ...(first
          ? [
              {
                type: 'content_block_start',
                index: 1,
                content_block: { type: 'tool_use', id: 'call-1', name: 'read_workflow', input: {} },
              },
              {
                type: 'content_block_delta',
                index: 1,
                delta: { type: 'input_json_delta', partial_json: '{}' },
              },
            ]
          : [
              { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
              {
                type: 'content_block_delta',
                index: 1,
                delta: { type: 'text_delta', text: 'Done.' },
              },
            ]),
        { type: 'content_block_stop', index: 1 },
        {
          type: 'message_delta',
          delta: { stop_reason: first ? 'tool_use' : 'end_turn', stop_sequence: null },
          usage: { output_tokens: 10 },
        },
        { type: 'message_stop' },
      ]);
    }),
  );
  const result = await runLocalAgent(
    input,
    new AbortController().signal,
    {
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      apiKey: 'private-test-key',
      origin: 'https://builder.test',
    },
    (text) => chunks.push(text),
    (text) => summaries.push(text),
  );
  expect(result).toEqual({ message: 'Done.', operations: [] });
  expect(chunks.join('')).toBe('Done.');
  expect(summaries.join('')).toBe('Read first.\n\nWorkflow checked.');
  expect(summaries.join('')).not.toContain('signed-thinking');
});

it('blocks credentials split across reasoning events in the client', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          '{"type":"reasoning","text":"Checking private-"}\n{"type":"reasoning","text":"test-key"}\n',
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      ),
  );
  const summaries: string[] = [];
  await expect(
    requestAIChat(
      { endpoint: 'https://builder.test/api/ai/chat' },
      input,
      undefined,
      {
        provider: 'openai',
        model: 'gpt-6-luna',
        apiKey: 'private-test-key',
        origin: 'https://builder.test',
      },
      undefined,
      (text) => summaries.push(text),
    ),
  ).rejects.toThrow('Unsafe');
  expect(summaries.join('')).toBe('Checking ');
});
