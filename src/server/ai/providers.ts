import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { streamText } from 'ai';
import {
  type AIProvider,
  type AIRequestConfiguration,
  isAIProvider,
  isBrowserConfiguration,
  normalizeLocalBaseURL,
  validAIKey,
  validAIModel,
  validBrowserConfiguration,
} from '../../lib/aiCredentials';
import { serverEvents } from '../../lib/aiStream';
import { AIServiceError } from './errors';

export interface ProviderConfiguration {
  provider: AIProvider;
  source: 'browser' | 'server';
  apiKey: string;
  model: string;
  baseURL: string;
}

/** Request visible summaries while preserving the total output-token limit. */
export function providerGenerationOptions(
  config: ProviderConfiguration,
): Pick<Parameters<typeof streamText>[0], 'providerOptions' | 'maxOutputTokens'> {
  const maxOutputTokens = 8192;
  if (config.provider === 'openai')
    return {
      maxOutputTokens,
      providerOptions: {
        openai: {
          store: false,
          strictJsonSchema: false,
          include: ['reasoning.encrypted_content'],
          reasoningSummary: 'auto',
        },
      },
    };
  // Chat Completions has no standard summary option. Compatible servers can
  // accept this extension and expose reasoning_content/reasoning deltas.
  if (config.provider === 'local')
    return { maxOutputTokens, providerOptions: { local: { reasoning: { summary: 'auto' } } } };

  const adaptive =
    /^claude-(?:(?:opus|sonnet)-4-[678]|(?:opus|sonnet|fable|mythos)-5(?:-[15])?|mythos-preview)(?:-\d{8}|-latest)?$/.test(
      config.model,
    );
  if (adaptive)
    return {
      maxOutputTokens,
      providerOptions: { anthropic: { thinking: { type: 'adaptive', display: 'summarized' } } },
    };
  const extended =
    /^claude-(?:(?:opus|sonnet)-4(?:-[015])?|haiku-4-5|3-7-sonnet)(?:-\d{8}|-latest)?$/.test(
      config.model,
    );
  if (extended) {
    const budgetTokens = 2048;
    return {
      // The Anthropic SDK adds the thinking budget to maxOutputTokens.
      maxOutputTokens: maxOutputTokens - budgetTokens,
      providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens } } },
    };
  }
  // Unknown/older model IDs retain their existing behavior.
  return { maxOutputTokens };
}
export function allowedLocalBaseURL(value: string): string {
  try {
    const url = new URL(normalizeLocalBaseURL(value));
    // Avoid DNS resolution for localhost: the destination must remain loopback.
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new AIServiceError(
      400,
      'Local models require a localhost, 127.0.0.1, or [::1] API base URL on the backend machine.',
      'local_destination',
    );
  }
}

export function resolveProviderConfiguration(
  input?: AIRequestConfiguration,
): ProviderConfiguration {
  const provider = input?.provider ?? 'openai';
  if (!isAIProvider(provider)) throw new AIServiceError(400, 'Unsupported AI provider.');
  if (input && isBrowserConfiguration(input)) {
    if (!validBrowserConfiguration(input))
      throw new AIServiceError(400, 'Supply valid settings for the selected provider.');
    return {
      provider,
      source: 'browser',
      apiKey: input.apiKey,
      model: input.model,
      baseURL:
        provider === 'local'
          ? allowedLocalBaseURL(input.baseURL!)
          : provider === 'openai'
            ? 'https://api.openai.com/v1'
            : 'https://api.anthropic.com/v1',
    };
  }
  const apiKey =
    (provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'claude'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.LOCAL_LLM_API_KEY
    )?.trim() ?? '';
  const model =
    (provider === 'openai'
      ? process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna'
      : provider === 'claude'
        ? process.env.ANTHROPIC_MODEL
        : process.env.LOCAL_LLM_MODEL
    )?.trim() ?? '';
  if (!validAIModel(model) || (provider === 'local' ? !!apiKey && !validAIKey(apiKey) : !apiKey))
    throw new AIServiceError(
      503,
      'Configure the selected provider in AI Settings before using the assistant.',
      'provider_unconfigured',
    );
  return {
    provider,
    source: 'server',
    apiKey,
    model,
    baseURL:
      provider === 'local'
        ? allowedLocalBaseURL(process.env.LOCAL_LLM_BASE_URL ?? '')
        : provider === 'openai'
          ? 'https://api.openai.com/v1'
          : 'https://api.anthropic.com/v1',
  };
}
/** Pin the exact request URL; never follow even same-origin redirects. Bound upstream bodies. */
function privateFetch(destination: string, apiKey: string): typeof fetch {
  return async (url, init) => {
    if (String(url) !== destination) throw new Error('Invalid provider destination.');
    const response = await fetch(url, { ...init, redirect: 'error', cache: 'no-store' });
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      void response.body?.cancel().catch(() => {});
      throw new Error('Provider redirects are not allowed.');
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw Object.assign(new Error('Provider rejected request.'), { statusCode: response.status });
    }
    const limit = 2 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) {
      void response.body?.cancel().catch(() => {});
      throw new Error('Provider response too large.');
    }
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const encoder = new TextEncoder();
      const events = serverEvents(response, limit);
      return new Response(
        new ReadableStream({
          async pull(controller) {
            try {
              const { value, done } = await events.next();
              if (done) {
                controller.close();
                return;
              }
              init?.signal?.throwIfAborted();
              if (
                value.data !== '[DONE]' &&
                apiKey &&
                JSON.stringify(JSON.parse(value.data)).includes(apiKey)
              )
                throw new Error('Unsafe provider response.');
              controller.enqueue(
                encoder.encode(
                  `${value.event ? `event: ${value.event}\n` : ''}data: ${value.data}\n\n`,
                ),
              );
            } catch (error) {
              controller.error(error);
              await events.return(undefined);
            }
          },
          async cancel() {
            await events.return(undefined);
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty provider response.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        init?.signal?.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          void reader.cancel().catch(() => {});
          throw new Error('Provider response too large.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = Buffer.concat(chunks, size).toString('utf8');
    // Decode first to detect keys reflected using JSON escape sequences.
    if (apiKey && JSON.stringify(JSON.parse(body)).includes(apiKey))
      throw new Error('Unsafe provider response.');
    return new Response(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
export function createProviderModel(config: ProviderConfiguration) {
  if (config.provider === 'openai')
    return createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      fetch: privateFetch(`${config.baseURL}/responses`, config.apiKey),
    }).responses(config.model);
  if (config.provider === 'claude')
    return createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      fetch: privateFetch(`${config.baseURL}/messages`, config.apiKey),
    }).messages(config.model);
  return createOpenAICompatible({
    name: 'local',
    baseURL: config.baseURL,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    fetch: privateFetch(`${config.baseURL}/chat/completions`, config.apiKey),
  }).chatModel(config.model);
}
