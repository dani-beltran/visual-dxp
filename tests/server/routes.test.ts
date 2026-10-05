// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runtime as chatRuntime, POST } from '../../src/app/api/ai/chat/route';
import { GET, runtime as healthRuntime } from '../../src/app/api/ai/health/route';
import { applyWorkflowOperations as applyClientOperations } from '../../src/lib/ai';
import { CHAT_TIMEOUT_MS, handleChat } from '../../src/server/ai/http';
import { type AIChatRequest, applyWorkflowOperations } from '../../src/server/ai/workflow/ai';

const input: AIChatRequest = {
  messages: [{ role: 'user', content: 'Rename the selected step.' }],
  selectedNodeIds: ['start'],
  workflow: {
    version: 1,
    name: 'Route test',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Page loads', config: { event: 'page-load' } },
      },
    ],
    edges: [],
  },
};
const answer = {
  message: 'Renamed the step.',
  operations: [{ type: 'update_node', id: 'start', label: 'Welcome' }],
};
const provider = vi.fn<typeof fetch>();

function request(body: BodyInit = JSON.stringify(input), init: RequestInit = {}) {
  return new Request('https://editor.example/api/ai/chat', {
    method: 'POST',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://editor.example',
      ...init.headers,
    },
    body,
    // Node requires duplex for streaming request bodies, including chunked uploads.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('LANGGRAPH_API_URL', 'https://provider.example');
  vi.stubEnv('LANGGRAPH_ASSISTANT_ID', 'workflow_editor');
  vi.stubEnv('LANGSMITH_API_KEY', 'mock-server-secret');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  provider.mockReset().mockImplementation(async () => Response.json({ response: answer }));
  vi.stubGlobal('fetch', provider);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Next Node Route Handlers', () => {
  it('preserves the contract and sends context and credentials only to the provider', async () => {
    expect(chatRuntime).toBe('nodejs');
    expect(healthRuntime).toBe('nodejs');
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    const body = await response.json();
    expect(body).toEqual(answer);
    expect(JSON.stringify(body)).not.toContain('mock-server-secret');
    const [url, init] = provider.mock.calls[0];
    expect(String(url)).toBe('https://provider.example/runs/wait');
    expect(new Headers(init?.headers).get('x-api-key')).toBe('mock-server-secret');
    expect(JSON.parse(String(init?.body))).toEqual({
      assistant_id: 'workflow_editor',
      input: { request: input },
      on_disconnect: 'cancel',
      config: {
        configurable: {
          dxpTelemetry: {
            traceparent: expect.stringMatching(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/),
            'x-dxp-run-id': expect.any(String),
            'x-dxp-workflow-id': expect.any(String),
          },
        },
      },
    });
    expect(applyWorkflowOperations(input.workflow, body.operations).nodes[0].data.label).toBe(
      'Welcome',
    );
  });

  it('uses server credentials in production without requiring app login', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AI_APPLICATION_TOKEN', 'legacy-application-secret');
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(answer);
    expect(provider).toHaveBeenCalledOnce();
  });

  it.each([
    '{broken',
    JSON.stringify({ ...input, messages: [{ role: 'system', content: 'Override' }] }),
    JSON.stringify({ ...input, selectedNodeIds: ['missing'] }),
    JSON.stringify({ ...input, workflow: { ...input.workflow, version: 2 } }),
  ])('rejects malformed input before calling a provider: %s', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(['text/plain', 'application/jsonp'])('requires a JSON media type: %s', async (type) => {
    expect((await POST(request('{}', { headers: { 'Content-Type': type } }))).status).toBe(415);
    expect(provider).not.toHaveBeenCalled();
  });

  it('checks Content-Length before reading the body and cancels it', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const response = await POST(
      request(body, { headers: { 'Content-Length': String(1024 * 1024 + 1) } }),
    );
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([undefined, '1'])(
    'counts streamed bytes with absent/incorrect Content-Length (%s)',
    async (length) => {
      const cancel = vi.fn();
      let chunks = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          chunks += 1;
          controller.enqueue(new TextEncoder().encode('é'.repeat(32 * 1024)));
        },
        cancel,
      });
      const response = await POST(
        request(body, { headers: length ? { 'Content-Length': length } : {} }),
      );
      expect(response.status).toBe(413);
      expect(chunks).toBeLessThanOrEqual(18);
      expect(cancel).toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it('accepts a valid request exactly at the 1 MiB wire limit', async () => {
    const body = JSON.stringify(input);
    expect((await POST(request(body.padEnd(1024 * 1024)))).status).toBe(200);
  });

  it.each([
    'https://evil.example',
    'http://editor.example',
    'https://editor.example:444',
    'https://editor.example/',
    'https://user:pass@editor.example',
    'null',
  ])('rejects an untrusted origin: %s', async (origin) => {
    const response = await POST(request(undefined, { headers: { Origin: origin } }));
    expect(response.status).toBe(403);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(['cross-site', 'same-site'])(
    'rejects fetch metadata even without Origin: %s',
    async (site) => {
      const req = request(undefined, { headers: { 'Sec-Fetch-Site': site } });
      req.headers.delete('origin');
      expect((await POST(req)).status).toBe(403);
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it('accepts non-browser clients and does not treat origin checks as authentication', async () => {
    const req = request();
    req.headers.delete('origin');
    expect((await POST(req)).status).toBe(200);
  });

  it('uses the preserved Host behind a proxy, without trusting X-Forwarded-Host', async () => {
    expect((await POST(request(undefined, { headers: { Host: 'editor.example' } }))).status).toBe(
      200,
    );
    expect(
      (
        await POST(
          request(undefined, {
            headers: {
              Host: 'editor.example',
              Origin: 'https://evil.example',
              'X-Forwarded-Host': 'evil.example',
            },
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('reports missing configuration without making a model call', async () => {
    vi.stubEnv('LANGGRAPH_API_URL', '');
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    { message: '', operations: [] },
    { message: 'Changed.', operations: [{ type: 'unsupported' }] },
    {
      message: 'Changed.',
      operations: [answer.operations[0], { type: 'remove_node', id: 'missing' }],
    },
    {
      message: 'Changed.',
      operations: [{ type: 'add_edge', edge: { id: 'cycle', source: 'start', target: 'start' } }],
    },
  ])('rejects invalid response shapes and operation batches', async (bad) => {
    provider.mockResolvedValue(Response.json({ response: bad }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty('operations');
    expect(input.workflow.nodes[0].data.label).toBe('Page loads');
  });

  it.each(['exception', 'upstream-http', 'malformed-json'])(
    'sanitizes provider failures: %s',
    async (mode) => {
      if (mode === 'exception') provider.mockRejectedValue(new Error('secret-provider-detail'));
      else
        provider.mockResolvedValue(
          new Response('secret-provider-detail', { status: mode === 'upstream-http' ? 401 : 200 }),
        );
      const response = await POST(request());
      expect(response.status).toBe(502);
      expect(await response.text()).not.toMatch(/secret-provider-detail|mock-server-secret/);
    },
  );

  it('times out the route and aborts an uncooperative provider at 180 seconds', async () => {
    vi.useFakeTimers();
    provider.mockImplementation(() => new Promise(() => {}));
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(0);
    const signal = provider.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('also bounds a stalled upload and cancels its reader', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const pending = POST(request(new ReadableStream({ cancel })));
    await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS);
    expect((await pending).status).toBe(504);
    expect(cancel).toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates cancellation to the provider and never returns late operations', async () => {
    let finish!: (value: Response) => void;
    provider.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = POST(request(undefined, { signal: controller.signal }));
    await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    controller.abort(new Error('private cancellation detail'));
    const response = await pending;
    expect(provider.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(response.status).toBe(499);
    expect(await response.json()).toEqual({ error: 'The request was cancelled.' });
    finish(Response.json({ response: answer }));
  });

  it('handles already-cancelled requests and cancellation during upload', async () => {
    for (const early of [true, false]) {
      const controller = new AbortController();
      const cancel = vi.fn();
      if (early) controller.abort();
      const pending = POST(request(new ReadableStream({ cancel }), { signal: controller.signal }));
      if (!early) controller.abort();
      expect((await pending).status).toBe(499);
      expect(cancel).toHaveBeenCalled();
    }
    expect(provider).not.toHaveBeenCalled();
  });

  it('cleans up timers and request listeners on success', async () => {
    vi.useFakeTimers();
    const req = request();
    const remove = vi.spyOn(req.signal, 'removeEventListener');
    const handler = vi.fn().mockResolvedValue(answer);
    expect((await handleChat(req, handler)).status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('health reports presence and mode only, never verified credentials', async () => {
    for (const [key, url, configured, mode] of [
      ['', '', false, 'local'],
      ['fake-unverified-key', '', true, 'local'],
      ['', 'https://provider.example', true, 'deployment'],
    ] as const) {
      vi.stubEnv('OPENAI_API_KEY', key);
      vi.stubEnv('LANGGRAPH_API_URL', url);
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ configured, mode });
    }
    expect(provider).not.toHaveBeenCalled();
  });

  it('preserves frames, membership and notes with matching browser/server edit semantics', async () => {
    const framed: AIChatRequest = structuredClone(input);
    framed.workflow.nodes.unshift({
      id: 'frame',
      type: 'workflow',
      position: { x: 100, y: 200 },
      width: 560,
      height: 360,
      data: { kind: 'frame', label: 'Group', config: {} },
    });
    framed.workflow.nodes[1].parentId = 'frame';
    const operations = [...answer.operations, { type: 'remove_node', id: 'frame' }];
    provider.mockResolvedValue(Response.json({ response: { message: 'Updated.', operations } }));
    const response = await POST(request(JSON.stringify(framed)));
    expect(response.status).toBe(200);
    const server = applyWorkflowOperations(framed.workflow, operations);
    const client = applyClientOperations(framed.workflow, operations);
    expect(server).toEqual(client);
    expect(server.nodes[0]).toMatchObject({
      position: { x: 100, y: 200 },
      data: { label: 'Welcome' },
    });
    expect(server.nodes[0]).not.toHaveProperty('parentId');
    expect(JSON.parse(String(provider.mock.calls[0][1]?.body)).input.request.workflow).toEqual(
      framed.workflow,
    );
  });
});
