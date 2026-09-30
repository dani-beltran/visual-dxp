// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAIChat } from '../src/lib/ai';
import {
  isBrowserConfiguration,
  OPENAI_KEY_HEADER,
  OPENAI_MODEL_HEADER,
  resolveAIEndpoint,
} from '../src/lib/aiCredentials';
import { AI_SETTINGS_STORAGE_KEY, AISettingsStore } from '../src/lib/aiSettings';
import { defaultWorkflow } from '../src/lib/catalog';
import { exportWorkflow } from '../src/lib/export';

const apiKey = 'sk-test-browser-private';
const model = 'test-model';
const passphrase = 'correct horse battery staple';
const endpoint = 'https://ai.example.test/api/ai/chat';
const request = {
  messages: [{ role: 'user' as const, content: 'Explain this workflow' }],
  workflow: defaultWorkflow,
  selectedNodeIds: [],
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const get = (store: AISettingsStore, url = endpoint) => {
  const result = store.forRequest(url, new AbortController());
  return result && isBrowserConfiguration(result) ? result : undefined;
};

describe('encrypted browser settings', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'saves, reloads, unlocks, and sends browser credentials over HTTP on %s',
    async (hostname) => {
      const url = `http://${hostname}:3000/api/ai/chat`;
      const store = new AISettingsStore();
      await store.save(apiKey, model, passphrase, url);
      const reloaded = new AISettingsStore();
      reloaded.refresh();
      expect(reloaded.getSnapshot().status).toBe('locked');
      await reloaded.unlock(passphrase);
      const override = get(reloaded, url);
      expect(override).toMatchObject({ apiKey, model, origin: new URL(url).origin });
      const fetcher = vi
        .fn()
        .mockResolvedValue(Response.json({ message: 'Ready', operations: [] }));
      vi.stubGlobal('fetch', fetcher);
      await requestAIChat({ endpoint: url }, request, undefined, override);
      expect(fetcher.mock.calls[0][1].headers.get(OPENAI_KEY_HEADER)).toBe(apiKey);
      const otherPort = `http://${hostname}:4000/chat`;
      expect(() => get(reloaded, otherPort)).toThrow(/origin changed/);
      reloaded.confirmOrigin(otherPort);
      expect(get(reloaded, otherPort)?.origin).toBe(new URL(otherPort).origin);
    },
  );
  it.each(['ai.example.test', 'localhost.example.test', '127.0.0.1.example.test', '192.168.1.1'])(
    'keeps HTTPS required for %s',
    async (hostname) => {
      const store = new AISettingsStore();
      const url = `http://${hostname}/chat`;
      await expect(store.save(apiKey, model, passphrase, url)).rejects.toThrow(/HTTPS/);
      expect(() => store.confirmOrigin(url)).toThrow(/HTTPS/);
    },
  );
  it('encrypts with fresh salts and IVs, persists no key material, and requires unlocking after reload', async () => {
    const store = new AISettingsStore();
    await store.save(apiKey, model, passphrase, endpoint);
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY)!;
    const document = JSON.parse(raw);
    const first = document.providers.openai.credential;
    expect(document.version).toBe(2);
    expect(raw).not.toContain(apiKey);
    expect(raw).not.toContain(passphrase);
    expect(Object.keys(first).sort()).toEqual(['ciphertext', 'iv', 'salt', 'version']);
    expect(first.iv).toHaveLength(12);
    expect(first.salt).toHaveLength(16);
    expect(JSON.stringify(store.getSnapshot())).not.toContain(apiKey);
    expect(get(store)).toMatchObject({ apiKey, model, origin: 'https://ai.example.test' });
    const reloaded = new AISettingsStore();
    reloaded.refresh();
    expect(() => get(reloaded)).toThrow(/Unlock/);
    await expect(reloaded.unlock('wrong password')).rejects.toThrow(/passphrase/);
    await reloaded.unlock(passphrase);
    expect(get(reloaded)?.apiKey).toBe(apiKey);
    const controller = new AbortController();
    reloaded.forRequest(endpoint, controller);
    reloaded.lock();
    expect(controller.signal.aborted).toBe(true);
    expect(() => get(reloaded)).toThrow(/Unlock/);
    await store.save(apiKey, model, passphrase, endpoint);
    const second = JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)!).providers.openai
      .credential;
    expect(first.iv).not.toEqual(second.iv);
    expect(first.salt).not.toEqual(second.salt);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
    store.remove();
    expect(get(store)).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)!).providers).toEqual({});
  });
  it('authenticates stored model and origin and blocks damaged settings', async () => {
    const store = new AISettingsStore();
    await store.save(apiKey, model, passphrase, endpoint);
    const value = JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)!);
    value.providers.openai.origin = 'https://evil.test';
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(value));
    await expect(store.unlock(passphrase)).rejects.toThrow(/Could not unlock/);
    expect(() => get(store)).toThrow(/Unlock/);
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, '{}');
    expect(() => get(store)).toThrow(/cannot be read/);
  });
  it('requires explicit confirmation for a different origin and clears it on lock', async () => {
    const store = new AISettingsStore();
    await store.save(apiKey, model, passphrase, endpoint);
    expect(get(store, 'https://ai.example.test/other')?.apiKey).toBe(apiKey);
    expect(() => get(store, 'https://new.example.test/chat')).toThrow(/origin changed/);
    store.confirmOrigin('https://new.example.test/chat');
    expect(get(store, 'https://new.example.test/chat')?.origin).toBe('https://new.example.test');
    store.lock();
    await store.unlock(passphrase);
    expect(() => get(store, 'https://new.example.test/chat')).toThrow(/origin changed/);
  });
  it('blocks requests on read/write/removal failures without deleting existing settings', async () => {
    const store = new AISettingsStore();
    await store.save(apiKey, model, passphrase, endpoint);
    const saved = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => get(store)).toThrow(/cannot be read/);
    read.mockRestore();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await expect(store.save(apiKey, model, passphrase, endpoint)).rejects.toThrow(
      /could not be saved/,
    );
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe(saved);
    expect(() => get(store)).toThrow(/Unlock/);
    write.mockRestore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error();
    });
    expect(() => store.remove()).toThrow(/could not be saved/);
    expect(() => get(store)).toThrow(/Unlock/);
  });
  it('does not unlock if locking occurs during decryption and blocks missing Web Crypto', async () => {
    const store = new AISettingsStore();
    await store.save(apiKey, model, passphrase, endpoint);
    store.lock();
    const unlocking = store.unlock(passphrase);
    store.lock();
    await expect(unlocking).rejects.toThrow(/Could not unlock/);
    expect(() => get(store)).toThrow(/Unlock/);
    vi.stubGlobal('crypto', {});
    await expect(store.unlock(passphrase)).rejects.toThrow(/Could not unlock/);
  });
  it('keeps encrypted settings separate from workflow exports', async () => {
    const store = new AISettingsStore();
    await store.save(apiKey, model, passphrase, endpoint);
    for (const output of [
      JSON.stringify(defaultWorkflow),
      exportWorkflow({ ...defaultWorkflow, websiteUrl: 'https://example.com/' }),
    ]) {
      expect(output).not.toContain(apiKey);
      expect(output).not.toContain(AI_SETTINGS_STORAGE_KEY);
      expect(output).not.toContain(passphrase);
    }
  });
});

