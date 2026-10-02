import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import {
  type Attributes,
  context,
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { type ContentMetadata, contentRecords, redact, utf8Prefix } from './content';
import { telemetryDebug } from './debug';
import { propagator, telemetry } from './sdk';

interface Run {
  runId: string;
  workflowId: string;
  sequence: number;
  stepId: string;
  secrets: string[];
}
const runs = new AsyncLocalStorage<Run>();
export type Carrier = Record<string, string>;
const getter = {
  get: (carrier: Carrier, key: string) => carrier[key],
  keys: (carrier: Carrier) => Object.keys(carrier),
};
const setter = {
  set: (carrier: Carrier, key: string, value: string) => {
    carrier[key] = value;
  },
};
const uuid = (value?: string) =>
  value && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
    ? value
    : randomUUID();

export function safeTelemetry(action: () => void) {
  try {
    action();
  } catch {
    /* Observability cannot fail a request. */
  }
}
export const capturing = () =>
  process.env.CAPTURE_LLM_CONTENT === 'true' && process.env.OTEL_SDK_DISABLED !== 'true';
export function addSecrets(...secrets: string[]) {
  runs.getStore()?.secrets.push(...secrets.filter(Boolean));
}
export function identifiers() {
  const run = runs.getStore();
  const span = trace.getSpan(context.active())?.spanContext();
  return {
    workflow_run_id: run?.runId ?? '',
    workflow_id: run?.workflowId ?? '',
    step_id: run?.stepId ?? '',
    trace_id: span?.traceId ?? '',
    span_id: span?.spanId ?? '',
  };
}
export function operational(event_type: string, fields: ContentMetadata = {}) {
  telemetryDebug('operation', { event_type, ...identifiers() });
  safeTelemetry(() =>
    telemetry()
      .logs.getLogger('visual-dxp')
      .emit({
        context: context.active(),
        severityNumber: fields.status === 'error' ? SeverityNumber.ERROR : SeverityNumber.INFO,
        body: {
          event_type,
          ...identifiers(),
          ...Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
              key,
              typeof value === 'string'
                ? utf8Prefix(String(redact(value, runs.getStore()?.secrets)), 512)
                : value,
            ]),
          ),
        },
      }),
  );
}
export function capture(
  event_type: string,
  role: string,
  value: unknown,
  fields: ContentMetadata = {},
) {
  if (!capturing()) return;
  safeTelemetry(() => {
    const run = runs.getStore();
    const metadata = {
      ...identifiers(),
      sequence: run ? run.sequence++ : 0,
      event_type,
      role,
      retry_attempt: 0,
      ...fields,
    };
    const records = contentRecords(value, metadata, run?.secrets);
    telemetryDebug('content.queued', { event_type, records: records.length, ...identifiers() });
    for (const body of records) {
      telemetry()
        .logs.getLogger('visual-dxp')
        .emit({ context: context.active(), severityNumber: SeverityNumber.INFO, body });
    }
  });
}
function httpStatus(error: unknown): number | undefined {
  // SDKs may wrap transport failures; inspect only numeric status, never messages/headers.
  for (let depth = 0; depth < 4 && error && typeof error === 'object'; depth++) {
    if (
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 100 &&
      error.statusCode <= 599
    )
      return error.statusCode;
    error = 'cause' in error ? error.cause : undefined;
  }
}
export function errorType(error: unknown): string {
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
    return error.name;
  return httpStatus(error) ? 'provider_http_error' : 'operation_failed';
}
function measure(kind: 'workflow' | 'llm', seconds: number, failed: boolean, provider = 'none') {
  safeTelemetry(() => {
    const meter = telemetry().metrics.getMeter('visual-dxp');
    const dimensions = { provider, status: failed ? 'error' : 'success' };
    meter.createCounter(`dxp.${kind}.calls`).add(1, dimensions);
    if (failed) meter.createCounter(`dxp.${kind}.failures`).add(1, { provider });
    meter
      .createHistogram(
        kind === 'llm' ? 'gen_ai.client.operation.duration' : 'dxp.workflow.duration',
        {
          unit: 's',
          advice: { explicitBucketBoundaries: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 90] },
        },
      )
      .record(
        seconds,
        kind === 'llm'
          ? {
              'gen_ai.provider.name': provider,
              'gen_ai.operation.name': 'chat',
              status: dimensions.status,
            }
          : dimensions,
      );
  });
}
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
  kind = SpanKind.INTERNAL,
): Promise<T> {
  const ids = identifiers();
  let span = trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
  safeTelemetry(() => {
    const tracer = telemetry().traces.getTracer('visual-dxp');
    span = tracer.startSpan(name, {
      kind,
      attributes: {
        'workflow.run.id': ids.workflow_run_id,
        'workflow.id': ids.workflow_id,
        'workflow.step.id': ids.step_id,
        ...Object.fromEntries(
          Object.entries(attributes).map(([key, value]) => [
            key,
            typeof value === 'string'
              ? utf8Prefix(String(redact(value, runs.getStore()?.secrets)), 512)
              : value,
          ]),
        ),
      },
    });
  });
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      return await fn(span);
    } catch (error) {
      safeTelemetry(() => {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute('error.type', errorType(error));
        const status = httpStatus(error);
        if (status !== undefined) span.setAttribute('http.response.status_code', status);
      });
      throw error;
    } finally {
      safeTelemetry(() => span.end());
    }
  });
}

