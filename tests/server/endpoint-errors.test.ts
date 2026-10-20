import { afterEach, expect, it, vi } from 'vitest';
import { logEndpointError } from '../../src/server/endpointErrors';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('logs useful nested diagnostics as JSON without dumping SDK payloads', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const cause = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
  const error = Object.assign(new Error('Model server failed', { cause }), {
    statusCode: 503,
    headers: { authorization: 'private-header' },
    requestBody: 'private-request',
    responseBody: 'private-response',
  });
  logEndpointError('/api/test', 502, error, { method: 'POST', trace_id: 'trace' });
  expect(log).toHaveBeenCalledExactlyOnceWith('[endpoint-error]', expect.any(String));
  const record = JSON.parse(log.mock.calls[0][1]);
  expect(record).toMatchObject({
    endpoint: '/api/test',
    status: 502,
    error_type: 'provider_http_error',
    method: 'POST',
    trace_id: 'trace',
    error: {
      name: 'Error',
      message: 'Model server failed',
      status_code: 503,
      stack: expect.stringContaining('endpoint-errors.test.ts'),
      cause: { message: 'Connection refused', code: 'ECONNREFUSED' },
    },
  });
  expect(log.mock.calls[0][1]).not.toContain('private-');
});

it('redacts environment and browser credentials in messages, stacks, and causes before truncating', () => {
  vi.stubEnv('OPENAI_API_KEY', 'environment-key-value');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error(
    'environment-key-value browser-key-value Authorization: Bearer token-value',
    {
      cause: new Error('api_key="unknown-key-value" browser-key-value'),
    },
  );
  logEndpointError('/api/test', 500, error, {}, ['browser-key-value']);
  const output = log.mock.calls[0][1];
  expect(output).toContain('[REDACTED]');
  expect(output).not.toMatch(
    /environment-key-value|browser-key-value|token-value|unknown-key-value/,
  );
});

it('bounds long diagnostics and handles circular causes and aggregate errors', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const cause = new Error('nested');
  cause.cause = cause;
  const error = new AggregateError([cause], 'x'.repeat(20_000));
  logEndpointError('/api/test', 500, error);
  const details = JSON.parse(log.mock.calls[0][1]).error;
  expect(Buffer.byteLength(details.message)).toBeLessThanOrEqual(2048);
  expect(Buffer.byteLength(details.stack)).toBeLessThanOrEqual(8192);
  expect(details.errors[0].cause.message).toBe('[Circular error]');
});

it('handles thrown strings and failures without an exception', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  logEndpointError('/api/test', 500, 'Unexpected server failure');
  expect(JSON.parse(log.mock.calls[0][1]).error.message).toBe('Unexpected server failure');
  logEndpointError('/api/test', 503);
  expect(JSON.parse(log.mock.calls[1][1])).toMatchObject({ endpoint: '/api/test', status: 503 });
});

it('keeps client errors quiet and still logs when an error has an unreadable property', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  logEndpointError('/api/test', 400, new Error('Invalid request'));
  expect(log).not.toHaveBeenCalled();
  logEndpointError('/api/test', 500, {
    get message() {
      throw new Error('unreadable');
    },
  });
  expect(JSON.parse(log.mock.calls[0][1]).error_type).toBe('unreadable_error');
});
