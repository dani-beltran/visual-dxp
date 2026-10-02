import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { debugExporter, endpointDebug, exportFailure, telemetryDebug } from './debug';
import { telemetryResource } from './resource';

export const propagator = new W3CTraceContextPropagator();
const globals = globalThis as typeof globalThis & {
  dxpTelemetry?: ReturnType<typeof createTelemetry>;
};

function createTelemetry(forceDisabled = false) {
  const disabled = forceDisabled || process.env.OTEL_SDK_DISABLED === 'true';
  const remote = Boolean(
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
  );
  telemetryDebug('initializing', {
    mode: disabled ? 'disabled' : remote ? 'otlp-http-json' : 'console',
    capture_content: process.env.CAPTURE_LLM_CONTENT === 'true',
    fallback: forceDisabled,
  });
  if (remote)
    for (const signal of ['traces', 'logs', 'metrics'] as const)
      telemetryDebug('export.configuration', { signal, ...endpointDebug(signal) });
  const resource = telemetryResource();
  const ratio = Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? 1);
  const batch = {
    maxQueueSize: 256,
    maxExportBatchSize: 16,
    scheduledDelayMillis: 1000,
    exportTimeoutMillis: 2000,
  };
  const traces = new NodeTracerProvider({
    resource,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(
        Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 1,
      ),
    }),
    spanProcessors: disabled
      ? []
      : [
          new BatchSpanProcessor(
            debugExporter(
              'traces',
              remote ? new OTLPTraceExporter({ timeoutMillis: 2000 }) : new ConsoleSpanExporter(),
            ),
            batch,
          ),
        ],
  });
  const logs = new LoggerProvider({
    resource,
    loggerConfigurator: () => ({ disabled, minimumSeverity: 0, traceBased: false }),
    processors: disabled
      ? []
      : [
          new BatchLogRecordProcessor({
            ...batch,
            exporter: debugExporter(
              'logs',
              remote
                ? new OTLPLogExporter({ timeoutMillis: 2000 })
                : new ConsoleLogRecordExporter(),
            ),
          }),
        ],
  });
  const metrics = new MeterProvider({
    resource,
    views: [{ instrumentName: '*', aggregationCardinalityLimit: 64 }],
    readers: disabled
      ? []
      : [
          new PeriodicExportingMetricReader({
            exporter: debugExporter(
              'metrics',
              remote
                ? new OTLPMetricExporter({ timeoutMillis: 2000 })
                : new ConsoleMetricExporter(),
            ),
            exportIntervalMillis: 60000,
            exportTimeoutMillis: 2500,
          }),
        ],
  });
  traces.register({ propagator });
  telemetryDebug('initialized', {
    sampling_ratio: Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 1,
    queue_capacity: 256,
    export_timeout_ms: 2000,
  });
  return { traces, logs, metrics };
}

export function telemetry() {
  if (!globals.dxpTelemetry) {
    try {
      globals.dxpTelemetry = createTelemetry();
    } catch (error) {
      telemetryDebug('initialization.failed', exportFailure(error));
      globals.dxpTelemetry = createTelemetry(true);
    }
  }
  return globals.dxpTelemetry;
}

/** Exporter errors and flush timeouts are never request failures. */
export async function flushTelemetry() {
  try {
    const sdk = globals.dxpTelemetry;
    if (!sdk) {
      telemetryDebug('flush.skipped', { reason: 'not_initialized' });
      return;
    }
    telemetryDebug('flush.started');
    const results = await Promise.allSettled([
      sdk.traces.forceFlush(),
      sdk.logs.forceFlush({ timeoutMillis: 2500 }),
      sdk.metrics.forceFlush({ timeoutMillis: 2500 }),
    ]);
    results.forEach((result, index) => {
      telemetryDebug(result.status === 'fulfilled' ? 'flush.completed' : 'flush.failed', {
        signal: ['traces', 'logs', 'metrics'][index],
        ...(result.status === 'rejected' ? exportFailure(result.reason) : {}),
      });
    });
  } catch (error) {
    telemetryDebug('flush.failed', exportFailure(error));
  }
}

export async function shutdownTelemetry() {
  const sdk = globals.dxpTelemetry;
  if (sdk)
    await Promise.allSettled([sdk.traces.shutdown(), sdk.logs.shutdown(), sdk.metrics.shutdown()]);
}
