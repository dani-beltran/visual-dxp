// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AIProvider, BrowserAIOverride } from '../../src/lib/aiCredentials';
import {
  AI_BASE_URL_HEADER,
  AI_KEY_HEADER,
  AI_MODEL_HEADER,
  AI_PROVIDER_HEADER,
  OPENAI_KEY_HEADER,
  OPENAI_OVERRIDE_HEADER,
} from '../../src/lib/aiCredentials';
import { respondToAIChat, runLocalAgent } from '../../src/server/ai/agent';
import { handleChat } from '../../src/server/ai/http';

const input = {
  messages: [{ role: 'user' as const, content: 'Add a note' }],
  selectedNodeIds: [],
  workflow: {
    version: 1 as const,
    name: 'Test',
    websiteUrl: 'https://site.test',
    nodes: [],
    edges: [],
  },
};
const baseURL = 'http://127.0.0.1:11434/v1';
const config = (provider: AIProvider, key = `${provider}-private-key`): BrowserAIOverride => ({
  provider,
  apiKey: key,
  model: `${provider}-model`,
  origin: 'https://builder.test',
  ...(provider === 'local' ? { baseURL } : {}),
});
function upstream(provider: AIProvider, tool?: string, args: unknown = {}) {
  if (provider === 'openai')
    return Response.json({
      id: 'resp-test',
      created_at: 1,
      status: 'completed',
      model: 'model',
      output: tool
        ? [
            {
              type: 'function_call',
              id: 'fc-test',
              call_id: 'call-test',
              name: tool,
              arguments: JSON.stringify(args),
              status: 'completed',
            },
          ]
        : [
            {
              type: 'message',
              id: 'msg-test',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text: 'Done.', annotations: [] }],
            },
          ],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    });
  if (provider === 'claude')
    return Response.json({
      id: 'msg-test',
      type: 'message',
      role: 'assistant',
      model: 'claude-model',
      content: tool
        ? [{ type: 'tool_use', id: 'call-test', name: tool, input: args }]
        : [{ type: 'text', text: 'Done.' }],
      stop_reason: tool ? 'tool_use' : 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  return Response.json({
    id: 'chat-test',
    object: 'chat.completion',
    created: 1,
    model: 'local-model',
    choices: [
      {
        index: 0,
        message: tool
          ? {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-test',
                  type: 'function',
                  function: { name: tool, arguments: JSON.stringify(args) },
                },
              ],
            }
          : { role: 'assistant', content: 'Done.' },
        finish_reason: tool ? 'tool_calls' : 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}
let now = Date.now();
beforeEach(() => {
  vi.stubEnv('LANGGRAPH_API_URL', '');
  vi.stubEnv('AI_LOCAL_ALLOWED_BASE_URLS', baseURL);
  now += 60001;
  vi.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it.each(['openai', 'claude', 'local'] as const)(
  'routes %s through real SDK serialization and stages workflow edits atomically',
  async (provider) => {
    let step = 0;
    const fetcher = vi.fn(async (url: unknown, init: RequestInit) => {
      expect(String(url)).toBe(
        provider === 'openai'
          ? 'https://api.openai.com/v1/responses'
          : provider === 'claude'
            ? 'https://api.anthropic.com/v1/messages'
            : `${baseURL}/chat/completions`,
      );
      expect(init.redirect).toBe('error');
      expect(init.cache).toBe('no-store');
      expect(init.signal).toBeDefined();
      const headers = new Headers(init.headers);
      const body = JSON.parse(String(init.body));
      expect(headers.get(provider === 'claude' ? 'x-api-key' : 'authorization')).toBe(
        provider === 'claude' ? 'claude-private-key' : `Bearer ${provider}-private-key`,
      );
      expect(body.model).toBe(`${provider}-model`);
      expect(body.tools.length).toBeGreaterThan(5);
      expect(String(init.body)).not.toContain('private-key');
      if (provider === 'openai') expect(body.store).toBe(false);
      if (step === 2) {
        const output =
          provider === 'openai'
            ? body.input
                .filter((item: { type: string }) => item.type === 'function_call_output')
                .at(-1).output
            : provider === 'claude'
              ? body.messages
                  .at(-1)
                  .content.find((item: { type: string }) => item.type === 'tool_result').content
              : body.messages.at(-1).content;
        const text = typeof output === 'string' ? output : output[0].text;
        expect(JSON.parse(text)).toMatchObject({ ok: true, operation: { type: 'add_node' } });
      }

      if (provider === 'local' && step === 0)
        expect(body.tool_choice).toMatchObject({
          type: 'function',
          function: { name: 'read_workflow' },
        });
      return step++ === 0
        ? upstream(provider, 'read_workflow')
        : step === 2
          ? upstream(provider, 'add_node', { kind: 'note', config: { noteText: 'Hello' } })
          : upstream(provider);
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await respondToAIChat(input, new AbortController().signal, config(provider));
    expect(result).toMatchObject({
      message: 'Done.',
      operations: [
        { type: 'add_node', node: { data: { kind: 'note', config: { noteText: 'Hello' } } } },
      ],
    });
    expect(input.workflow.nodes).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  },
);
it.each(['openai', 'claude', 'local'] as const)(
  'discards all staged %s edits after an invalid later tool operation',
  async (provider) => {
    let step = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++step === 1
          ? upstream(provider, 'read_workflow')
          : step === 2
            ? upstream(provider, 'add_node', { kind: 'note' })
            : upstream(provider, 'add_connection', { source: 'missing', target: 'also-missing' }),
      ),
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config(provider)),
    ).rejects.toMatchObject({ status: 422 });
    expect(input.workflow.nodes).toEqual([]);
  },
);
it.each(['openai', 'claude', 'local'] as const)(
  'sanitizes %s errors and rejects redirects without retries or fallback',
  async (provider) => {
    for (const response of [
      new Response('private-key in error', { status: 401 }),
      new Response('', { status: 307, headers: { Location: 'https://evil.test' } }),
    ]) {
      const fetcher = vi.fn().mockResolvedValue(response);
      vi.stubGlobal('fetch', fetcher);
      await expect(
        runLocalAgent(input, new AbortController().signal, config(provider)),
      ).rejects.toMatchObject({ status: 422, message: expect.not.stringContaining('private-key') });
      expect(fetcher).toHaveBeenCalledOnce();
    }
  },
);
it('keeps unauthenticated local requests free of cloud/environment credentials', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'openai-env-secret');
  vi.stubEnv('LOCAL_LLM_API_KEY', 'local-env-secret');
  let step = 0;
  const fetcher = vi.fn(async (_url, init: RequestInit) => {
    expect(new Headers(init.headers).has('authorization')).toBe(false);
    return step++ === 0 ? upstream('local', 'read_workflow') : upstream('local');
  });
  vi.stubGlobal('fetch', fetcher);
  expect(
    (await runLocalAgent(input, new AbortController().signal, config('local', ''))).operations,
  ).toEqual([]);
});
it('reports missing local tool capability instead of accepting conversational claims', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream('local')));
  await expect(
    runLocalAgent(input, new AbortController().signal, config('local')),
  ).rejects.toMatchObject({
    status: 422,
    code: 'local_capabilities',
    message: expect.stringContaining('tool-call support'),
  });
});
it.each([
  'http://169.254.169.254/v1',
  'http://127.0.0.1:1234/v1',
  'http://127.0.0.1:11434/other',
  'http://user:password@127.0.0.1:11434/v1',
  'file:///tmp/model',
  'http://127.0.0.1:11434/v1?q=x',
])('rejects unauthorized/invalid local destination %s before fetch', async (url) => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, { ...config('local'), baseURL: url }),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});
it('requires explicit loopback allowance and keeps cloud destinations fixed', async () => {
  vi.stubEnv('AI_LOCAL_ALLOWED_BASE_URLS', '');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, config('local')),
  ).rejects.toMatchObject({ code: 'local_destination' });
  await expect(
    runLocalAgent(input, new AbortController().signal, { ...config('claude'), baseURL }),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});
