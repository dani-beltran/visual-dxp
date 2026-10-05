// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AISettings } from '../src/components/AISettings';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder';
import { requestAIChat } from '../src/lib/ai';
import { AI_RESERVED_HEADERS } from '../src/lib/aiCredentials';
import { ChatGPTAuthStore } from '../src/lib/chatgptAuth';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
const button = (label: string) =>
  [...host.querySelectorAll('button')].find((item) => item.textContent === label)!;
it.each([false, true])(
  'shows a disabled, honest unconfigured sign-in state (compact: %s)',
  async (compact) => {
    await act(async () =>
      root.render(<AISettings store={new ChatGPTAuthStore()} compact={compact} />),
    );
    expect(button('Sign in with ChatGPT').disabled).toBe(true);
    expect(host.textContent).toContain('not available on this deployment yet');
    expect(host.querySelectorAll('input,[role="tab"],select')).toHaveLength(0);
  },
);
it('shows signing-in and failed sign-in with retry', async () => {
  let reject!: (error: Error) => void;
  const navigate = vi.fn();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ available: true, account: null }))
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
  vi.stubGlobal('fetch', fetcher);
  const store = new ChatGPTAuthStore('/api/auth/chatgpt', navigate);
  await act(async () => {
    await store.refresh();
    root.render(<AISettings store={store} />);
  });
  await act(async () => button('Sign in with ChatGPT').click());
  expect(host.textContent).toContain('Opening ChatGPT sign-in');
  await act(async () => reject(new Error('Offline')));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(button('Sign in with ChatGPT').disabled).toBe(false);
  expect(navigate).not.toHaveBeenCalled();
});
it('shares signed-in and sign-out state between main and compact settings', async () => {
  let finish!: (result: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ available: true, account: { name: 'Alex' } }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
  );
  const store = new ChatGPTAuthStore('/api/auth/chatgpt');
  await act(async () => {
    await store.refresh();
    root.render(
      <>
        <AISettings store={store} />
        <AISettings store={store} compact />
      </>,
    );
  });
  expect(host.textContent?.match(/Connected to ChatGPT/g)).toHaveLength(2);
  await act(async () => button('Sign out').click());
  expect(host.textContent).toContain('Signing out');
  await act(async () => finish(Response.json({ available: true, account: null })));
  expect(host.textContent).not.toContain('Alex');
  expect(host.textContent?.match(/Connect your ChatGPT account/g)).toHaveLength(2);
});
it('keeps the account when sign-out fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ available: true, account: { name: 'Alex' } }))
      .mockRejectedValueOnce(new Error('offline')),
  );
  const store = new ChatGPTAuthStore('/api/auth/chatgpt');
  await act(async () => {
    await store.refresh();
    root.render(<AISettings store={store} />);
    await store.signOut();
  });
  expect(host.textContent).toContain('Alex');
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it('accepts only same-origin session APIs and OpenAI authorization destinations', async () => {
  const navigate = vi.fn();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ available: true, account: null }))
    .mockResolvedValueOnce(Response.json({ authorizationUrl: 'https://evil.test/' }));
  vi.stubGlobal('fetch', fetcher);
  const store = new ChatGPTAuthStore('/api/auth/chatgpt', navigate);
  await store.refresh();
  await store.signIn();
  expect(navigate).not.toHaveBeenCalled();
  expect(store.getSnapshot().error).toBe(true);
  const foreign = new ChatGPTAuthStore('https://evil.test');
  await foreign.refresh();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('redirects successful sign-in without storing credentials in browser storage', async () => {
  const navigate = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ available: true, account: null }))
      .mockResolvedValueOnce(
        Response.json({
          authorizationUrl: 'https://auth.openai.com/api/accounts/authorize?state=test',
        }),
      ),
  );
  const store = new ChatGPTAuthStore('/api/auth/chatgpt', navigate);
  await store.refresh();
  await store.signIn();
  expect(navigate).toHaveBeenCalledOnce();
  expect(localStorage.length).toBe(0);
});
it.each([undefined, { endpoint: '' }])(
  'does not enable AI or make auth requests without an AI endpoint',
  async (ai) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    localStorage.setItem('visual-dxp-ai-settings-v1', 'old');
    await act(async () => root.render(<VisualDXPBuilder ai={ai} />));
    expect(host.textContent).not.toContain('AI Settings');
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it.each([
  'corrupt',
  '{"version":1,"ciphertext":"locked"}',
  '{"version":2,"activeProvider":"local"}',
])('ignores legacy storage and strips old provider headers: %s', async (saved) => {
  localStorage.setItem('visual-dxp-ai-settings-v1', saved);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ message: 'Ready', operations: [] }));
  vi.stubGlobal('fetch', fetcher);
  const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  await requestAIChat(
    {
      endpoint: '/api/ai/chat',
      headers: Object.fromEntries([
        ...AI_RESERVED_HEADERS.map((key) => [key, 'legacy']),
        ['X-CSRF', 'app-token'],
      ]),
    },
    {
      messages: [{ role: 'user', content: 'Explain' }],
      selectedNodeIds: [],
      workflow: { version: 1, name: 'test', websiteUrl: '', nodes: [], edges: [] },
    },
  );
  const headers = new Headers(fetcher.mock.calls[0][1].headers);
  expect(AI_RESERVED_HEADERS.some((name) => headers.has(name))).toBe(false);
  expect(headers.get('X-CSRF')).toBe('app-token');
  expect(getItem).not.toHaveBeenCalled();
});

it('restores signed-out state after returning from sign-in via browser history', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ available: true, account: null }))
      .mockResolvedValueOnce(
        Response.json({ authorizationUrl: 'https://auth.openai.com/api/accounts/authorize' }),
      )
      .mockResolvedValueOnce(Response.json({ available: true, account: null })),
  );
  const store = new ChatGPTAuthStore('/api/auth/chatgpt', vi.fn());
  await store.refresh();
  await store.signIn();
  expect(store.getSnapshot().status).toBe('signing-in');
  await store.refresh(true);
  expect(store.getSnapshot().status).toBe('signed-out');
});
it('keeps compact settings when the main settings tab is hidden', async () => {
  await act(async () =>
    root.render(<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', showSettings: false }} />),
  );
  expect(
    [...host.querySelectorAll('[role="tab"]')].some((item) => item.textContent === 'AI Settings'),
  ).toBe(false);
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="AI chat"]')!.click(),
  );
  expect(host.querySelector('.dxp-ai-settings.compact')).not.toBeNull();
  expect(button('Sign in with ChatGPT').disabled).toBe(true);
});
