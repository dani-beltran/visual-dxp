import 'server-only';

import {
  AI_BASE_URL_HEADER,
  AI_KEY_HEADER,
  AI_MODEL_HEADER,
  AI_PROVIDER_HEADER,
  type AIRequestConfiguration,
  allowsBrowserCredentials,
  isAIProvider,
  isBrowserConfiguration,
  OPENAI_KEY_HEADER,
  OPENAI_MODEL_HEADER,
  OPENAI_OVERRIDE_HEADER,
  validBrowserConfiguration,
} from '../../lib/aiCredentials';
import { getAIEditFailure } from '../../lib/aiErrors';
import { safeTextEmitter } from '../../lib/aiStream';
import { identifiers, withWorkflow } from '../observability';
import { aiRateLimitKey, allowAIRequest } from './access';
import { AIServiceError, respondToAIChat } from './agent';
import {
  type AIChatRequest,
  type AIChatResponse,
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
} from './workflow/ai';

const maxBodyBytes = 1024 * 1024;
export const CHAT_TIMEOUT_MS = 180_000;
const tooLarge = () =>
  new AIServiceError(413, 'The workflow and conversation exceed the 1 MB request limit.');
type ChatHandler = (
  request: AIChatRequest,
  signal: AbortSignal,
  override?: AIRequestConfiguration,
  onText?: (text: string) => void,
  onReasoning?: (text: string) => void,
) => Promise<AIChatResponse>;

function json(status: number, body: unknown, correlation: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      ...correlation,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin, Sec-Fetch-Site',
    },
  });
}

/** Browser-origin protection, not authentication. No cross-origin CORS grants. */
function allowedOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser clients do not send browser origin metadata.
  try {
    const parsed = new URL(origin);
    const url = new URL(request.url);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      parsed.origin === origin &&
      parsed.protocol === url.protocol &&
      parsed.host === (request.headers.get('host') ?? url.host)
    );
  } catch {
    return false;
  }
}

/** Bound even a provider or stream implementation that ignores AbortSignal. */
function abortable<T>(start: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason);
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return start();
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', stop));
  });
}

