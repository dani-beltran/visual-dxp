import 'server-only';
import { errorType } from './observability';
import { redact, utf8Prefix } from './observability/content';

interface EndpointErrorContext {
  method?: string;
  duration_ms?: number;
  streaming?: boolean;
  provider?: string;
  workflow_run_id?: string;
  trace_id?: string;
}

/** Select diagnostic fields explicitly; SDK errors can also contain bodies and headers. */
function errorDetails(
  error: unknown,
  secrets: string[],
  seen = new Set<object>(),
  depth = 0,
): unknown {
  const text = (value: string, limit = 2048) => utf8Prefix(String(redact(value, secrets)), limit);
  if (!error || typeof error !== 'object')
    return typeof error === 'string' ? { message: text(error) } : undefined;
  if (seen.has(error)) return { message: '[Circular error]' };
  if (seen.size >= 8) return { message: '[Error count limit]' };
  if (depth >= 4) return { message: '[Cause depth limit]' };
  seen.add(error);
  const source = error as Record<string, unknown>;
  const status = source.statusCode ?? source.status;
  return {
    ...(typeof source.name === 'string' ? { name: text(source.name, 256) } : {}),
    ...(typeof source.message === 'string' ? { message: text(source.message) } : {}),
    ...(typeof source.stack === 'string' ? { stack: text(source.stack, 8192) } : {}),
    ...(typeof source.code === 'string' || typeof source.code === 'number'
      ? { code: text(String(source.code), 256) }
      : {}),
    ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
      ? { status_code: status }
      : {}),
    ...(source.cause !== undefined
      ? { cause: errorDetails(source.cause, secrets, seen, depth + 1) }
      : {}),
    ...(Array.isArray(source.errors)
      ? {
          errors: source.errors
            .slice(0, 5)
            .map((item) => errorDetails(item, secrets, seen, depth + 1)),
        }
      : {}),
  };
}

/** Server-only diagnostics, with credential redaction before truncation. */
export function logEndpointError(
  endpoint: string,
  status: number,
  error?: unknown,
  context: EndpointErrorContext = {},
  secrets: string[] = [],
) {
  if (status < 500) return;
  try {
    // JSON keeps nested causes and stacks intact in production log collectors.
    console.error(
      '[endpoint-error]',
      JSON.stringify({
        endpoint,
        status,
        error_type: errorType(error),
        ...context,
        error: errorDetails(error, secrets),
      }),
    );
  } catch {
    // A malformed error object must not prevent the endpoint from responding.
    console.error(
      '[endpoint-error]',
      JSON.stringify({ endpoint, status, error_type: 'unreadable_error' }),
    );
  }
}
