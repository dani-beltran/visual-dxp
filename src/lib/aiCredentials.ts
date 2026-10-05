export class AIConfigurationError extends Error {}

export const AI_PROVIDERS = ['openai', 'claude', 'local'] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];
export const isAIProvider = (value: unknown): value is AIProvider =>
  AI_PROVIDERS.includes(value as AIProvider);

/** Reserved transport headers: redact credentials before any proxy logging. */
export const OPENAI_KEY_HEADER = 'X-DXP-OpenAI-Key';
export const OPENAI_MODEL_HEADER = 'X-DXP-OpenAI-Model';
export const OPENAI_OVERRIDE_HEADER = 'X-DXP-AI-Override';
export const AI_PROVIDER_HEADER = 'X-DXP-AI-Provider';
export const AI_KEY_HEADER = 'X-DXP-AI-Key';
export const AI_MODEL_HEADER = 'X-DXP-AI-Model';
export const AI_BASE_URL_HEADER = 'X-DXP-AI-Base-URL';
export const AI_RESERVED_HEADERS = [
  OPENAI_KEY_HEADER,
  OPENAI_MODEL_HEADER,
  OPENAI_OVERRIDE_HEADER,
  AI_PROVIDER_HEADER,
  AI_KEY_HEADER,
  AI_MODEL_HEADER,
  AI_BASE_URL_HEADER,
];
export function validAIKey(key: string): boolean {
  return typeof key === 'string' && /^[\x21-\x7e]{8,512}$/.test(key);
}
export function validAIModel(model: string): boolean {
  return (
    typeof model === 'string' &&
    !model.startsWith('sk-') &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)
  );
}
export function normalizeLocalBaseURL(value: string): string {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      value.length > 2000 ||
      /[\s\\]/.test(value)
    )
      throw new Error();
    return url.href.replace(/\/+$/, '');
  } catch {
    throw Object.assign(
      new AIConfigurationError(
        'Enter an HTTP(S) API base URL on localhost, 127.0.0.1, or [::1], without credentials, query, or fragment.',
      ),
      {
        messageKey: 'errors.aiCredentials.enterAValidHttpSLocalApiBaseUrlWithout',
        messageParams: {},
      },
    );
  }
}
export function resolveAIEndpoint(
  endpoint: string,
  origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): URL {
  try {
    if (!endpoint.trim()) throw new Error();
    const url = new URL(endpoint.trim(), origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
      throw new Error();
    return url;
  } catch {
    throw Object.assign(
      new AIConfigurationError(
        'Configure a valid HTTP or HTTPS AI endpoint without embedded credentials.',
      ),
      {
        messageKey: 'errors.aiCredentials.configureAValidHttpOrHttpsAiEndpointWithoutEmbedded',
        messageParams: {},
      },
    );
  }
}
