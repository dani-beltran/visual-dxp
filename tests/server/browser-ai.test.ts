// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  workflow: {
    version: 1,
    name: 'test',
    websiteUrl: 'https://site.test',
    includeSubpages: false,
    nodes: [],
    edges: [],
  },
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
function response(model: string, review = false) {
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
        content: [
          {
            type: 'output_text',
            text: review
              ? JSON.stringify({ summary: 'Ready.', findings: [], question: '' })
              : 'Ready.',
            annotations: [],
          },
        ],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  });
}
// Give each route test a fresh quota window without disabling rate limiting.
let quotaTime = Date.now();
beforeEach(() => {
  quotaTime += 60_001;
  vi.spyOn(Date, 'now').mockReturnValue(quotaTime);
});
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
      return response(
        body.model,
        JSON.stringify(body.input).includes('You are a read-only workflow reviewer.'),
      );
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
      return response(
        body.model,
        JSON.stringify(body.input).includes('You are a read-only workflow reviewer.'),
      );
    });
    await respondToAIChat(input, new AbortController().signal);
  });
  it.each(['development', 'production'])(
    'accepts browser settings without app login in %s, even with a legacy token configured',
    async (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      vi.stubEnv('AI_APPLICATION_TOKEN', 'legacy-application-secret');
      const handler = vi.fn().mockResolvedValue({ message: 'Ready', operations: [] });
      const result = await handleChat(request(), handler);
      expect(result.status).toBe(200);
      expect(result.headers.get('cache-control')).toBe('no-store');
      expect(handler.mock.calls[0][0]).toEqual(input);
      expect(JSON.stringify(handler.mock.calls[0][0])).not.toContain('sk-browser');
      expect(handler.mock.calls[0][2]).toMatchObject({
        apiKey: 'sk-browser-secret',
        model: 'browser-model',
      });
    },
  );
  it('accepts production requests without browser origin metadata or app credentials', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = request();
    req.headers.delete('origin');
    const handler = vi.fn().mockResolvedValue({ message: 'Ready', operations: [] });
    expect((await handleChat(req, handler)).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
  it('enforces separate per-IP quotas without app login', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AI_RATE_LIMIT_IP_HEADER', 'cf-connecting-ip');
    const handler = vi.fn().mockResolvedValue({ message: 'Ready', operations: [] });
    const client = (ip: string, spoofed = '192.0.2.100') =>
      request({ 'CF-Connecting-IP': ip, 'X-Forwarded-For': spoofed });
    for (let n = 0; n < 20; n++) {
      expect((await handleChat(client('192.0.2.1'), handler)).status).toBe(200);
    }
    expect((await handleChat(client('192.0.2.1', '192.0.2.200'), handler)).status).toBe(429);
    expect((await handleChat(client('::ffff:c000:201'), handler)).status).toBe(429);
    expect((await handleChat(client('192.0.2.2'), handler)).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(21);
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
  it('still rejects cross-site requests to the local development demo', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AI_APPLICATION_TOKEN', '');
    const origin = 'http://localhost:3000';
    const handler = vi.fn();
    const untrustedHeaders: Record<string, string>[] = [
      { Origin: 'https://evil.test' },
      { Origin: origin, 'Sec-Fetch-Site': 'cross-site' },
    ];
    for (const extra of untrustedHeaders) {
      expect((await handleChat(request(extra, `${origin}/api/ai/chat`), handler)).status).toBe(403);
    }
    expect(handler).not.toHaveBeenCalled();
  });
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'accepts browser credentials over HTTP on %s',
    async (hostname) => {
      const origin = `http://${hostname}:3000`;
      const handler = vi.fn().mockResolvedValue({ message: 'Ready', operations: [] });
      const result = await handleChat(
        request({ Origin: origin }, `${origin}/api/ai/chat`),
        handler,
      );
      expect(result.status).toBe(200);
      expect(handler.mock.calls[0][2]).toMatchObject({ apiKey: 'sk-browser-secret', origin });
    },
  );
  it('rejects insecure connections and disallowed origins', async () => {
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
    expect(handler).not.toHaveBeenCalled();
  });
  it('never echoes reflected keys or provider errors', async () => {
    for (const handler of [
      vi.fn().mockResolvedValue({ message: headers[OPENAI_KEY_HEADER], operations: [] }),
      vi.fn().mockRejectedValue(new AIServiceError(401, headers[OPENAI_KEY_HEADER])),
    ]) {
      const result = await handleChat(request(), handler);
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
