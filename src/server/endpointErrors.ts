import 'server-only';
import { errorType } from './observability';

/** Log failures without exposing request data, credentials, or provider payloads. */
export function logEndpointError(endpoint: string, status: number, error?: unknown) {
  if (status < 500) return;
  console.error('[endpoint-error]', {
    endpoint,
    status,
    error_type: errorType(error),
  });
}
