// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AISettings } from '../src/components/AISettings';
import { VisualDXPBuilder, type VisualDXPBuilderProps } from '../src/components/VisualDXPBuilder';
import { AI_SETTINGS_STORAGE_KEY, AISettingsStore } from '../src/lib/aiSettings';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function builder(ai?: VisualDXPBuilderProps['ai']) {
  await act(async () => root.render(<VisualDXPBuilder ai={ai} />));
}
function tab(name: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (element) => element.textContent?.trim() === name,
  );
}
function button(name: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => (element.getAttribute('aria-label') ?? element.textContent?.trim()) === name,
  )!;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
async function input(label: string, text: string) {
  const fieldLabel = [...host.querySelectorAll('label')].find(
    (element) => element.textContent === label,
  )!;
  const field = document.getElementById(fieldLabel.htmlFor) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it.each([undefined, { endpoint: '' }, { endpoint: '  ', showSettings: true }])(
  'hides AI without an explicit endpoint, even with saved settings: %s',
  async (ai) => {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, 'existing settings');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await builder(ai);
    expect(tab('AI Settings')).toBeUndefined();
    expect(button('AI chat')).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe('existing settings');
  },
);
it('shows configured AI by default and includes the tab in roving keyboard navigation', async () => {
  await builder({ endpoint: '/api/ai/chat' });
  expect(button('AI chat')).toBeDefined();
  expect(tab('AI Settings')).toBeDefined();
  await act(async () =>
    tab('Canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })),
  );
  expect(document.activeElement).toBe(tab('AI Settings'));
  expect(tab('AI Settings')?.getAttribute('aria-selected')).toBe('true');
  const panel = document.getElementById(tab('AI Settings')!.getAttribute('aria-controls')!)!;
  expect(panel.hidden).toBe(false);
  await act(async () =>
    tab('AI Settings')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    ),
  );
  expect(document.activeElement).toBe(tab('Canvas'));
  await act(async () =>
    tab('Canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })),
  );
  expect(document.activeElement).toBe(tab('AI Settings'));
  await builder({ endpoint: '/api/ai/chat', showSettings: false });
  expect(tab('AI Settings')).toBeUndefined();
  expect(tab('Canvas')?.tabIndex).toBe(0);
});
it('keeps saved settings when the tab is hidden and unlocks through AI Settings', async () => {
  const store = new AISettingsStore();
  await store.save('sk-test-private', 'my-model', 'a very long passphrase', 'https://ai.test/chat');
  store.lock();
  const saved = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  await builder({ endpoint: 'https://ai.test/chat', showSettings: false });
  await click(button('AI chat'));
  expect(tab('AI Settings')).toBeUndefined();
  expect(button('Unlock browser settings')).toBeUndefined();
  expect(host.querySelector('[aria-label="Assistant credentials"]')).toBeNull();
  expect(host.querySelector('.dxp-ai-context')?.textContent).toContain('Unlock OpenAI');
  expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
  await builder({ endpoint: 'https://ai.test/chat', showSettings: true });
  await click(tab('AI Settings')!);
  await input('Passphrase to unlock', 'a very long passphrase');
  await click(button('Unlock browser settings'));
  // Web Crypto completes asynchronously, outside React's event turn.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(host.querySelector('.dxp-ai-context')?.textContent).toBe(
    'Working with your current canvas',
  );
  expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
  expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe(saved);
  await click(button('Lock'));
  expect(host.querySelector('.dxp-ai-context')?.textContent).toContain('Unlock OpenAI');
  expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
});
it('masks keys, toggles visibility, shows privacy text, and removes settings', async () => {
  const store = new AISettingsStore();
  store.refresh();
  await act(async () => root.render(<AISettings store={store} endpoint="https://ai.test/chat" />));
  expect(host.querySelector('input')?.type).toBe('password');
  await click(button('Show API key'));
  expect(host.querySelector('input')?.type).toBe('text');
  await click(button('Hide API key'));
  expect(host.textContent).toContain('browser extensions with special permissions');
  expect(host.textContent).toContain('never included in your published site');
  await act(async () =>
    store.save('sk-test-private', 'my-model', 'a very long passphrase', 'https://ai.test/chat'),
  );
  await click(button('Remove browser settings'));
  expect(host.textContent).toContain('No saved configuration');
  expect(JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)!).providers).toEqual({});
});

it.each(['localhost', '127.0.0.1', '[::1]'])(
  'allows browser credentials and shows a ready chat on HTTP %s',
  async (hostname) => {
    const endpoint = `http://${hostname}:3000/api/ai/chat`;
    await builder({ endpoint });
    await click(tab('AI Settings')!);
    expect(host.textContent).not.toContain('Browser credentials require an HTTPS AI server.');
    await input('OpenAI API key', 'sk-test-private');
    await input('OpenAI model ID', 'my-model');
    await input('Encryption passphrase (at least 12 characters)', 'a very long passphrase');
    await act(async () => {
      host
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await vi.waitFor(() => expect(host.textContent).toContain('Browser settings ready'));
    });
    await click(button('AI chat'));
    expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
  },
);

