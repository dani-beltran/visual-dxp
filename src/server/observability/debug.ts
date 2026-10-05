import { type ExportResult, ExportResultCode } from '@opentelemetry/core';

/** Never pass payloads, headers or raw errors here. Diagnostics stay in the server console. */
export function telemetryDebug(
  event: string,
  fields: Record<string, string | number | boolean> = {},
) {
  try {
    console.debug('[otel-debug]', JSON.stringify({ event, ...fields }));
  } catch {
    /* Diagnostics must not affect requests or exporter callbacks. */
  }
}

export function exportFailure(error: unknown): Record<string, string | number> {
  const source = error as { code?: unknown; message?: unknown } | undefined;
  if (typeof source?.code === 'number' && source.code >= 100 && source.code <= 599) {
    return {
      http_status: source.code,
      reason:
        source.code === 401 || source.code === 403 ? 'authentication_or_permissions' : 'http_error',
    };
  }
  if (
    typeof source?.code === 'string' &&
    [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'CERT_HAS_EXPIRED',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ].includes(source.code)
  ) {
    return { reason: source.code };
  }
  return {
    reason:
      typeof source?.message === 'string' && /timeout|timed out/i.test(source.message)
        ? 'timeout'
        : 'export_error',
  };
}

export function endpointDebug(signal: 'traces' | 'logs' | 'metrics') {
  const suffix = signal.toUpperCase();
  const specific = process.env[`OTEL_EXPORTER_OTLP_${suffix}_ENDPOINT`];
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  let endpoint = 'default localhost:4318';
  if (specific || base) {
    try {
      const url = new URL(specific || `${base?.replace(/\/$/, '')}/v1/${signal}`);
      // Do not print userinfo, queries or arbitrary paths that might contain tokens.
      endpoint = `${url.protocol}//${url.host}${/^\/(otlp\/)?v1\/(traces|logs|metrics)$/.test(url.pathname) ? url.pathname : '/[custom-path]'}`;
    } catch {
      endpoint = 'invalid endpoint URL';
    }
  }
  return {
    endpoint,
    headers_configured: Boolean(
      process.env[`OTEL_EXPORTER_OTLP_${suffix}_HEADERS`] || process.env.OTEL_EXPORTER_OTLP_HEADERS,
    ),
  };
}

/** Preserve optional exporter methods (including metric temporality selection). */
export function debugExporter<
  Payload,
  T extends { export(payload: Payload, callback: (result: ExportResult) => void): void },
>(signal: string, exporter: T): T {
  const send = exporter.export.bind(exporter);
  exporter.export = (payload, callback) => {
    const started = performance.now();
    telemetryDebug('export.started', {
      signal,
      ...(Array.isArray(payload) ? { records: payload.length } : {}),
    });
    let completed = false;
    const finish = (result: ExportResult) => {
      if (completed) return;
      completed = true;
      telemetryDebug(
        result.code === ExportResultCode.SUCCESS ? 'export.succeeded' : 'export.failed',
        {
          signal,
          duration_ms: Math.round(performance.now() - started),
          ...(result.code === ExportResultCode.SUCCESS ? {} : exportFailure(result.error)),
        },
      );
      callback(result);
    };
    try {
      send(payload, finish);
    } catch (error) {
      finish({ code: ExportResultCode.FAILED, error: error instanceof Error ? error : undefined });
    }
  };
  return exporter;
}
