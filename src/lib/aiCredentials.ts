export class AIConfigurationError extends Error {}

export const AI_PROVIDERS = ['openai', 'claude', 'local'] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];
export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  local: 'Self-Hosted',
};
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
export interface BrowserAIOverride {
  /** Omitted only by legacy OpenAI callers. */
  provider?: AIProvider;
  source?: 'browser';
  apiKey: string;
  model: string;
  origin: string;
  baseURL?: string;
}
export type AIRequestConfiguration = BrowserAIOverride | { provider: AIProvider; source: 'server' };
export const isBrowserConfiguration = (value: AIRequestConfiguration): value is BrowserAIOverride =>
  value.source !== 'server';
export function allowsBrowserCredentials(url: URL): boolean {
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  );
}
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
        'Enter an HTTP(S) API base URL without credentials, query, or fragment.',
      ),
      {
        messageKey: 'errors.aiCredentials.enterAValidHttpSLocalApiBaseUrlWithout',
        messageParams: {},
      },
    );
  }
}
export function validBrowserConfiguration(value: BrowserAIOverride): boolean {
  const provider = value.provider ?? 'openai';
  if (
    !isAIProvider(provider) ||
    !validAIModel(value.model) ||
    (provider === 'local'
      ? value.apiKey !== '' && !validAIKey(value.apiKey)
      : !validAIKey(value.apiKey))
  )
    return false;
  if (provider !== 'local') return value.baseURL === undefined;
  try {
    return !!value.baseURL && normalizeLocalBaseURL(value.baseURL) === value.baseURL;
  } catch {
    return false;
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