it('updates the chat status when damaged browser settings are removed', async () => {
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, 'damaged settings');
  await builder({ endpoint: '/api/ai/chat' });
  await click(button('AI chat'));
  expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
  expect(host.querySelector('[aria-label="Assistant credentials"]')).toBeNull();
  await click(tab('AI Settings')!);
  await click(button('Remove browser settings'));
  expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
  expect(host.querySelector('[aria-label="AI settings"]')?.textContent).toContain(
    'Active provider: OpenAI',
  );
});

it('uses accessible provider tabs without activating them and restores the viewed tab after reload', async () => {
  const store = new AISettingsStore();
  store.refresh();
  await act(async () => root.render(<AISettings store={store} endpoint="https://ai.test/chat" />));
  const providerTabs = () => [
    ...host.querySelectorAll<HTMLButtonElement>('[aria-label="AI providers"] [role="tab"]'),
  ];
  const first = providerTabs()[0];
  expect(first.textContent).toContain('Active');
  await act(async () =>
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
  );
  expect(document.activeElement).toBe(providerTabs()[1]);
  expect(providerTabs()[1].getAttribute('aria-selected')).toBe('true');
  expect(providerTabs()[0].textContent).toContain('Active');
  const panel = document.getElementById(providerTabs()[1].getAttribute('aria-controls')!)!;
  expect(panel.hidden).toBe(false);
  expect(panel.getAttribute('aria-labelledby')).toBe(providerTabs()[1].id);
  await act(async () =>
    providerTabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })),
  );
  expect(document.activeElement).toBe(providerTabs()[2]);
  expect(store.getSnapshot().activeProvider).toBe('openai');
  const restored = new AISettingsStore();
  restored.refresh();
  expect(restored.getSnapshot()).toMatchObject({
    viewedProvider: 'local',
    activeProvider: 'openai',
  });
});
it('saves and activates local settings without a key, and unsaved fields never affect requests', async () => {
  const store = new AISettingsStore();
  store.refresh();
  await act(async () => root.render(<AISettings store={store} endpoint="https://ai.test/chat" />));
  await click(tab('Local')!);
  expect(host.textContent).toContain('only works when running the demo app locally');
  expect(host.querySelector('input[type="password"]')).not.toBeNull();
  expect(
    [...host.querySelectorAll('label')].some((label) => label.textContent?.includes('passphrase')),
  ).toBe(false);
  await input('Local API base URL', 'http://localhost:11434/v1');
  await input('Local model ID', 'local-model');
  expect(store.forRequest('https://ai.test/chat', new AbortController())).toBeUndefined();
  await act(async () =>
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  expect(store.getSnapshot().activeProvider).toBe('local');
  await input('Local model ID', 'unsaved-model');
  await input('Local API base URL', 'http://evil.test/v1');
  expect(store.forRequest('https://ai.test/chat', new AbortController())).toMatchObject({
    provider: 'local',
    model: 'local-model',
    baseURL: 'http://localhost:11434/v1',
  });
  await click(tab('Claude')!);
  await input('Anthropic API key', 'sk-ant-private');
  await input('Claude model ID', 'unsaved-claude');
  expect(store.forRequest('https://ai.test/chat', new AbortController())).toMatchObject({
    provider: 'local',
    model: 'local-model',
  });
});
it('keeps the previous provider after a failed save and activates saved credentials without re-entry', async () => {
  const store = new AISettingsStore();
  await store.save(
    'sk-openai-private',
    'openai-model',
    'a very long passphrase',
    'https://ai.test/chat',
  );
  await store.saveProvider(
    'local',
    { apiKey: '', model: 'local-model', baseURL: 'http://127.0.0.1:11434/v1' },
    '',
    'https://ai.test/chat',
  );
  await act(async () => root.render(<AISettings store={store} endpoint="https://ai.test/chat" />));
  await click(tab('Claude')!);
  await input('Anthropic API key', 'sk-ant-private');
  await input('Claude model ID', 'claude-model');
  await input('Encryption passphrase (at least 12 characters)', 'a very long passphrase');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await act(async () => {
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(host.textContent).toContain('Previous active settings were preserved');
  expect(store.getSnapshot().activeProvider).toBe('local');
  write.mockRestore();
  await click(tab('OpenAI')!);
  await click(button('Activate saved configuration'));
  expect(store.getSnapshot().activeProvider).toBe('openai');
  expect(store.forRequest('https://ai.test/chat', new AbortController())).toMatchObject({
    apiKey: 'sk-openai-private',
  });
});
