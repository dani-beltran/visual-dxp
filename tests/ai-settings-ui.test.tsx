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
it('keeps saved settings and provides unlocking within the assistant when the tab is hidden', async () => {
  const store = new AISettingsStore();
  await store.save('sk-test-private', 'my-model', 'a very long passphrase', 'https://ai.test/chat');
  store.lock();
  const saved = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  await builder({ endpoint: 'https://ai.test/chat', showSettings: false });
  await click(button('AI chat'));
  expect(tab('AI Settings')).toBeUndefined();
  expect(button('Unlock browser settings')).toBeDefined();
  expect(host.querySelector('.dxp-ai-context')?.textContent).toContain(
    'AI configuration is incorrect',
  );
  expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
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
  expect(host.querySelector('.dxp-ai-context')?.textContent).toContain(
    'AI configuration is incorrect',
  );
  expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
});
it('masks keys, toggles visibility, shows destination and privacy text, and removes settings', async () => {
  const store = new AISettingsStore();
  store.refresh();
  await act(async () => root.render(<AISettings store={store} endpoint="https://ai.test/chat" />));
  expect(host.querySelector('input')?.type).toBe('password');
  await click(button('Show API key'));
  expect(host.querySelector('input')?.type).toBe('text');
  await click(button('Hide API key'));
  expect(host.textContent).toContain('https://ai.test');
  expect(host.textContent).toContain('privileged browser extensions');
  expect(host.textContent).toContain('never included in your published site');
  await act(async () =>
    store.save('sk-test-private', 'my-model', 'a very long passphrase', 'https://ai.test/chat'),
  );
  await click(button('Remove browser settings'));
  expect(host.textContent).toContain('Server defaults active');
  expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBeNull();
});

it('updates the chat status when damaged browser settings are removed', async () => {
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, 'damaged settings');
  await builder({ endpoint: '/api/ai/chat' });
  await click(button('AI chat'));
  expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
  await click(button('Remove browser settings'));
  expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
  expect(host.querySelector('[aria-label="Assistant credentials"]')).toBeNull();
});
