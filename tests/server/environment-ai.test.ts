// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AI_RESERVED_HEADERS } from '../../src/lib/aiCredentials';
import { handleChat, handleHealth } from '../../src/server/ai/http';
import { environmentProvider, resolveProviderConfiguration } from '../../src/server/ai/providers';

beforeEach(() => {
  for (const key of [
    'AI_PROVIDER',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL',
    'LOCAL_LLM_BASE_URL',
    'LOCAL_LLM_MODEL',
    'LOCAL_LLM_API_KEY',
    'LANGGRAPH_API_URL',
  ])
    vi.stubEnv(key, '');
});
afterEach(() => vi.unstubAllEnvs());
it.each(['openai', 'anthropic', 'claude', 'local'])(
  'selects and health-checks %s from environment only',
  async (provider) => {
    vi.stubEnv('AI_PROVIDER', provider);
    expect((await handleHealth().json()).configured).toBe(false);
    vi.stubEnv('OPENAI_API_KEY', 'openai-server-key');
    vi.stubEnv('OPENAI_MODEL', 'openai-model');
    vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-server-key');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-model');
    vi.stubEnv('LOCAL_LLM_BASE_URL', 'http://localhost:11434/v1');
    vi.stubEnv('LOCAL_LLM_MODEL', 'local-model');
    const resolved = resolveProviderConfiguration();
    expect(resolved.provider).toBe(provider === 'anthropic' ? 'claude' : provider);
    expect(resolved.source).toBe('server');
    expect((await handleHealth().json()).configured).toBe(true);
  },
);
it('defaults to OpenAI and rejects invalid selection without falling back', async () => {
  expect(environmentProvider()).toBe('openai');
  vi.stubEnv('AI_PROVIDER', 'invalid');
  vi.stubEnv('OPENAI_API_KEY', 'valid-key');
  expect(() => resolveProviderConfiguration()).toThrow('AI_PROVIDER');
  expect((await handleHealth().json()).configured).toBe(false);
});
it('ignores every legacy browser override header at the server boundary', async () => {
  const handler = vi.fn().mockResolvedValue({ message: 'Server', operations: [] });
  const request = new Request('https://builder.test/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        AI_RESERVED_HEADERS.map((header) => [header, 'malformed-legacy-config']),
      ),
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Explain' }],
      selectedNodeIds: [],
      workflow: { version: 1, name: 'test', websiteUrl: '', nodes: [], edges: [] },
    }),
  });
  expect((await handleChat(request, handler)).status).toBe(200);
  expect(handler.mock.calls[0][2]).toBeUndefined();
});
