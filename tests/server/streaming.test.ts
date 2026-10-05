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
    async (_input, _signal, _config, emit) => {
      emit?.('Hello ');
      await pending;
      emit?.('world');
      return { message: 'Hello world', operations: [] };
    },
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const text: string[] = [];
  const result = requestAIChat(
    { endpoint: 'https://builder.test/api/ai/chat' },
    input,
    undefined,
    (chunk) => text.push(chunk),
  );
  await vi.waitFor(() => expect(text).toEqual(['Hello ']));
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
    requestAIChat({ endpoint: 'https://builder.test/api/ai/chat' }, input, undefined, () => {}),
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
  const result = runRemoteAgent(input, new AbortController().signal, (text) => chunks.push(text));
  source.write('event: custom\ndata: {"type":"text","text":"Hola"}\n\n');
  await vi.waitFor(() => expect(chunks).toEqual(['Hola']));
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
            if (mode === 'custom') chunks.push(value.text);
            if (mode === 'values' && value.response) message = value.response.message;
          }
          return { message };
        })()
      : runLocalAgent(input, new AbortController().signal, undefined, (text) => chunks.push(text));
    const event = (value: unknown) => source.write(`data: ${JSON.stringify(value)}\n\n`);
    event({ type: 'response.created', response: { id: 'resp-1', created_at: 1, model: 'test' } });
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
