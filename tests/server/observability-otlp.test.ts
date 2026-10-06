import { createServer } from 'node:http';
import { context, propagation, trace } from '@opentelemetry/api';
import { expect, it, vi } from 'vitest';
import { runLocalAgent } from '../../src/server/ai/agent';
import { withWorkflow } from '../../src/server/observability';
import { flushTelemetry, shutdownTelemetry } from '../../src/server/observability/sdk';

it('exports real OTLP JSON to a local receiver and survives a failed receiver', async () => {
  const received: { path: string; body: string; authorization: string | undefined }[] = [];
  let failing = false;
  const receiver = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({
      path: request.url ?? '',
      body: Buffer.concat(chunks).toString(),
      authorization: request.headers.authorization,
    });
    response.writeHead(failing ? 503 : 200, { 'Content-Type': 'application/json' });
    response.end('{}');
  });
  await new Promise<void>((resolve, reject) => {
    receiver.once('error', reject);
    receiver.listen(0, '127.0.0.1', resolve);
  });
  const address = receiver.address();
  if (!address || typeof address === 'string') throw new Error('Missing receiver');
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.stubEnv('OTEL_SERVICE_NAME', 'my-app');
  vi.stubEnv(
    'OTEL_RESOURCE_ATTRIBUTES',
    'service.namespace=my-application-group,deployment.environment=production',
  );
  vi.stubEnv('OTEL_SDK_DISABLED', 'false');
  vi.stubEnv('CAPTURE_LLM_CONTENT', 'true');
  vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', `http://127.0.0.1:${address.port}`);
  vi.stubEnv('OTEL_EXPORTER_OTLP_HEADERS', 'Authorization=Basic%20demo-placeholder');
  vi.stubEnv('OPENAI_API_KEY', 'provider-placeholder');
  trace.disable();
  context.disable();
  propagation.disable();
  Object.assign(globalThis, { dxpTelemetry: undefined });
  const input = {
    messages: [{ role: 'user' as const, content: 'Local OTLP demo' }],
    selectedNodeIds: [],
    workflow: {
      version: 1 as const,
      name: 'OTLP demo',
      websiteUrl: 'https://site.test',
      nodes: [],
      edges: [],
    },
  };
  const fetcher = vi.fn().mockImplementation(() =>
    Promise.resolve(
      Response.json({
        id: 'resp-1',
        object: 'response',
        created_at: 1,
        status: 'completed',
        model: 'fixture-model',
        output: [
          {
            type: 'message',
            id: 'msg-1',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'Ready.', annotations: [] }],
          },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  try {
    await expect(
      withWorkflow(input.workflow, () => runLocalAgent(input, new AbortController().signal), {
        traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
      }),
    ).resolves.toMatchObject({ message: 'Ready.' });
    await flushTelemetry();
    expect(new Set(received.map((record) => record.path))).toEqual(
      new Set(['/v1/logs', '/v1/traces', '/v1/metrics']),
    );
    expect(received.every((record) => record.authorization === 'Basic demo-placeholder')).toBe(
      true,
    );
    for (const record of received) {
      const payload = JSON.parse(record.body);
      const groups = payload.resourceSpans ?? payload.resourceLogs ?? payload.resourceMetrics;
      for (const group of groups) {
        const attributes = Object.fromEntries(
          group.resource.attributes.map(
            (attribute: { key: string; value: { stringValue: string } }) => [
              attribute.key,
              attribute.value.stringValue,
            ],
          ),
        );
        expect(attributes).toMatchObject({
          'service.name': 'my-app',
          'service.namespace': 'my-application-group',
          'deployment.environment': 'production',
          'deployment.environment.name': 'production',
        });
      }
    }
    const logPayload = received
      .filter((r) => r.path === '/v1/logs')
      .map((r) => r.body)
      .join('');
    expect(logPayload).toContain('Local OTLP demo');
    expect(logPayload).toContain('11111111111111111111111111111111');
    expect(logPayload).toContain('workflow_run_id');
    expect(logPayload).not.toContain('provider-placeholder');
    expect(received.find((r) => r.path === '/v1/traces')?.body).not.toContain('Local OTLP demo');
    const events = () =>
      debug.mock.calls
        .filter(([prefix]) => prefix === '[otel-debug]')
        .map(([, body]) => JSON.parse(String(body)));
    for (const signal of ['traces', 'logs', 'metrics']) {
      expect(events()).toContainEqual(
        expect.objectContaining({ event: 'export.succeeded', signal }),
      );
    }
    expect(events()).toContainEqual(expect.objectContaining({ event: 'content.queued' }));
    failing = true;
    await expect(runLocalAgent(input, new AbortController().signal)).resolves.toMatchObject({
      message: 'Ready.',
    });
    await expect(flushTelemetry()).resolves.toBeUndefined();
    fetcher.mockResolvedValue(new Response('failure', { status: 500 }));
    await expect(runLocalAgent(input, new AbortController().signal)).rejects.toMatchObject({
      status: 422,
    });
    await flushTelemetry();
    expect(events()).toContainEqual(expect.objectContaining({ event: 'export.failed' }));
    const output = JSON.stringify(debug.mock.calls);
    for (const secret of [
      'Local OTLP demo',
      'Ready.',
      'provider-placeholder',
      'demo-placeholder',
    ]) {
      expect(output).not.toContain(secret);
    }
  } finally {
    await shutdownTelemetry();
    receiver.closeAllConnections();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
    debug.mockRestore();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
}, 15000);

// Provider/tool-loop tests isolate the independent semantic review call.
vi.mock('../../src/server/ai/review', async (original) => ({
  ...(await original<typeof import('../../src/server/ai/review')>()),
  reviewWorkflow: vi.fn(async () => ({ summary: 'Ready.', findings: [], question: '' })),
}));