describe('credential transport', () => {
  const override = { apiKey, model, origin: 'https://ai.example.test' };
  it('uses dedicated headers, independent app auth, no cache, and rejects redirects', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ message: 'Ready', operations: [] }));
    vi.stubGlobal('fetch', fetcher);
    await requestAIChat(
      { endpoint, headers: { Authorization: 'Bearer app-session' } },
      request,
      undefined,
      override,
    );
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(endpoint);
    expect(init.redirect).toBe('error');
    expect(init.cache).toBe('no-store');
    expect(init.headers.get(OPENAI_KEY_HEADER)).toBe(apiKey);
    expect(init.headers.get(OPENAI_MODEL_HEADER)).toBe(model);
    expect(init.headers.get('Authorization')).toBe('Bearer app-session');
    expect(init.body).not.toContain(apiKey);
    fetcher.mockResolvedValue(
      new Response('', { status: 302, headers: { Location: 'https://evil.test' } }),
    );
    await expect(requestAIChat({ endpoint }, request, undefined, override)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['http://ai.example.test/chat', '/api/chat', 'https://other.test/chat'])(
    'rejects %s before fetch',
    async (url) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      await expect(requestAIChat({ endpoint: url }, request, undefined, override)).rejects.toThrow(
        /HTTPS|origin/,
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('resolves relative endpoints against the real builder origin', () => {
    expect(resolveAIEndpoint('/api/chat', 'https://builder.test').href).toBe(
      'https://builder.test/api/chat',
    );
    expect(resolveAIEndpoint('/api/chat').protocol).toBe(window.location.protocol);
  });
  it('rejects incomplete overrides and never displays a reflected key', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ message: apiKey, operations: [] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      requestAIChat({ endpoint }, request, undefined, { ...override, model: '' }),
    ).rejects.toThrow(/incomplete/);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(requestAIChat({ endpoint }, request, undefined, override)).rejects.toThrow(
      /unsafe response/,
    );
  });
});
