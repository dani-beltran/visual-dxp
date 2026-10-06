// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestAIChat } from '../../src/lib/ai';
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
import { handleChat, handleHealth } from '../../src/server/ai/http';
import {
  allowedLocalBaseURL,
  resolveProviderConfiguration,
  serverDefaultProvider,
} from '../../src/server/ai/providers';

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
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('OPENAI_MODEL', '');
  vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubEnv('ANTHROPIC_MODEL', '');
  vi.stubEnv('LOCAL_LLM_BASE_URL', '');
  vi.stubEnv('LOCAL_LLM_MODEL', '');
  vi.stubEnv('LOCAL_LLM_API_KEY', '');
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
    vi.stubEnv('LOCAL_LLM_BASE_URL', 'https://server-model.test/v1');
    vi.stubEnv('LOCAL_LLM_MODEL', 'server-model');
    vi.stubEnv('LOCAL_LLM_API_KEY', 'server-local-secret');
    vi.stubEnv('LANGGRAPH_API_URL', 'https://deployment.test');
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
      if (provider === 'local' && step === 0) {
        expect(body.tools).toHaveLength(1);
        expect(body.tools[0].function.name).toBe('read_workflow');
        expect(body.tool_choice).toBe('required');
      } else {
        expect(body.tools.length).toBeGreaterThan(5);
        if (provider === 'local') expect(body.tool_choice).toBe('auto');
      }
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
  'http://user:password@127.0.0.1:11434/v1',
  'file:///tmp/model',
  'http://127.0.0.1:11434/v1?q=x',
])('rejects invalid local destination %s before fetch', async (url) => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, { ...config('local'), baseURL: url }),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});
it('keeps cloud destinations fixed', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, { ...config('claude'), baseURL }),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});
it('preserves the OpenAI-only remote contract and routes browser overrides directly', async () => {
  vi.stubEnv('LANGGRAPH_API_URL', 'https://deployment.test');
  const fetcher = vi.fn().mockResolvedValue(upstream('claude'));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    respondToAIChat(input, new AbortController().signal, { provider: 'claude', source: 'server' }),
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

it.each([
  ['http://localhost:11434/v1', 'http://127.0.0.1:11434/v1'],
  ['http://127.0.0.1:1234/other', 'http://127.0.0.1:1234/other'],
  ['http://[::1]:11434/v1', 'http://[::1]:11434/v1'],
  ['https://models.example.com/v1', 'https://models.example.com/v1'],
  ['http://192.168.1.1:1234/v1', 'http://192.168.1.1:1234/v1'],
  ['http://10.0.0.1/v1', 'http://10.0.0.1/v1'],
])('sends local model requests to the configured host: %s', async (baseURL, expected) => {
  let step = 0;
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toBe(expected + '/chat/completions');
    return step++ === 0 ? upstream('local', 'read_workflow') : upstream('local');
  });
  vi.stubGlobal('fetch', fetcher);
  await runLocalAgent(input, new AbortController().signal, { ...config('local'), baseURL });
  expect(fetcher).toHaveBeenCalled();
});

it('accepts remote server defaults without an allowlist', () => {
  vi.stubEnv('LOCAL_LLM_BASE_URL', 'https://models.example.com/v1');
  vi.stubEnv('LOCAL_LLM_MODEL', 'local-model');
  expect(resolveProviderConfiguration({ provider: 'local', source: 'server' })).toMatchObject({
    baseURL: 'https://models.example.com/v1',
    model: 'local-model',
  });
  expect(allowedLocalBaseURL('http://169.254.169.254/v1')).toBe('http://169.254.169.254/v1');
});

it.each([
  { key: '', deployment: '', localURL: '', expected: 'claude' },
  { key: '   ', deployment: '   ', localURL: '', expected: 'claude' },
  { key: 'openai-server-key', deployment: '', localURL: '', expected: 'openai' },
  { key: '', deployment: 'https://deployment.test', localURL: '', expected: 'openai' },
  {
    key: 'openai-server-key',
    deployment: 'https://deployment.test',
    localURL: baseURL,
    expected: 'local',
  },
])(
  'selects server defaults by configuration priority: %j',
  ({ key, deployment, localURL, expected }) => {
    vi.stubEnv('OPENAI_API_KEY', key);
    // A model name alone does not configure OpenAI.
    vi.stubEnv('OPENAI_MODEL', 'gpt-6-luna');
    vi.stubEnv('LANGGRAPH_API_URL', deployment);
    vi.stubEnv('LOCAL_LLM_BASE_URL', localURL);
    vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-server-key');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-server-model');
    expect(serverDefaultProvider()).toBe(expected);
  },
);