it('preserves the OpenAI-only remote contract and routes browser overrides directly', async () => {
  vi.stubEnv('LANGGRAPH_API_URL', 'https://deployment.test');
  const fetcher = vi.fn().mockResolvedValue(upstream('claude'));
  vi.stubGlobal('fetch', fetcher);
  for (const provider of ['claude', 'local'] as const)
    await expect(
      respondToAIChat(input, new AbortController().signal, { provider, source: 'server' }),
    ).rejects.toMatchObject({ status: 409 });
  expect(fetcher).not.toHaveBeenCalled();
  await respondToAIChat(input, new AbortController().signal, config('claude'));
  expect(String(fetcher.mock.calls[0][0])).toBe('https://api.anthropic.com/v1/messages');
});
it('uses same-provider server defaults, including optional local authentication', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-server-key');
  vi.stubEnv('ANTHROPIC_MODEL', 'server-model');
  vi.stubEnv('LOCAL_LLM_BASE_URL', baseURL);
  vi.stubEnv('LOCAL_LLM_MODEL', 'server-local');
  vi.stubEnv('LOCAL_LLM_API_KEY', '');
  let localStep = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init: RequestInit) => {
      if (String(url).includes('anthropic')) {
        expect(new Headers(init.headers).get('x-api-key')).toBe('anthropic-server-key');
        return upstream('claude');
      }
      expect(new Headers(init.headers).has('authorization')).toBe(false);
      return localStep++ === 0 ? upstream('local', 'read_workflow') : upstream('local');
    }),
  );
  for (const provider of ['claude', 'local'] as const)
    expect(
      (await respondToAIChat(input, new AbortController().signal, { provider, source: 'server' }))
        .message,
    ).toBe('Done.');
  vi.stubEnv('ANTHROPIC_API_KEY', '');
  await expect(
    respondToAIChat(input, new AbortController().signal, { provider: 'claude', source: 'server' }),
  ).rejects.toMatchObject({ status: 503 });
});
it('validates wire provider binding and never sends credentials into workflow input', async () => {
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'https://builder.test',
    [AI_PROVIDER_HEADER]: 'local',
    [OPENAI_OVERRIDE_HEADER]: 'browser',
    [AI_MODEL_HEADER]: 'local-model',
    [AI_BASE_URL_HEADER]: baseURL,
  };
  const req = (extra: Record<string, string> = {}) =>
    new Request('https://builder.test/api/ai/chat', {
      method: 'POST',
      headers: { ...headers, ...extra },
      body: JSON.stringify(input),
    });
  const handler = vi.fn().mockResolvedValue({ message: 'Ready.', operations: [] });
  expect((await handleChat(req(), handler)).status).toBe(200);
  expect(handler.mock.calls[0][2]).toMatchObject({ provider: 'local', apiKey: '', baseURL });
  for (const extra of [
    { [OPENAI_KEY_HEADER]: 'openai-private' },
    { [AI_PROVIDER_HEADER]: 'unknown' },
    { [AI_PROVIDER_HEADER]: 'claude', [AI_KEY_HEADER]: 'claude-private' },
    { [AI_MODEL_HEADER]: '' },
  ] as Record<string, string>[])
    expect((await handleChat(req(extra), handler)).status).toBe(400);
  expect(handler).toHaveBeenCalledOnce();
});
it('prevents reflected credentials from entering tool drafts and cancels before executing late tool calls', async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      controller.abort();
      return upstream('claude', 'add_node', { kind: 'note' });
    }),
  );
  await expect(runLocalAgent(input, controller.signal, config('claude'))).rejects.toThrow();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      upstream('claude', 'add_node', { kind: 'note', config: { noteText: 'claude-private-key' } }),
    ),
  );
  await expect(
    runLocalAgent(input, new AbortController().signal, config('claude')),
  ).rejects.toMatchObject({ status: 422 });
});
it('bounds an endlessly tool-calling model', async () => {
  const fetcher = vi.fn(async () => upstream('local', 'read_workflow'));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, config('local')),
  ).rejects.toMatchObject({ status: 422 });
  expect(fetcher).toHaveBeenCalledTimes(40);
});