export function outboundContext(): Carrier {
  const carrier: Carrier = {};
  propagator.inject(context.active(), carrier, setter);
  const run = runs.getStore();
  if (run) {
    carrier['x-dxp-run-id'] = run.runId;
    carrier['x-dxp-workflow-id'] = run.workflowId;
  }
  return carrier;
}

export async function withWorkflow<T>(
  workflow: { name: string; websiteUrl: string },
  fn: () => Promise<T>,
  incoming?: Carrier,
): Promise<T> {
  if (runs.getStore()) return fn();
  // Standalone graph processes must register the context manager BEFORE extraction.
  safeTelemetry(() => {
    telemetry();
  });
  const run: Run = {
    runId: uuid(incoming?.['x-dxp-run-id']),
    workflowId: createHash('sha256')
      .update(`${workflow.websiteUrl}\n${workflow.name}`)
      .digest('hex')
      .slice(0, 24),
    sequence: 0,
    stepId: '',
    secrets: [],
  };
  const parent = incoming ? propagator.extract(ROOT_CONTEXT, incoming, getter) : context.active();
  const continued = Boolean(incoming?.['x-dxp-workflow-id'] && incoming?.traceparent);
  return runs.run(run, () =>
    context.with(parent, () =>
      withSpan(
        continued ? 'workflow.remote' : 'workflow.execute',
        { 'workflow.name': 'workflow_editor' },
        async () => {
          const started = performance.now();
          let failed = false;
          operational(continued ? 'workflow.remote.started' : 'workflow.started');
          try {
            return await fn();
          } catch (error) {
            failed = true;
            throw error;
          } finally {
            const duration = (performance.now() - started) / 1000;
            if (!continued) measure('workflow', duration, failed);
            operational(continued ? 'workflow.remote.completed' : 'workflow.completed', {
              status: failed ? 'error' : 'success',
              duration_seconds: duration,
            });
          }
        },
      ),
    ),
  );
}

export async function withStep<T>(stepId: string, fn: () => Promise<T>): Promise<T> {
  const run = runs.getStore();
  if (!run) return fn();
  const previous = run.stepId;
  run.stepId = stepId;
  try {
    return await withSpan('workflow.step', { 'workflow.step.id': stepId }, fn);
  } finally {
    run.stepId = previous;
  }
}