it.each([undefined, 'openai', 'claude', 'local'] as const)(
  'uses Claude environment defaults unless browser settings select %s',
  async (provider) => {
    vi.stubEnv('OPENAI_MODEL', 'gpt-6-luna');
    vi.stubEnv('ANTHROPIC_API_KEY', ' anthropic-server-key ');
    vi.stubEnv('ANTHROPIC_MODEL', ' claude-server-model ');
    const endpoint = 'https://builder.test/api/ai/chat';
    let step = 0;
    const fetcher = vi.fn(
      async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (String(url) === endpoint) return handleChat(new Request(endpoint, init));
        const selected = provider ?? 'claude';
        expect(String(url)).toBe(
          selected === 'openai'
            ? 'https://api.openai.com/v1/responses'
            : selected === 'claude'
              ? 'https://api.anthropic.com/v1/messages'
              : `${baseURL}/chat/completions`,
        );
        expect(JSON.parse(String(init?.body)).model).toBe(
          provider ? `${provider}-model` : 'claude-server-model',
        );
        expect(
          new Headers(init?.headers).get(selected === 'claude' ? 'x-api-key' : 'authorization'),
        ).toBe(
          provider
            ? selected === 'claude'
              ? `${provider}-private-key`
              : `Bearer ${provider}-private-key`
            : 'anthropic-server-key',
        );
        return upstream(
          selected,
          selected === 'local' && step++ === 0 ? 'read_workflow' : undefined,
        );
      },
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await handleHealth().json()).toEqual({ configured: true, mode: 'local' });
    expect(
      await requestAIChat({ endpoint }, input, undefined, provider ? config(provider) : undefined),
    ).toEqual({ message: 'Done.', operations: [] });
    expect(fetcher).toHaveBeenCalledTimes(provider === 'local' ? 3 : 2);
  },
);

it.each([
  ['', 'claude-model'],
  ['anthropic-server-key', ''],
  ['anthropic-server-key', 'invalid model'],
])('reports incomplete Claude defaults as unconfigured: %s %s', async (key, model) => {
  vi.stubEnv('ANTHROPIC_API_KEY', key);
  vi.stubEnv('ANTHROPIC_MODEL', model);
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect(await handleHealth().json()).toEqual({ configured: false, mode: 'local' });
  await expect(respondToAIChat(input, new AbortController().signal)).rejects.toMatchObject({
    status: 503,
    code: 'provider_unconfigured',
  });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([
  { streaming: false, deployment: '', apiKey: '' },
  { streaming: true, deployment: '', apiKey: 'server-local-secret' },
  { streaming: false, deployment: 'https://deployment.test', apiKey: 'server-local-secret' },
  { streaming: true, deployment: 'https://deployment.test', apiKey: '' },
])(
  'uses the local environment configuration from the default chat client: %j',
  async ({ streaming, deployment, apiKey }) => {
    vi.stubEnv('OPENAI_API_KEY', 'cloud-secret-key');
    vi.stubEnv('LANGGRAPH_API_URL', deployment);
    vi.stubEnv('LOCAL_LLM_BASE_URL', ' http://localhost:11434/v1/ ');
    vi.stubEnv('LOCAL_LLM_MODEL', ' org/server-model:tag ');
    vi.stubEnv('LOCAL_LLM_API_KEY', apiKey);
    const endpoint = 'https://builder.test/api/ai/chat';
    let step = 0;
    const fetcher = vi.fn(
      async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (String(url) === endpoint) {
          expect(new Headers(init?.headers).has(AI_PROVIDER_HEADER)).toBe(false);
          return handleChat(new Request(endpoint, init));
        }
        expect(String(url)).toBe(`${baseURL}/chat/completions`);
        expect(new Headers(init?.headers).get('authorization')).toBe(
          apiKey ? `Bearer ${apiKey}` : null,
        );
        expect(JSON.parse(String(init?.body)).model).toBe('org/server-model:tag');
        const tool = step === 0 ? 'read_workflow' : step === 1 ? 'add_node' : undefined;
        step++;
        const response = upstream(
          'local',
          tool,
          tool === 'add_node' ? { kind: 'note', config: { noteText: 'Hello' } } : {},
        );
        if (!streaming) return response;
        const payload = await response.json();
        const { message, finish_reason } = payload.choices[0];
        if (message.tool_calls) message.tool_calls[0].index = 0;
        const chunk = (delta: unknown, finishReason: string | null) =>
          JSON.stringify({
            ...payload,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta, finish_reason: finishReason }],
          });
        return new Response(
          `data: ${chunk(message, null)}\n\ndata: ${chunk({}, finish_reason)}\n\ndata: [DONE]\n\n`,
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        );
      },
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await handleHealth().json()).toEqual({ configured: true, mode: 'local' });
    const chunks: string[] = [];
    const result = await requestAIChat(
      { endpoint },
      input,
      undefined,
      undefined,
      streaming ? (text) => chunks.push(text) : undefined,
    );
    expect(result).toMatchObject({
      message: 'Done.',
      operations: [
        { type: 'add_node', node: { data: { kind: 'note', config: { noteText: 'Hello' } } } },
      ],
    });
    if (streaming) expect(chunks.join('')).toBe('Done.');
    expect(step).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(4);
  },
);

