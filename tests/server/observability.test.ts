import { context, propagation, trace } from '@opentelemetry/api';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  InMemorySpanExporter,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runLocalAgent, runRemoteAgent } from '../../src/server/ai/agent';
import { graph } from '../../src/server/ai/graph';
import { handleChat } from '../../src/server/ai/http';
import { capture, withWorkflow } from '../../src/server/observability';
import {
  contentRecords,
  MAX_LOG_BODY_BYTES,
  redact,
  StreamCapture,
} from '../../src/server/observability/content';
import {
  flushTelemetry,
  propagator,
  shutdownTelemetry,
  telemetry,
} from '../../src/server/observability/sdk';

const input = {
  messages: [{ role: 'user' as const, content: 'Explain this workflow' }],
  selectedNodeIds: [],
  workflow: {
    version: 1 as const,
    name: 'Demo',
    websiteUrl: 'https://site.test',
    nodes: [],
    edges: [],
  },
};
let spans: InMemorySpanExporter;
let logs: InMemoryLogRecordExporter;
let metrics: InMemoryMetricExporter;
function install(ratio = 1) {
  trace.disable();
  context.disable();
  propagation.disable();
  spans = new InMemorySpanExporter();
  logs = new InMemoryLogRecordExporter();
  metrics = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const traces = new NodeTracerProvider({
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) }),
    spanProcessors: [new SimpleSpanProcessor(spans)],
  });
  traces.register({ propagator });
  Object.assign(globalThis, {
    dxpTelemetry: {
      traces,
      logs: new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter: logs })] }),
      metrics: new MeterProvider({
        readers: [
          new PeriodicExportingMetricReader({ exporter: metrics, exportIntervalMillis: 60000 }),
        ],
      }),
    },
  });
}
beforeEach(() => {
  vi.stubEnv('OTEL_SDK_DISABLED', 'false');
  vi.stubEnv('CAPTURE_LLM_CONTENT', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'test-private-secret');
  vi.stubEnv('LANGGRAPH_API_URL', '');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  install();
});
afterEach(async () => {
  await shutdownTelemetry();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function bodies() {
  return logs.getFinishedLogRecords().map((log) => log.body as Record<string, unknown>);
}
function response(output?: unknown[]) {
  return Response.json({
    id: 'resp-1',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'actual-model',
    output: output ?? [
      {
        type: 'message',
        id: 'msg-1',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Ready.', annotations: [] }],
      },
    ],
    usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
  });
}
it('runs a successful workflow, correlates ordered conversations and tools, and records actual model and tokens', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        response([
          {
            type: 'function_call',
            id: 'fc-1',
            call_id: 'tool-1',
            name: 'read_workflow',
            arguments: '{}',
            status: 'completed',
          },
        ]),
      )
      .mockResolvedValueOnce(response()),
  );
  const result = await handleChat(
    new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
      },
      body: JSON.stringify(input),
    }),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get('X-DXP-Trace-Id')).toBe('11111111111111111111111111111111');
  await flushTelemetry();
  const exported = spans.getFinishedSpans();
  expect(exported.filter((s) => s.name === 'workflow.execute')).toHaveLength(1);
  expect(exported.filter((s) => s.name === 'chat openai')).toHaveLength(2);
  const tool = exported.find((s) => s.name === 'execute_tool');
  expect(tool?.parentSpanContext?.spanId).toBe(
    exported
      .find((s) => s.attributes['workflow.step.id'] === 'turn-0' && s.name === 'workflow.step')
      ?.spanContext().spanId,
  );
  const content = bodies().filter((body) => body.record_id);
  expect(content.map((body) => body.sequence)).toEqual(content.map((_, i) => i));
  expect(content[0]).toMatchObject({ event_type: 'llm.input', role: 'system', message_index: 0 });
  expect(content[1]).toMatchObject({ role: 'user', message_index: 1 });
  expect(content.some((body) => body.event_type === 'tool.input')).toBe(true);
  expect(content.some((body) => body.event_type === 'tool.result')).toBe(true);
  for (const body of content) {
    const span = exported.find((s) => s.spanContext().spanId === body.span_id);
    expect(span?.spanContext().traceId).toBe(body.trace_id);
    expect(body.workflow_run_id).toBe(result.headers.get('X-DXP-Run-Id'));
    expect(body.llm_call_id).toEqual(expect.any(String));
  }
  expect(exported.find((s) => s.name === 'chat openai')?.attributes).toMatchObject({
    'gen_ai.response.model': 'actual-model',
    'gen_ai.usage.input_tokens': 10,
    'gen_ai.usage.output_tokens': 4,
  });
  expect(JSON.stringify(exported.map((s) => s.attributes))).not.toContain(
    input.messages[0].content,
  );
  const metricData = metrics
    .getMetrics()
    .flatMap((m) => m.scopeMetrics.flatMap((scope) => scope.metrics));
  expect(metricData.some((m) => m.descriptor.name === 'dxp.llm.tokens')).toBe(true);
  expect(JSON.stringify(metricData)).not.toContain(result.headers.get('X-DXP-Run-Id'));
});

