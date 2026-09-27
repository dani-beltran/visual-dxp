import 'server-only';

import {
  allowsBrowserCredentials,
  type BrowserAIOverride,
  OPENAI_KEY_HEADER,
  OPENAI_MODEL_HEADER,
  OPENAI_OVERRIDE_HEADER,
  validAIKey,
  validAIModel,
} from '../../lib/aiCredentials';
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
export const CHAT_TIMEOUT_MS = 90_000;
const tooLarge = () =>
  new AIServiceError(413, 'The workflow and conversation exceed the 1 MB request limit.');
type ChatHandler = (
  request: AIChatRequest,
  signal: AbortSignal,
  override?: BrowserAIOverride,
) => Promise<AIChatResponse>;

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
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

  const hasOverride = [OPENAI_KEY_HEADER, OPENAI_MODEL_HEADER, OPENAI_OVERRIDE_HEADER].some(
    (header) => request.headers.has(header),
  );
  let override: BrowserAIOverride | undefined;
  if (hasOverride) {
    const apiKey = request.headers.get(OPENAI_KEY_HEADER) ?? '';
    const model = request.headers.get(OPENAI_MODEL_HEADER) ?? '';
    if (
      request.headers.get(OPENAI_OVERRIDE_HEADER) !== 'browser' ||
      !validAIKey(apiKey) ||
      !validAIModel(model)
    )
      return json(400, { error: 'Supply a complete, valid browser key and model override.' });
    const url = new URL(request.url);
    if (!allowsBrowserCredentials(url))
      return json(400, { error: 'Browser credentials require HTTPS.' });
    override = { apiKey, model, origin: url.origin };
  }
  const controller = new AbortController();
  const disconnected = () =>
    controller.abort(new AIServiceError(499, 'The request was cancelled.'));
  request.signal.addEventListener('abort', disconnected, { once: true });
  if (request.signal.aborted) disconnected();
  const timer = setTimeout(() => {
    controller.abort(new AIServiceError(504, 'The AI request timed out. Try a smaller change.'));
  }, CHAT_TIMEOUT_MS);
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
    if (override && JSON.stringify(input).includes(override.apiKey))
      return json(400, { error: 'Credentials must not appear in chat or workflow data.' });
    const result = await abortable(
      () => handler(input, controller.signal, override),
      controller.signal,
    );
    if (override && JSON.stringify(result).includes(override.apiKey))
      return json(502, { error: 'The AI returned an unsafe response.' });
    controller.signal.throwIfAborted();
    const parsed = parseAIChatResponse(result);
    applyWorkflowOperations(input.workflow, parsed.operations);
    return json(200, parsed);
  } catch (error) {
    const failure = controller.signal.aborted ? controller.signal.reason : error;
    if (failure instanceof AIServiceError)
      return json(failure.status, {
        error: hasOverride
          ? 'Browser AI request failed. Check the API key, model, and server configuration; no fallback was used.'
          : failure.message,
      });
    return json(502, {
      error:
        'The AI service could not finish this request. Check the model or deployment configuration and try again.',
    });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', disconnected);
  }
}
