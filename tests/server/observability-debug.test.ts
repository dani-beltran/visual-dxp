import { ExportResultCode } from '@opentelemetry/core';
import { afterEach, expect, it, vi } from 'vitest';
import {
  debugExporter,
  endpointDebug,
  exportFailure,
  telemetryDebug,
} from '../../src/server/observability/debug';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('prints diagnostics through console.debug without configuration', () => {
  const output = vi.spyOn(console, 'debug').mockImplementation(() => {});
  telemetryDebug('test', { records: 2 });
  expect(output).toHaveBeenCalledWith(
    '[otel-debug]',
    JSON.stringify({ event: 'test', records: 2 }),
  );
});

it('reports safe endpoint metadata and error categories without credentials or raw errors', () => {
  vi.stubEnv(
    'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
    'https://user:password@example.test/private-token?token=secret',
  );
  vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_HEADERS', 'Authorization=secret');
  expect(endpointDebug('traces')).toEqual({
    endpoint: 'https://example.test/[custom-path]',
    headers_configured: true,
  });
  expect(exportFailure({ code: 401, message: 'secret' })).toEqual({
    http_status: 401,
    reason: 'authentication_or_permissions',
  });
  expect(exportFailure({ code: 'ECONNREFUSED', message: 'secret' })).toEqual({
    reason: 'ECONNREFUSED',
  });
  expect(exportFailure(new Error('timeout secret'))).toEqual({ reason: 'timeout' });
  expect(exportFailure(new Error('secret'))).toEqual({ reason: 'export_error' });
});

it('preserves exporter methods and converts synchronous failures to one failed callback', () => {
  const output = vi.spyOn(console, 'debug').mockImplementation(() => {});
  const exporter = debugExporter('logs', {
    export: (_payload: unknown, _callback: (result: { code: ExportResultCode }) => void) => {
      throw new Error('secret');
    },
    selectAggregationTemporality: () => 1,
  });
  const callback = vi.fn();
  exporter.export(['private prompt'], callback);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(expect.objectContaining({ code: ExportResultCode.FAILED }));
  expect(exporter.selectAggregationTemporality()).toBe(1);
  expect(JSON.stringify(output.mock.calls)).not.toMatch(/secret|private prompt/);
});

it('console failures cannot break successful exports or invoke callbacks twice', () => {
  vi.spyOn(console, 'debug').mockImplementation(() => {
    throw new Error('console failure');
  });
  const exporter = debugExporter('traces', {
    export: (_payload: unknown, callback: (result: { code: ExportResultCode }) => void) => {
      callback({ code: ExportResultCode.SUCCESS });
      throw new Error('after completion');
    },
  });
  const callback = vi.fn();
  expect(() => exporter.export([], callback)).not.toThrow();
  expect(callback).toHaveBeenCalledExactlyOnceWith({ code: ExportResultCode.SUCCESS });
});