it('runs a failed workflow without exporting provider error bodies or authorization headers', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response('Authorization: Bearer stolen-content', { status: 500 })),
  );
  const result = await handleChat(
    new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  expect(result.status).toBe(422);
  expect(result.headers.get('X-DXP-Run-Id')).toMatch(/^[a-f0-9-]{36}$/);
  await flushTelemetry();
  expect(bodies()).toContainEqual(
    expect.objectContaining({ event_type: 'workflow.completed', status: 'error' }),
  );
  expect(spans.getFinishedSpans().filter((s) => s.status.code === 2).length).toBeGreaterThanOrEqual(
    2,
  );
  expect(JSON.stringify(bodies())).not.toContain('stolen-content');
  expect(
    spans.getFinishedSpans().find((s) => s.name === 'chat openai')?.attributes[
      'http.response.status_code'
    ],
  ).toBe(500);
});

it('disables content while retaining operational spans and logs', async () => {
  vi.stubEnv('CAPTURE_LLM_CONTENT', 'false');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  await runLocalAgent(input, new AbortController().signal);
  await flushTelemetry();
  expect(bodies().some((body) => body.record_id)).toBe(false);
  expect(spans.getFinishedSpans().length).toBeGreaterThan(0);
  expect(JSON.stringify(bodies())).not.toContain(input.messages[0].content);
  const stream = new StreamCapture(false);
  stream.append('text', 'private');
  expect(stream.value()).toEqual([]);
});

it('keeps content with valid correlation IDs when trace sampling drops the trace', async () => {
  await shutdownTelemetry();
  install(0);
  await withWorkflow(input.workflow, async () => capture('llm.input', 'user', 'sampled out'));
  await flushTelemetry();
  expect(spans.getFinishedSpans()).toHaveLength(0);
  expect(bodies().find((body) => body.record_id)?.trace_id).toMatch(/^[a-f0-9]{32}$/);
});

it('redacts known secrets, nested JSON, credential fields and credentials split across deltas', () => {
  vi.stubEnv('CUSTOM_SECRET', 'environment-secret');
  const partial = new StreamCapture(true);
  partial.append('text', 'before browser-');
  partial.append('text', 'secret after');
  const records = contentRecords(
    {
      apiKey: 'anything',
      nested: '{"headers":"{\\"Authorization\\":\\"credential\\"}","ok":1}',
      text: 'environment-secret sk-abcdefghijk Bearer abc.def',
      partial: partial.value(),
    },
    {},
    ['browser-secret'],
  );
  const text = records.map((r) => r.content_json).join('');
  for (const secret of [
    'anything',
    'credential',
    'environment-secret',
    'sk-abcdefghijk',
    'abc.def',
    'browser-secret',
  ])
    expect(text).not.toContain(secret);
  expect(text).toContain('[REDACTED]');
  expect(redact('api_key="some value"')).toBe('api_key=[REDACTED]');
});

it('chunks by escaped UTF-8 bytes with reconstructable IDs and marks truncation', () => {
  const value = { text: '🌍é\n"\\\u0001'.repeat(20000) };
  const records = contentRecords(value, { sequence: 1, llm_call_id: 'call' }, [], 1048576);
  expect(records.length).toBeGreaterThan(1);
  expect(JSON.parse(records.map((r) => r.content_json).join(''))).toEqual(value);
  records.forEach((record, index) => {
    expect(Buffer.byteLength(JSON.stringify(record))).toBeLessThan(MAX_LOG_BODY_BYTES);
    expect(record.chunk_index).toBe(index);
    expect(record.chunk_count).toBe(records.length);
    expect(record.record_id).toBe(records[0].record_id);
  });
  const truncated = contentRecords(value, {}, [], 257);
  expect(truncated[0].truncated).toBe(true);
  expect(truncated[0].captured_bytes).toBeLessThanOrEqual(257);
  expect(truncated.map((r) => r.content_json).join('')).not.toContain('\uFFFD');
});