it('isolates concurrent OpenAI, Claude and local requests even when server credentials and tracing are configured', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'server-openai-secret');
  vi.stubEnv('ANTHROPIC_API_KEY', 'server-anthropic-secret');
  vi.stubEnv('LOCAL_LLM_API_KEY', 'server-local-secret');
  vi.stubEnv('LANGSMITH_TRACING', 'true');
  vi.stubEnv('LANGSMITH_API_KEY', 'server-tracing-secret');
  const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
  let localStep = 0;
  const destinations: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init: RequestInit) => {
      destinations.push(String(url));
      const provider = String(url).includes('anthropic')
        ? 'claude'
        : String(url).includes('openai')
          ? 'openai'
          : 'local';
      const headers = new Headers(init.headers);
      expect(headers.get(provider === 'claude' ? 'x-api-key' : 'authorization')).toBe(
        provider === 'claude' ? 'claude-private-key' : `Bearer ${provider}-private-key`,
      );
      expect(JSON.parse(String(init.body)).model).toBe(`${provider}-model`);
      await new Promise((resolve) => setTimeout(resolve, 1));
      return provider === 'local' && localStep++ === 0
        ? upstream(provider, 'read_workflow')
        : upstream(provider);
    }),
  );
  const results = await Promise.all(
    (['openai', 'claude', 'local'] as const).map((provider) =>
      runLocalAgent(input, new AbortController().signal, config(provider)),
    ),
  );
  expect(results.every((result) => result.message === 'Done.')).toBe(true);
  expect(destinations).toHaveLength(4);
  expect(destinations.every((url) => /api.openai.com|api.anthropic.com|127.0.0.1/.test(url))).toBe(
    true,
  );
  expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain('private-key');
  expect(process.env.OPENAI_API_KEY).toBe('server-openai-secret');
});

it('discards valid-looking tool calls when the provider response was truncated', async () => {
  const fetcher = vi.fn(async () => {
    const payload = await upstream('local', 'read_workflow').json();
    payload.choices[0].finish_reason = 'length';
    return Response.json(payload);
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, config('local')),
  ).rejects.toMatchObject({ status: 422 });
  expect(fetcher).toHaveBeenCalledOnce();
});
