export class AIConfigurationError extends Error {}

/** Reserved transport headers. Redact these before request logging or tracing. */
export const OPENAI_KEY_HEADER = 'X-DXP-OpenAI-Key';
export const OPENAI_MODEL_HEADER = 'X-DXP-OpenAI-Model';
export const OPENAI_OVERRIDE_HEADER = 'X-DXP-AI-Override';
export interface BrowserAIOverride {
  apiKey: string;
  model: string;
  origin: string;
}
export function validAIKey(key: string): boolean {
  return typeof key === 'string' && /^[\x21-\x7e]{8,512}$/.test(key);
}
export function validAIModel(model: string): boolean {
  return (
    typeof model === 'string' &&
    !model.startsWith('sk-') &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(model)
  );
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
    throw new AIConfigurationError(
      'Configure a valid HTTP or HTTPS AI endpoint without embedded credentials.',
    );
  }
}