it.each(['complete', 'disconnect', 'abort'] as const)(
  'preserves streaming and captures %s output',
  async (mode) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
        ),
    );
    const signal = new AbortController();
    const chunks: string[] = [];
    const pending = runLocalAgent(input, signal.signal, undefined, (text) => chunks.push(text));
    const settled = pending.then(
      (value) => value,
      (error: unknown) => error,
    );
    const send = (value: unknown) =>
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
    send({
      type: 'response.created',
      response: { id: 'resp-1', created_at: 1, model: 'stream-model' },
    });
    send({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: 'msg-1', role: 'assistant', content: [] },
    });
    send({
      type: 'response.output_text.delta',
      item_id: 'msg-1',
      output_index: 0,
      content_index: 0,
      delta: 'Hello 🌍',
    });
    await vi.waitFor(() => expect(chunks.join('')).toBe('Hello 🌍'));
    expect(bodies().filter((b) => b.event_type === 'llm.output')).toHaveLength(0);
    if (mode === 'complete')
      send({
        type: 'response.completed',
        response: {
          id: 'resp-1',
          status: 'completed',
          usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
        },
      });
    if (mode === 'abort') signal.abort();
    controller.close();
    await settled;
    await flushTelemetry();
    const output = bodies().find((b) => b.event_type === 'llm.output');
    expect(output?.content_json).toContain('Hello 🌍');
    expect(output?.partial).toBe(mode !== 'complete');
    expect(
      spans.getFinishedSpans().find((s) => s.name === 'chat openai')?.attributes[
        'gen_ai.response.time_to_first_token'
      ],
    ).toEqual(expect.any(Number));
  },
);

it('propagates proxy context into the LangGraph entrypoint without duplicating generations', async () => {
  let envelope:
    | { config: { configurable: Record<string, unknown> }; input: { request: typeof input } }
    | undefined;
  let headers: Record<string, string> | undefined;
  vi.stubEnv('LANGGRAPH_API_URL', 'https://agent.test');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((_url, init) => {
      envelope = JSON.parse(init.body);
      headers = init.headers;
      return Response.json({ response: { message: 'Ready', operations: [] } });
    }),
  );
  await runRemoteAgent(input, new AbortController().signal);
  const carrier = envelope?.config.configurable.dxpTelemetry as Record<string, string>;
  expect(carrier.traceparent).toBe(headers?.traceparent);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  await graph.invoke({ request: input }, { configurable: { dxpTelemetry: carrier } });
  await flushTelemetry();
  expect(new Set(spans.getFinishedSpans().map((s) => s.spanContext().traceId)).size).toBe(1);
  expect(spans.getFinishedSpans().filter((s) => s.name === 'chat openai')).toHaveLength(1);
  expect(new Set(bodies().map((b) => b.workflow_run_id)).size).toBe(1);
});

it('isolates concurrent workflow context', async () => {
  await Promise.all(
    [1, 2].map((i) =>
      withWorkflow(input.workflow, async () => {
        await Promise.resolve();
        capture('llm.input', 'user', i);
      }),
    ),
  );
  await flushTelemetry();
  const records = bodies().filter((b) => b.record_id);
  expect(new Set(records.map((b) => b.trace_id)).size).toBe(2);
  expect(records.map((b) => b.sequence)).toEqual([0, 0]);
});

it('keeps successful execution intact when exporters or flushing fail', async () => {
  vi.spyOn(logs, 'export').mockImplementation((_records, callback) => callback({ code: 1 }));
  vi.spyOn(spans, 'export').mockImplementation((_records, callback) => callback({ code: 1 }));
  vi.spyOn(telemetry().metrics, 'forceFlush').mockRejectedValue(new Error('export unavailable'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  await expect(runLocalAgent(input, new AbortController().signal)).resolves.toMatchObject({
    message: 'Ready.',
  });
  await expect(flushTelemetry()).resolves.toBeUndefined();
});