it.each([
  [baseURL, ''],
  ['', 'local-model'],
  ['file:///tmp/model', 'local-model'],
  [baseURL, 'invalid model'],
])(
  'rejects incomplete or invalid local defaults without falling back: %s %s',
  async (url, model) => {
    vi.stubEnv('LOCAL_LLM_BASE_URL', url);
    vi.stubEnv('LOCAL_LLM_MODEL', model);
    vi.stubEnv('OPENAI_API_KEY', 'cloud-secret-key');
    vi.stubEnv('LANGGRAPH_API_URL', 'https://deployment.test');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await handleHealth().json()).toEqual({ configured: false, mode: 'local' });
    await expect(respondToAIChat(input, new AbortController().signal)).rejects.toBeInstanceOf(
      Error,
    );
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it('preserves legacy browser OpenAI settings when a local environment default is configured', () => {
  vi.stubEnv('LOCAL_LLM_BASE_URL', baseURL);
  vi.stubEnv('LOCAL_LLM_MODEL', 'server-model');
  const { provider: _provider, ...legacy } = config('openai');
  expect(resolveProviderConfiguration(legacy)).toMatchObject({
    provider: 'openai',
    source: 'browser',
    apiKey: legacy.apiKey,
    model: legacy.model,
  });
});

it.each([
  ['openai', 'gpt-6-luna', { summary: 'auto' }],
  ['openai', 'gpt-4.1', undefined],
  ['local', 'local-model', { summary: 'auto' }],
  ['claude', 'claude-sonnet-4-6', { type: 'adaptive', display: 'summarized' }],
  ['claude', 'claude-opus-4-7', { type: 'adaptive', display: 'summarized' }],
  ['claude', 'claude-sonnet-5', { type: 'adaptive', display: 'summarized' }],
  ['claude', 'claude-sonnet-4-5-20250929', { type: 'enabled', budget_tokens: 2048 }],
  ['claude', 'claude-haiku-4-5', { type: 'enabled', budget_tokens: 2048 }],
  ['claude', 'claude-3-7-sonnet-latest', { type: 'enabled', budget_tokens: 2048 }],
  ['claude', 'claude-3-5-haiku-latest', undefined],
  ['claude', 'custom-model', undefined],
] as const)('serializes reasoning controls for %s / %s', async (provider, model, expected) => {
  let step = 0;
  const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    expect(body[provider === 'claude' ? 'thinking' : 'reasoning']).toEqual(expected);
    if (provider === 'openai') {
      expect(body.store).toBe(false);
      if (expected) expect(body.include).toContain('reasoning.encrypted_content');
    }
    if (provider === 'claude') expect(body.max_tokens).toBe(8192);
    return upstream(provider, provider === 'local' && step++ === 0 ? 'read_workflow' : undefined);
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(
    runLocalAgent(input, new AbortController().signal, { ...config(provider), model }),
  ).resolves.toMatchObject({ message: 'Done.', operations: [] });
  expect(fetcher).toHaveBeenCalledTimes(provider === 'local' ? 2 : 1);
});