export interface GenerationResult {
  responseMessages: unknown[];
  finishReason: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  response?: { modelId?: string; id?: string };
}

export async function withGeneration<T extends GenerationResult>(
  options: {
    callId: string;
    provider: string;
    model: string;
    system: string;
    messages: { role: string }[];
  },
  fn: (firstToken: () => void) => Promise<T>,
): Promise<T> {
  const provider =
    options.provider === 'claude'
      ? 'anthropic'
      : options.provider === 'openai'
        ? 'openai'
        : 'local';
  return withSpan(
    `chat ${provider}`,
    {
      'gen_ai.operation.name': 'chat',
      'gen_ai.provider.name': provider,
      'gen_ai.request.model': String(redact(options.model, runs.getStore()?.secrets)),
      'gen_ai.request.max_tokens': 8192,
      'llm.call.id': options.callId,
      'retry.attempt': 0,
    },
    async (span) => {
      const started = performance.now();
      let failed = false;
      let first = false;
      const fields: ContentMetadata = {
        llm_call_id: options.callId,
        provider,
        requested_model: options.model,
      };
      let failureType = '';
      capture(
        'llm.input',
        'system',
        { role: 'system', content: options.system },
        { ...fields, message_index: 0 },
      );
      options.messages.forEach((message, index) => {
        capture('llm.input', message.role, message, { ...fields, message_index: index + 1 });
      });
      try {
        const result = await fn(() => {
          if (first) return;
          first = true;
          safeTelemetry(() => {
            const seconds = (performance.now() - started) / 1000;
            span.setAttribute('gen_ai.response.time_to_first_token', seconds);
            telemetry()
              .metrics.getMeter('visual-dxp')
              .createHistogram('gen_ai.client.time_to_first_token', {
                unit: 's',
                advice: {
                  explicitBucketBoundaries: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 90],
                },
              })
              .record(seconds, {
                'gen_ai.provider.name': provider,
                'gen_ai.operation.name': 'chat',
              });
          });
        });
        failed = !['stop', 'tool-calls'].includes(result.finishReason);
        fields.finish_reason = result.finishReason;
        if (result.response?.modelId) fields.actual_model = result.response.modelId;
        if (result.usage?.inputTokens !== undefined) fields.input_tokens = result.usage.inputTokens;
        if (result.usage?.outputTokens !== undefined)
          fields.output_tokens = result.usage.outputTokens;
        safeTelemetry(() => {
          span.setAttribute('gen_ai.response.finish_reasons', [result.finishReason]);
          if (result.response?.modelId)
            span.setAttribute(
              'gen_ai.response.model',
              utf8Prefix(String(redact(result.response.modelId, runs.getStore()?.secrets)), 512),
            );
          if (failed) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.setAttribute('error.type', 'incomplete_response');
          }
          for (const [type, count] of [
            ['input', result.usage?.inputTokens],
            ['output', result.usage?.outputTokens],
          ] as const) {
            if (count === undefined) continue;
            span.setAttribute(`gen_ai.usage.${type}_tokens`, count);
            telemetry()
              .metrics.getMeter('visual-dxp')
              .createCounter('dxp.llm.tokens')
              .add(count, { provider, token_type: type });
          }
        });
        result.responseMessages.forEach((message, index) => {
          capture('llm.output', 'assistant', message, {
            ...fields,
            message_index: index,
            partial: failed,
            finish_reason: result.finishReason,
          });
        });
        return result;
      } catch (error) {
        failureType = errorType(error);
        failed = true;
        throw error;
      } finally {
        const duration = (performance.now() - started) / 1000;
        measure('llm', duration, failed, provider);
        operational('llm.completed', {
          ...fields,
          provider,
          ...(failed ? { error_type: failureType || 'incomplete_response' } : {}),
          status: failed ? 'error' : 'success',
          duration_seconds: duration,
        });
      }
    },
    SpanKind.CLIENT,
  );
}