async function readJSON(request: Request, signal: AbortSignal): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new AIServiceError(400, 'Send a valid JSON chat request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await abortable(() => reader.read(), signal);
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > maxBodyBytes) throw tooLarge();
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    } catch {
      throw new AIServiceError(400, 'Send a valid JSON chat request.');
    }
  } finally {
    // Never wait for a stalled upload's cancellation acknowledgement.
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function handleHealth(): Response {
  const deployment = Boolean(process.env.LANGGRAPH_API_URL?.trim());
  return json(200, {
    configured: deployment || Boolean(process.env.OPENAI_API_KEY?.trim()),
    mode: deployment ? 'deployment' : 'local',
  });
}

export async function handleChat(
  request: Request,
  handler: ChatHandler = respondToAIChat,
): Promise<Response> {
  if (!allowedOrigin(request)) return json(403, { error: 'The request origin is not allowed.' });
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return json(415, { error: 'Send the request as application/json.' });
  if (Number(request.headers.get('content-length')) > maxBodyBytes) {
    void request.body?.cancel().catch(() => {});
    return json(413, { error: tooLarge().message });
  }

  const provider = request.headers.get(AI_PROVIDER_HEADER) ?? 'openai';
  if (!isAIProvider(provider)) return json(400, { error: 'Unsupported AI provider.' });
  const legacy = request.headers.has(OPENAI_KEY_HEADER) || request.headers.has(OPENAI_MODEL_HEADER);
  const generic = request.headers.has(AI_KEY_HEADER) || request.headers.has(AI_MODEL_HEADER);
  if (
    (legacy && (provider !== 'openai' || generic)) ||
    (provider !== 'local' && request.headers.has(AI_BASE_URL_HEADER))
  )
    return json(400, {
      error: 'Provider credentials or destination do not match the selected provider.',
    });
  const hasOverride =
    legacy ||
    generic ||
    request.headers.has(OPENAI_OVERRIDE_HEADER) ||
    request.headers.has(AI_BASE_URL_HEADER);
  let override: AIRequestConfiguration | undefined =
    provider === 'openai' ? undefined : { provider, source: 'server' };
  if (hasOverride) {
    const apiKey = request.headers.get(legacy ? OPENAI_KEY_HEADER : AI_KEY_HEADER) ?? '';
    const model = request.headers.get(legacy ? OPENAI_MODEL_HEADER : AI_MODEL_HEADER) ?? '';
    const url = new URL(request.url);
    const browser = {
      provider,
      source: 'browser' as const,
      apiKey,
      model,
      origin: url.origin,
      ...(request.headers.has(AI_BASE_URL_HEADER)
        ? { baseURL: request.headers.get(AI_BASE_URL_HEADER)! }
        : {}),
    };
    if (
      request.headers.get(OPENAI_OVERRIDE_HEADER) !== 'browser' ||
      !validBrowserConfiguration(browser)
    )
      return json(400, {
        error: 'Supply a complete, valid configuration for the selected provider.',
      });
    if (!allowsBrowserCredentials(url))
      return json(400, { error: 'Browser credentials require HTTPS.' });
    override = browser;
  }
  const browserKey = override && isBrowserConfiguration(override) ? override.apiKey : '';
  const controller = new AbortController();
  const disconnected = () =>
    controller.abort(new AIServiceError(499, 'The request was cancelled.'));
  request.signal.addEventListener('abort', disconnected, { once: true });
  if (request.signal.aborted) disconnected();
  const timer = setTimeout(() => {
    controller.abort(new AIServiceError(504, 'The AI request timed out. Try a smaller change.'));
  }, CHAT_TIMEOUT_MS);
  let streaming = false;
  const telemetryHeaders: Record<string, string> = {};
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', disconnected);
  };
  try {
    const raw = await readJSON(request, controller.signal);
    let input: AIChatRequest;
    try {
      input = parseAIChatRequest(raw);
    } catch (error) {
      throw new AIServiceError(
        400,
        error instanceof Error ? error.message : 'Invalid chat request.',
      );
    }
    if (!allowAIRequest(aiRateLimitKey(request)))
      return json(429, { error: 'AI request limit reached. Try again in a minute.' });
    if (browserKey && JSON.stringify(input).includes(browserKey))
      return json(400, { error: 'Credentials must not appear in chat or workflow data.' });
    const execute = (onText?: (text: string) => void, onReasoning?: (text: string) => void) =>
      withWorkflow(
        input.workflow,
        async () => {
          const ids = identifiers();
          telemetryHeaders['X-DXP-Run-Id'] = ids.workflow_run_id;
          telemetryHeaders['X-DXP-Trace-Id'] = ids.trace_id;
          const result = await abortable(
            () => handler(input, controller.signal, override, onText, onReasoning),
            controller.signal,
          );
          controller.signal.throwIfAborted();
          if (browserKey && JSON.stringify(result).includes(browserKey))
            throw new AIServiceError(502, 'The AI returned an unsafe response.');
          const parsed = parseAIChatResponse(result);
          applyWorkflowOperations(input.workflow, parsed.operations);
          return parsed;
        },
        {
          traceparent: request.headers.get('traceparent') ?? '',
          tracestate: request.headers.get('tracestate') ?? '',
          'x-dxp-run-id': request.headers.get('x-dxp-run-id') ?? '',
        },
      );
    if (request.headers.get('accept')?.includes('application/x-ndjson')) {
      streaming = true;
      const encoder = new TextEncoder();
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          const send = (event: unknown) => {
            if (!cancelled) stream.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };
          const emit = safeTextEmitter(browserKey, (text) => send({ type: 'text', text }));
          const emitReasoning = safeTextEmitter(browserKey, (text) =>
            send({ type: 'reasoning', text }),
          );
          void (async () => {
            try {
              const result = await execute(
                (text) => {
                  controller.signal.throwIfAborted();
                  emit(text);
                },
                (text) => {
                  controller.signal.throwIfAborted();
                  emitReasoning(text);
                },
              );
              controller.signal.throwIfAborted();
              if (browserKey && JSON.stringify(result).includes(browserKey))
                throw new Error('Unsafe response.');
              const parsed = parseAIChatResponse(result);
              applyWorkflowOperations(input.workflow, parsed.operations);
              emit('', true);
              emitReasoning('', true);
              send({ type: 'result', response: parsed });
            } catch (error) {
              const failure = controller.signal.aborted ? controller.signal.reason : error;
              const edit =
                failure instanceof AIServiceError ? getAIEditFailure(failure) : undefined;
              send({ type: 'error', ...(edit ? { code: edit.code, error: edit.message } : {}) });
            } finally {
              cleanup();
              if (!cancelled) stream.close();
            }
          })();
        },
        cancel() {
          cancelled = true;
          disconnected();
          cleanup();
        },
      });
      return new Response(body, {
        headers: {
          ...telemetryHeaders,
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          'X-Content-Type-Options': 'nosniff',
          'X-Accel-Buffering': 'no',
          Vary: 'Origin, Sec-Fetch-Site, Accept',
        },
      });
    }
    const result = await abortable(() => execute(), controller.signal);
    if (browserKey && JSON.stringify(result).includes(browserKey))
      return json(502, { error: 'The AI returned an unsafe response.' });
    controller.signal.throwIfAborted();
    const parsed = parseAIChatResponse(result);
    applyWorkflowOperations(input.workflow, parsed.operations);
    const response = json(200, parsed);
    for (const [key, value] of Object.entries(telemetryHeaders)) response.headers.set(key, value);
    return response;
  } catch (error) {
    const failure = controller.signal.aborted ? controller.signal.reason : error;
    const edit = getAIEditFailure(failure);
    if (failure instanceof AIServiceError)
      return json(
        failure.status,
        {
          ...(failure.code ? { code: failure.code } : {}),
          error:
            edit?.message ??
            (hasOverride && !failure.code
              ? 'Browser AI request failed. Check the API key, model, and server configuration; no fallback was used.'
              : failure.message),
        },
        telemetryHeaders,
      );
    return json(
      502,
      {
        error:
          'The AI service could not finish this request. Check the model or deployment configuration and try again.',
      },
      telemetryHeaders,
    );
  } finally {
    if (!streaming) cleanup();
  }
}
