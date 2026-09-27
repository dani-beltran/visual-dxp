// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OPENAI_KEY_HEADER,
  OPENAI_MODEL_HEADER,
  OPENAI_OVERRIDE_HEADER,
} from '../../src/lib/aiCredentials';
import { allowAIRequest } from '../../src/server/ai/access';
import { AIServiceError, respondToAIChat } from '../../src/server/ai/agent';
import { handleChat } from '../../src/server/ai/http';
import type { AIChatRequest } from '../../src/server/ai/workflow/ai';

const input: AIChatRequest = {
  messages: [{ role: 'user', content: 'Explain' }],
  selectedNodeIds: [],
  workflow: { version: 1, name: 'test', websiteUrl: 'https://site.test', nodes: [], edges: [] },
};
const headers = {
  'Content-Type': 'application/json',
  Origin: 'https://builder.test',
  [OPENAI_KEY_HEADER]: 'sk-browser-secret',
  [OPENAI_MODEL_HEADER]: 'browser-model',
  [OPENAI_OVERRIDE_HEADER]: 'browser',
};
function request(extra: Record<string, string> = {}, url = 'https://builder.test/api/ai/chat') {
  return new Request(url, {
    method: 'POST',
    headers: { ...headers, ...extra },
    body: JSON.stringify(input),
  });
}
function response(model: string) {
  return Response.json({
    id: 'resp-test',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model,
    output: [
      {
        type: 'message',
        id: 'msg-test',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Ready.', annotations: [] }],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('request-scoped browser AI', () => {
  it('keeps concurrent users separate, overrides env, disables traces, and never calls remote LangGraph', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'server-key');
    vi.stubEnv('OPENAI_MODEL', 'server-model');
    vi.stubEnv('LANGGRAPH_API_URL', 'https://remote.test');
    vi.stubEnv('LANGSMITH_TRACING', 'true');
    vi.stubEnv('LANGSMITH_API_KEY', 'trace-key');
    vi.stubEnv('OPENAI_BASE_URL', 'https://evil.test');
    vi.stubEnv('OPENAI_LOG', 'debug');
    const logs = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'debug'),
    ];
    const calls: { key: string | null; model: string }[] = [];
    const fetcher = vi.fn(async (url: unknown, init: RequestInit) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      expect(init.redirect).toBe('error');
      const body = JSON.parse(String(init.body));
      expect(body.store).toBe(false);
      const key = new Headers(init.headers).get('authorization');
      calls.push({ key, model: body.model });
      expect(String(init.body)).not.toContain('user-key');
      expect(String(init.body)).not.toContain('server-key');
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response(body.model);
    });
    vi.stubGlobal('fetch', fetcher);
    const outcomes = await Promise.all(
      ['a', 'b'].map((user) =>
        respondToAIChat(input, new AbortController().signal, {
          apiKey: `${user}-user-key`,
          model: `${user}-model`,
          origin: 'https://builder.test',
        }),
      ),
    );
    expect(calls).toEqual(
      expect.arrayContaining([
        { key: 'Bearer a-user-key', model: 'a-model' },
        { key: 'Bearer b-user-key', model: 'b-model' },
      ]),
    );
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.openai.com/v1/responses',
      'https://api.openai.com/v1/responses',
    ]);
    expect(JSON.stringify(outcomes)).not.toContain('user-key');
    expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain('user-key');
    expect(process.env.OPENAI_API_KEY).toBe('server-key');
    expect(process.env.OPENAI_MODEL).toBe('server-model');
    vi.stubEnv('LANGSMITH_TRACING', 'false');
    vi.stubEnv('LANGGRAPH_API_URL', '');
    vi.stubEnv('OPENAI_BASE_URL', '');
    vi.stubEnv('OPENAI_LOG', 'off');
    fetcher.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe('server-model');
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer server-key');
      return response(body.model);
    });
    await respondToAIChat(input, new AbortController().signal);
  });
  it('requires separate application authorization before invoking the agent', async () => {
    vi.stubEnv('AI_APPLICATION_TOKEN', 'application-secret');
    const handler = vi.fn().mockResolvedValue({ message: 'Ready', operations: [] });
    expect((await handleChat(request(), handler)).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    const result = await handleChat(
      request({ Authorization: 'Bearer application-secret' }),
      handler,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(handler.mock.calls[0][0]).toEqual(input);
    expect(JSON.stringify(handler.mock.calls[0][0])).not.toContain('sk-browser');
    expect(handler.mock.calls[0][2]).toMatchObject({
      apiKey: 'sk-browser-secret',
      model: 'browser-model',
    });
  });
  it.each([
    [OPENAI_KEY_HEADER, ''],
    [OPENAI_MODEL_HEADER, ''],
    [OPENAI_OVERRIDE_HEADER, ''],
    [OPENAI_MODEL_HEADER, 'bad model'],
  ])('rejects incomplete/invalid %s', async (header, value) => {
    const handler = vi.fn();
    const result = await handleChat(request({ [header]: value }), handler);
    expect(result.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
  it('rejects insecure connections, disallowed origins, and failed authorization', async () => {
    const handler = vi.fn();
    expect(
      (
        await handleChat(
          request({ Origin: 'http://builder.test' }, 'http://builder.test/api/ai/chat'),
          handler,
        )
      ).status,
    ).toBe(400);
    expect((await handleChat(request({ Origin: 'https://evil.test' }), handler)).status).toBe(403);
    expect((await handleChat(request(), handler, { authorize: async () => null })).status).toBe(
      401,
    );
    expect(handler).not.toHaveBeenCalled();
  });
  it('never echoes reflected keys or provider errors', async () => {
    const access = { authorize: async () => 'test-safe-errors' };
    for (const handler of [
      vi.fn().mockResolvedValue({ message: headers[OPENAI_KEY_HEADER], operations: [] }),
      vi.fn().mockRejectedValue(new AIServiceError(401, headers[OPENAI_KEY_HEADER])),
    ]) {
      const result = await handleChat(request(), handler, access);
      expect(await result.text()).not.toContain(headers[OPENAI_KEY_HEADER]);
    }
  });
  it('applies an application quota with no credential-bearing bucket keys', () => {
    const principal = 'quota-test-user';
    for (let n = 0; n < 20; n++) expect(allowAIRequest(principal)).toBe(true);
    expect(allowAIRequest(principal)).toBe(false);
    expect(allowAIRequest('other-user')).toBe(true);
  });
  it('rejects OpenAI redirects without trying another destination', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('', { status: 302, headers: { Location: 'https://evil.test' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      respondToAIChat(input, new AbortController().signal, {
        apiKey: 'browser-key',
        model: 'browser-model',
        origin: 'https://builder.test',
      }),
    ).rejects.toThrow();
    for (const [url, init] of fetcher.mock.calls) {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      expect(init.redirect).toBe('error');
    }
  });
});
