// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestAIChat } from '../src/lib/ai';
import {
  AI_BASE_URL_HEADER,
  AI_KEY_HEADER,
  AI_PROVIDER_HEADER,
  OPENAI_KEY_HEADER,
} from '../src/lib/aiCredentials';
import { AI_SETTINGS_STORAGE_KEY, AISettingsStore } from '../src/lib/aiSettings';
import { defaultWorkflow } from '../src/lib/catalog';

const endpoint = 'https://builder.test/api/ai/chat';
const pass = 'long unique passphrase';
const local = { apiKey: '', model: 'org/model:tag', baseURL: 'http://127.0.0.1:11434/v1' };
const openai = { apiKey: 'sk-openai-secret', model: 'openai-model' };
const claude = { apiKey: 'sk-ant-claude-secret', model: 'claude-model' };
const get = (store: AISettingsStore) => store.forRequest(endpoint, new AbortController());
const saved = () => JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)!);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('persists viewed and active providers independently and keeps three saved configurations', async () => {
  const store = new AISettingsStore();
  expect(store.getSnapshot().activeProvider).toBe('openai');
  await store.saveProvider('openai', openai, pass, endpoint);
  await store.saveProvider('claude', claude, pass, endpoint);
  await store.saveProvider('local', local, '', endpoint);
  store.view('claude');
  expect(get(store)).toMatchObject({ provider: 'local', ...local });
  const restored = new AISettingsStore();
  restored.refresh();
  expect(restored.getSnapshot()).toMatchObject({
    activeProvider: 'local',
    viewedProvider: 'claude',
    status: 'unlocked',
    providers: {
      openai: { status: 'locked', model: openai.model },
      claude: { status: 'locked', model: claude.model },
    },
  });
  expect(() => restored.activate('claude')).toThrow(/Unlock/);
  await restored.unlock(pass, 'claude');
  restored.activate('claude');
  expect(get(restored)).toMatchObject({ provider: 'claude', ...claude });
  expect(Object.keys(saved().providers)).toHaveLength(3);
  restored.remove('claude');
  expect(get(restored)).toEqual({ provider: 'claude', source: 'server' });
  expect(restored.getSnapshot().activeProvider).toBe('claude');
  expect(saved().providers.local.model).toBe(local.model);
});
it('only cancels when the effective configuration changes, including server-default requests', async () => {
  const store = new AISettingsStore();
  const request = new AbortController();
  store.forRequest(endpoint, request);
  store.view('local');
  expect(request.signal.aborted).toBe(false);
  await store.saveProvider('local', local, '', endpoint);
  expect(request.signal.aborted).toBe(true);
  const second = new AbortController();
  store.forRequest(endpoint, second);
  store.view('openai');
  store.lockProvider('claude');
  expect(second.signal.aborted).toBe(false);
  store.activate('openai', true);
  expect(second.signal.aborted).toBe(true);
  const third = new AbortController();
  store.forRequest(endpoint, third);
  store.lock();
  expect(third.signal.aborted).toBe(true);
});
it('preserves usable active settings and pending requests after validation or storage save failure', async () => {
  const store = new AISettingsStore();
  await store.saveProvider('openai', openai, pass, endpoint);
  const request = new AbortController();
  store.forRequest(endpoint, request);
  await expect(
    store.saveProvider('claude', { ...claude, model: '' }, pass, endpoint),
  ).rejects.toThrow();
  const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await expect(store.saveProvider('claude', claude, pass, endpoint)).rejects.toThrow(/preserved/);
  expect(store.getSnapshot().activeProvider).toBe('openai');
  expect(get(store)).toMatchObject(openai);
  expect(request.signal.aborted).toBe(false);
  expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe(raw);
});
it('accepts unauthenticated local settings without Web Crypto and encrypts optional keys when present', async () => {
  const store = new AISettingsStore();
  vi.stubGlobal('crypto', {});
  await store.saveProvider('local', local, '', endpoint);
  expect(saved().providers.local.credential).toBeUndefined();
  vi.stubGlobal('crypto', webcrypto);
  await store.saveProvider('local', { ...local, apiKey: 'local-secret-key' }, pass, endpoint);
  expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).not.toContain('local-secret-key');
  store.lock();
  expect(() => get(store)).toThrow(/Unlock Local/);
  await store.unlock(pass, 'local');
  expect(get(store)).toMatchObject({ apiKey: 'local-secret-key' });
});
it('authenticates provider and local destination so encrypted keys cannot be transplanted', async () => {
  const store = new AISettingsStore();
  await store.saveProvider('openai', openai, pass, endpoint);
  let doc = saved();
  doc.providers.claude = doc.providers.openai;
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(doc));
  await expect(store.unlock(pass, 'claude')).rejects.toThrow(/Could not unlock/);
  await store.saveProvider('local', { ...local, apiKey: 'local-secret-key' }, pass, endpoint);
  doc = saved();
  doc.providers.local.baseURL = 'http://127.0.0.1:1234/v1';
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(doc));
  await expect(store.unlock(pass, 'local')).rejects.toThrow(/Could not unlock/);
});
it('refreshes cross-tab navigation without locking or cancellation; effective changes lock and cancel', async () => {
  const one = new AISettingsStore();
  await one.saveProvider('openai', openai, pass, endpoint);
  const two = new AISettingsStore();
  two.refresh();
  const request = new AbortController();
  one.forRequest(endpoint, request);
  two.view('claude');
  one.refresh();
  expect(one.getSnapshot().viewedProvider).toBe('claude');
  expect(get(one)).toMatchObject(openai);
  expect(request.signal.aborted).toBe(false);
  await two.saveProvider('local', local, '', endpoint);
  one.refresh();
  expect(request.signal.aborted).toBe(true);
  expect(get(one)).toMatchObject({ provider: 'local' });
  const localRequest = new AbortController();
  one.forRequest(endpoint, localRequest);
  await two.saveProvider('local', { ...local, model: 'different-model' }, '', endpoint);
  one.refresh();
  expect(localRequest.signal.aborted).toBe(true);
});
it('migrates genuine v1 ciphertext without losing its key or requiring re-entry', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pass),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000, salt },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const origin = new URL(endpoint).origin;
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(JSON.stringify([1, origin, openai.model])),
    },
    key,
    new TextEncoder().encode(openai.apiKey),
  );
  localStorage.setItem(
    AI_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      model: openai.model,
      origin,
      salt: [...salt],
      iv: [...iv],
      ciphertext: [...new Uint8Array(ciphertext)],
    }),
  );
  const store = new AISettingsStore();
  store.refresh();
  expect(store.getSnapshot()).toMatchObject({
    activeProvider: 'openai',
    viewedProvider: 'openai',
    status: 'locked',
  });
  store.view('local');
  expect(saved().version).toBe(2);
  await store.unlock(pass, 'openai');
  expect(get(store)).toMatchObject(openai);
  await store.saveProvider('local', local, '', endpoint);
  const restored = new AISettingsStore();
  restored.refresh();
  await restored.unlock(pass, 'openai');
  restored.activate('openai');
  expect(get(restored)).toMatchObject(openai);
});
it('transports only the active provider configuration and keeps optional local auth truly absent', async () => {
  const store = new AISettingsStore();
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(Response.json({ message: 'Ready', operations: [] })));
  vi.stubGlobal('fetch', fetcher);
  for (const provider of ['claude', 'local'] as const) {
    await store.saveProvider(provider, provider === 'local' ? local : claude, pass, endpoint);
    store.view('openai');
    await requestAIChat(
      { endpoint },
      {
        messages: [{ role: 'user', content: 'Explain' }],
        workflow: defaultWorkflow,
        selectedNodeIds: [],
      },
      undefined,
      get(store),
    );
    const headers = fetcher.mock.calls.at(-1)![1].headers as Headers;
    expect(headers.get(AI_PROVIDER_HEADER)).toBe(provider);
    expect(headers.has(OPENAI_KEY_HEADER)).toBe(false);
    expect(headers.get(AI_KEY_HEADER)).toBe(provider === 'local' ? null : claude.apiKey);
    expect(headers.get(AI_BASE_URL_HEADER)).toBe(provider === 'local' ? local.baseURL : null);
  }
});

it('recovers one damaged provider without losing healthy configurations or changing selection', async () => {
  const store = new AISettingsStore();
  await store.saveProvider('openai', openai, pass, endpoint);
  await store.saveProvider('local', local, '', endpoint);
  const doc = saved();
  doc.providers.claude = { model: 'broken', credential: {} };
  doc.activeProvider = 'claude';
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(doc));
  store.refresh();
  expect(store.getSnapshot()).toMatchObject({ activeProvider: 'claude', status: 'unavailable' });
  expect(() => get(store)).toThrow(/damaged/);
  store.remove('claude');
  expect(get(store)).toEqual({ provider: 'claude', source: 'server' });
  expect(saved().providers.local.model).toBe(local.model);
  await store.unlock(pass, 'openai');
  store.activate('openai');
  expect(get(store)).toMatchObject(openai);
});
