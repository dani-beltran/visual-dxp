// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasChat, type CanvasChatProps } from '../src/components/CanvasChat/CanvasChat';
import {
  VisualDXPBuilder,
  type VisualDXPBuilderApi,
} from '../src/components/VisualDXPBuilder/VisualDXPBuilder';
import { AISettingsStore } from '../src/lib/aiSettings';
import { BRANDING_PROTOCOL } from '../src/lib/branding';
import type { Workflow } from '../src/lib/types';
import { brandingProfile } from './helpers/branding';

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderChat(props: Partial<CanvasChatProps> = {}) {
  const onSend = props.onSend ?? vi.fn().mockResolvedValue({ message: 'Done.', changeCount: 0 });
  await act(async () => {
    root.render(
      <div className="dxp-canvas">
        <div className="dxp-canvas-dock">
          <div className="dxp-canvas-assistants">
            <CanvasChat configured onSend={onSend} {...props} />
          </div>
        </div>
      </div>,
    );
  });
  return onSend;
}

function button(label: string) {
  const element = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(element, `Button '${label}' should exist`).not.toBeNull();
  return element!;
}

function composer() {
  const element = host.querySelector<HTMLTextAreaElement>('textarea');
  expect(element).not.toBeNull();
  return element!;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function typeMessage(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      composer(),
      value,
    );
    composer().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function pressKey(key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  await act(async () => composer().dispatchEvent(event));
  return event;
}

function pendingResponse() {
  let resolve!: (value: { message: string; changeCount: number }) => void;
  const promise = new Promise<{ message: string; changeCount: number }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function initialWorkflow(): Workflow {
  return {
    version: 1,
    name: 'Welcome journey',
    websiteUrl: 'https://example.com',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Page loaded', config: { event: 'page-load' } },
      },
      {
        id: 'delay',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: { kind: 'delay', label: 'Wait a second', config: { duration: 1000 } },
      },
    ],
    edges: [{ id: 'start-delay', source: 'start', target: 'delay', type: 'smoothstep' }],
  };
}

function undoButton() {
  return host.querySelector<HTMLButtonElement>('button[title^="Undo"]')!;
}

async function renderConnectedBuilder() {
  const onReady = vi.fn<(api: VisualDXPBuilderApi | null) => void>();
  const onChange = vi.fn<(workflow: Workflow) => void>();
  await act(async () => {
    root.render(
      <VisualDXPBuilder
        initialWorkflow={initialWorkflow()}
        ai={{ endpoint: '/api/ai/chat' }}
        onChange={onChange}
        onReady={onReady}
      />,
    );
  });
  const baseline = structuredClone(onChange.mock.lastCall![0]);
  await click(button('AI chat'));
  const api = onReady.mock.lastCall?.[0];
  if (!api) throw new Error('Builder API should be ready');
  return { onChange, baseline, api };
}

function responseWithOperations(operations: unknown[]) {
  return new Response(JSON.stringify({ message: 'Updated the journey.', operations }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('canvas AI chat', () => {
  it('captures demo branding in the background and includes it in AI requests', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockResolvedValue(responseWithOperations([]));
      vi.stubGlobal('fetch', fetchMock);
      await act(async () =>
        root.render(
          <VisualDXPBuilder
            initialWorkflow={{ ...initialWorkflow(), websiteUrl: '/demo-site.html' }}
            ai={{ endpoint: '/api/ai/chat' }}
          />,
        ),
      );
      await act(async () => vi.advanceTimersByTimeAsync(500));
      const frame = host.querySelector('iframe')!;
      expect(frame).not.toBeNull();
      expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
      expect(frame.src).toBe(`${window.location.origin}/demo-site.html`);
      expect(host.querySelector('.dxp-website-connection')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      const source = frame.contentWindow!;
      const post = vi.spyOn(source, 'postMessage').mockImplementation(() => {});
      await act(async () => frame.dispatchEvent(new Event('load')));
      const init = post.mock.calls.at(-1)![0];
      const receive = async (data: object, sender = source, origin = 'null') =>
        act(async () => {
          window.dispatchEvent(new MessageEvent('message', { source: sender, origin, data }));
        });
      await receive({ ...init, type: 'ready' });
      const extract = post.mock.calls.at(-1)![0];
      expect(extract).toEqual({
        protocol: BRANDING_PROTOCOL,
        channel: expect.any(String),
        type: 'extract',
      });
      const profile = brandingProfile(`${window.location.origin}/demo-site.html`);
      const response = {
        protocol: BRANDING_PROTOCOL,
        channel: extract.channel,
        type: 'profile',
        profile,
      };
      await receive(response, window);
      await receive(response, source, window.location.origin);
      await receive({ ...response, channel: 'wrong-channel' });
      await receive({ ...response, profile: {} });
      expect(host.querySelector('iframe')).toBe(frame);
      await receive(response);
      expect(host.querySelector('iframe')).toBeNull();
      expect(post.mock.calls).toContainEqual([{ ...extract, type: 'stop' }, '*']);
      await click(button('AI chat'));
      await typeMessage('Use this website’s branding');
      await click(button('Send message'));
      const request = fetchMock.mock.calls.find(([url]) => url === '/api/ai/chat');
      expect(request).toBeDefined();
      expect(JSON.parse(request![1].body)).toMatchObject({
        brandingProfile: { ...profile, websiteUrl: '/demo-site.html' },
        workflow: { websiteUrl: '/demo-site.html' },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('places the AI chat trigger immediately before Canvas help in the builder', async () => {
    await act(async () => {
      root.render(
        <VisualDXPBuilder
          initialWorkflow={{ version: 1, name: 'Empty', websiteUrl: '', nodes: [], edges: [] }}
          ai={{ endpoint: '/api/ai/chat' }}
        />,
      );
    });
    const chat = button('AI chat');
    const help = button('Canvas help');
    expect(chat.parentElement?.nextElementSibling).toBe(help.parentElement);
    expect(chat.closest('.dxp-canvas-dock')).toBe(help.closest('.dxp-canvas-dock'));
    await click(chat);
    expect(host.textContent).not.toContain('Server defaults active');
    expect(host.textContent).not.toContain('Configured AI server:');
    expect(host.textContent).not.toContain('Browser credentials require an HTTPS AI server.');
    expect(host.querySelector('.dxp-ai-context')?.textContent).toBe(
      'Working with your current canvas',
    );
    expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
    expect(composer().disabled).toBe(false);
    await click(help);
    expect(host.querySelector('.dxp-ai-panel')).toBeNull();
    expect(host.querySelector('.dxp-canvas-help-panel')).not.toBeNull();
    await click(chat);
    expect(host.querySelector('.dxp-canvas-help-panel')).toBeNull();
    expect(host.querySelector('.dxp-ai-panel')).not.toBeNull();
  });

  it('explains missing configuration, disables composing, and gives focus to Close', async () => {
    const onSend = await renderChat({ configured: false });
    await click(button('AI chat'));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button('AI chat').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(button('Close AI chat'));
    expect(host.textContent).toContain('Connect your AI assistant');
    expect(host.querySelector('.dxp-ai-context')?.textContent).toContain(
      'Check the server configuration or save a provider in AI Settings.',
    );
    expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
    expect(composer().disabled).toBe(true);
    expect(button('Send message').disabled).toBe(true);
    expect(host.querySelector('.dxp-ai-suggestions')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('prioritizes configuration errors over the selected canvas step', async () => {
    await renderChat({ configurationError: true, selectedLabel: 'Welcome step' });
    await click(button('AI chat'));
    expect(host.querySelector('.dxp-ai-context')?.textContent).toContain(
      'Check the server configuration or save a provider in AI Settings.',
    );
    expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
    expect(host.querySelector('.dxp-ai-context')?.textContent).not.toContain('Selected:');
  });

  it('focuses the composer, reports selection, and closes with Escape without canvas shortcuts', async () => {
    await renderChat({ selectedLabel: 'Welcome step' });
    await click(button('AI chat'));
    expect(document.activeElement).toBe(composer());
    expect(host.textContent).toContain('Selected: Welcome step');
    const canvasShortcut = vi.fn();
    document.addEventListener('keydown', canvasShortcut);
    try {
      await pressKey('Delete');
      expect(canvasShortcut).not.toHaveBeenCalled();
      const escapeEvent = await pressKey('Escape');
      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(button('AI chat'));
      expect(button('AI chat').getAttribute('aria-expanded')).toBe('false');
    } finally {
      document.removeEventListener('keydown', canvasShortcut);
    }
  });

  it('submits trimmed text with Enter, preserves Shift+Enter, and ignores IME composition', async () => {
    const onSend = await renderChat();
    await click(button('AI chat'));
    await typeMessage('  Add a welcome step  ');
    expect((await pressKey('Enter', { shiftKey: true })).defaultPrevented).toBe(false);
    expect((await pressKey('Enter', { isComposing: true })).defaultPrevented).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
    expect((await pressKey('Enter')).defaultPrevented).toBe(true);
    expect(onSend).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Add a welcome step' }],
      expect.any(AbortSignal),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
    expect(composer().value).toBe('');
    expect(document.activeElement).toBe(composer());
    expect(host.querySelector('[role="log"]')?.textContent).toContain('Done.');
  });

  it('retains completed turns on close/reopen and clears their history for a new conversation', async () => {
    const onSend = vi
      .fn<CanvasChatProps['onSend']>()
      .mockResolvedValueOnce({ message: 'Added two steps.', changeCount: 2 })
      .mockResolvedValueOnce({ message: 'Connected them.', changeCount: 1 })
      .mockResolvedValue({ message: 'A fresh start.', changeCount: 0 });
    await renderChat({ onSend });
    await click(button('AI chat'));
    await typeMessage('Add two steps');
    await click(button('Send message'));
    expect(host.textContent).toContain('2 edits applied');
    await click(button('Close AI chat'));
    await click(button('AI chat'));
    expect(host.textContent).toContain('Added two steps.');
    await typeMessage('Connect them');
    await click(button('Send message'));
    expect(onSend.mock.calls[1][0]).toEqual([
      { role: 'user', content: 'Add two steps' },
      { role: 'assistant', content: 'Added two steps.' },
      { role: 'user', content: 'Connect them' },
    ]);
    expect(host.textContent).toContain('1 edit applied');
    await click(button('Start a new conversation'));
    expect(host.textContent).not.toContain('Added two steps.');
    expect(host.textContent).toContain('What would you like to create?');
    await typeMessage('Start again');
    await click(button('Send message'));
    expect(onSend.mock.calls[2][0]).toEqual([{ role: 'user', content: 'Start again' }]);
  });

  it('renders Markdown in both roles while keeping the original text in request history', async () => {
    const reply = [
      '## Workflow plan',
      '',
      '**Welcome** with *emphasis*, ~~old copy~~ and `delay`.',
      '',
      '- First step',
      '  - Nested step',
      '',
      '1. Ordered step',
      '',
      '> A helpful note',
      '',
      '```js',
      'const delay = 2000;',
      '```',
      '',
      '| Step | Status |',
      '| --- | --- |',
      '| Welcome | Ready |',
      '',
      '- [x] Complete',
      '- [ ] Pending',
      '',
      '[Documentation](https://example.com/docs)',
    ].join('\n');
    const onSend = vi.fn<CanvasChatProps['onSend']>().mockResolvedValue({
      message: reply,
      changeCount: 2,
    });
    await renderChat({ open: true, onSend });
    await typeMessage('Please add **welcome** and `delay`.');
    await click(button('Send message'));
    expect(host.querySelector('.dxp-ai-message-user strong')?.textContent).toBe('welcome');
    const message = host.querySelector('.dxp-ai-message-assistant');
    if (!message) throw new Error('Assistant message should exist');
    expect(message.querySelector('h2')?.textContent).toBe('Workflow plan');
    expect(message.querySelector('strong')?.textContent).toBe('Welcome');
    expect(message.querySelector('em')?.textContent).toBe('emphasis');
    expect(message.querySelector('del')?.textContent).toBe('old copy');
    expect(message.querySelector('p code')?.textContent).toBe('delay');
    expect(message.querySelector('ul ul li')?.textContent).toBe('Nested step');
    expect(message.querySelector('ol li')?.textContent).toBe('Ordered step');
    expect(message.querySelector('blockquote')?.textContent).toContain('A helpful note');
    expect(message.querySelector('pre code.language-js')?.textContent).toBe(
      'const delay = 2000;\n',
    );
    expect(message.querySelectorAll('th')).toHaveLength(2);
    expect(message.querySelector('td')?.textContent).toBe('Welcome');
    const tasks = message.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect([...tasks].map((task) => [task.checked, task.disabled])).toEqual([
      [true, true],
      [false, true],
    ]);
    const link = message.querySelector('a');
    if (!link) throw new Error('Documentation link should exist');
    expect(link.href).toBe('https://example.com/docs');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(message.querySelector('.dxp-ai-applied')?.textContent).toContain('2 edits applied');
    await typeMessage('Continue');
    await click(button('Send message'));
    expect(onSend.mock.calls[1][0]).toEqual([
      { role: 'user', content: 'Please add **welcome** and `delay`.' },
      { role: 'assistant', content: reply },
      { role: 'user', content: 'Continue' },
    ]);
  });

  it('treats raw HTML as text and blocks executable Markdown links', async () => {
    const content = [
      '<script>alert(1)</script>',
      '',
      '<img src="x" onerror="alert(1)">',
      '',
      '[Unsafe](javascript:alert%281%29)',
      '',
      '[Data](data:text/html,test)',
      '',
      '```html',
      '<button onclick="alert(1)">Example</button>',
      '```',
    ].join('\n');
    await renderChat({
      open: true,
      onSend: async () => ({ message: content, changeCount: 0 }),
    });
    await typeMessage(content);
    await click(button('Send message'));
    for (const message of host.querySelectorAll('.dxp-ai-markdown')) {
      expect(message.querySelector('script, img, button, [onclick], [onerror]')).toBeNull();
      expect(message.textContent).toContain('<script>alert(1)</script>');
      expect(message.querySelectorAll('a')).toHaveLength(2);
      expect(message.querySelector('a[href]')).toBeNull();
      expect(message.querySelector('pre code')?.textContent).toContain('<button onclick=');
    }
  });

  it('restores a failed draft for retry without adding the failed turn to request history', async () => {
    const onSend = vi
      .fn<CanvasChatProps['onSend']>()
      .mockRejectedValueOnce(new Error('Service unavailable.'))
      .mockResolvedValueOnce({ message: 'Added.', changeCount: 1 });
    await renderChat({ onSend });
    await click(button('AI chat'));
    await typeMessage('Add a delay');
    await click(button('Send message'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Service unavailable.');
    expect(composer().value).toBe('Add a delay');
    expect(composer().disabled).toBe(false);
    await click(button('Send message'));
    expect(onSend.mock.calls[1][0]).toEqual([{ role: 'user', content: 'Add a delay' }]);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Added.');
  });

  it('stops without submitting the restored draft and allows an explicit retry', async () => {
    let signal!: AbortSignal;
    const onSend = vi.fn<CanvasChatProps['onSend']>((_messages, requestSignal) => {
      signal = requestSignal;
      return new Promise((_resolve, reject) => {
        requestSignal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });
    await renderChat({ onSend });
    await click(button('AI chat'));
    await typeMessage('Add ten steps');
    await click(button('Send message'));
    expect(composer().disabled).toBe(true);
    expect(button('Start a new conversation').disabled).toBe(true);
    expect(signal.aborted).toBe(false);
    const stop = button('Stop generating');
    const submit = vi.fn();
    const form = stop.form;
    if (!form) throw new Error('Stop should be inside the composer form');
    form.addEventListener('submit', submit);
    const stopClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      stop.dispatchEvent(stopClick);
    });
    expect(stopClick.defaultPrevented).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect(signal.aborted).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Stopped.');
    expect(composer().value).toBe('Add ten steps');
    expect(composer().disabled).toBe(false);
    expect(onSend).toHaveBeenCalledOnce();
    expect(host.querySelectorAll('.dxp-ai-message-user')).toHaveLength(1);
    expect(stop.isConnected).toBe(false);
    expect(stop.type).toBe('button');
    await click(button('Send message'));
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(onSend.mock.calls[1][0]).toEqual([{ role: 'user', content: 'Add ten steps' }]);
    expect(signal.aborted).toBe(false);
    await click(button('Stop generating'));
  });

  it('keeps a pending request while closed and shows its result after reopening', async () => {
    const pending = pendingResponse();
    const onSend = vi.fn<CanvasChatProps['onSend']>().mockReturnValue(pending.promise);
    await renderChat({ onSend });
    await click(button('AI chat'));
    await typeMessage('Create a welcome step');
    await click(button('Send message'));
    await click(button('Close AI chat'));
    expect(onSend.mock.calls[0][1].aborted).toBe(false);
    await act(async () => pending.resolve({ message: 'Welcome step created.', changeCount: 1 }));
    await click(button('AI chat'));
    expect(host.textContent).toContain('Welcome step created.');
    expect(composer().disabled).toBe(false);
  });

  it('aborts the request when unmounted and ignores a late response', async () => {
    const pending = pendingResponse();
    const onSend = vi.fn<CanvasChatProps['onSend']>().mockReturnValue(pending.promise);
    await renderChat({ onSend });
    await click(button('AI chat'));
    await typeMessage('Create a step');
    await click(button('Send message'));
    const signal = onSend.mock.calls[0][1];
    await act(async () => root.unmount());
    mounted = false;
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ message: 'Too late.', changeCount: 1 }));
    expect(host.textContent).toBe('');
  });
});

describe('AI workflow integration', () => {
  it.each([401, 403, 502, 503])(
    'shows a configuration error for HTTP %s and recovers after a successful retry',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(new Response('{}', { status }))
          .mockResolvedValueOnce(responseWithOperations([])),
      );
      await renderConnectedBuilder();
      await typeMessage('Explain this workflow');
      await click(button('Send message'));
      expect(host.querySelector('.dxp-ai-context')?.textContent).toContain(
        'Check the server configuration or save a provider in AI Settings.',
      );
      expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
      await click(button('Start a new conversation'));
      expect(host.querySelector('.dxp-ai-status.error')).not.toBeNull();
      await typeMessage('Explain this workflow');
      await click(button('Send message'));
      expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
      expect(host.querySelector('.dxp-ai-context')?.textContent).toBe(
        'Working with your current canvas',
      );
    },
  );

  it('keeps the ready status for rate limits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 429 })),
    );
    await renderConnectedBuilder();
    await typeMessage('Explain this workflow');
    await click(button('Send message'));
    expect(host.querySelector('.dxp-ai-status.ready')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('busy');
  });

  it('applies multiple node and connection operations together and restores the whole graph with one Undo', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      responseWithOperations([
        { type: 'update_node', id: 'delay', label: 'Wait two seconds', config: { duration: 2000 } },
        {
          type: 'add_node',
          node: {
            id: 'extra-delay',
            type: 'workflow',
            position: { x: 600, y: 0 },
            data: { kind: 'delay', label: 'Another pause', config: { duration: 500 } },
          },
        },
        { type: 'add_edge', edge: { id: 'delay-extra', source: 'delay', target: 'extra-delay' } },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onChange, baseline } = await renderConnectedBuilder();
    expect(undoButton().disabled).toBe(true);
    await typeMessage('Lengthen the pause and add a second connected pause');
    await click(button('Send message'));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/chat');
    const sent = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(sent.workflow).toEqual(baseline);
    expect(sent.messages).toEqual([
      { role: 'user', content: 'Lengthen the pause and add a second connected pause' },
    ]);
    const changed = onChange.mock.lastCall![0];
    expect(changed.nodes).toHaveLength(3);
    expect(changed.nodes.find((node) => node.id === 'delay')?.data).toMatchObject({
      label: 'Wait two seconds',
      config: { duration: 2000 },
    });
    expect(changed.nodes.find((node) => node.id === 'extra-delay')?.data.label).toBe(
      'Another pause',
    );
    expect(changed.edges).toHaveLength(2);
    expect(changed.edges[1]).toMatchObject({ source: 'delay', target: 'extra-delay' });
    expect(host.textContent).toContain('3 edits applied');
    expect(undoButton().disabled).toBe(false);
    await click(undoButton());
    expect(onChange.mock.lastCall![0]).toEqual(baseline);
    expect(undoButton().disabled).toBe(true);
  });

  it('rejects a stale response after a manual change and preserves that change and its Undo history', async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onChange, baseline, api } = await renderConnectedBuilder();
    await typeMessage('Rename the delay');
    await click(button('Send message'));
    expect(fetchMock).toHaveBeenCalledOnce();
    await act(async () => api.renameWorkflow('My manual title'));
    const callsBeforeResponse = onChange.mock.calls.length;
    await act(async () =>
      resolve(
        responseWithOperations([
          { type: 'update_node', id: 'delay', label: 'An outdated AI edit' },
        ]),
      ),
    );
    expect(onChange).toHaveBeenCalledTimes(callsBeforeResponse);
    expect(onChange.mock.lastCall![0]).toEqual({ ...baseline, name: 'My manual title' });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'The canvas changed while I was working.',
    );
    expect(composer().value).toBe('Rename the delay');
    await click(undoButton());
    expect(onChange.mock.lastCall![0]).toEqual(baseline);
    expect(undoButton().disabled).toBe(true);
  });

  it.each([
    ['malformed response', [{ type: 'unsupported_action', id: 'delay' }]],
    [
      'invalid graph after an earlier valid edit',
      [
        { type: 'update_node', id: 'delay', label: 'Must not be committed' },
        { type: 'add_edge', edge: { id: 'missing-target', source: 'delay', target: 'missing' } },
      ],
    ],
  ])('does not commit or add Undo history for a %s', async (_label, operations) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(responseWithOperations(operations)),
    );
    const { onChange, baseline } = await renderConnectedBuilder();
    const callsBeforeResponse = onChange.mock.calls.length;
    await typeMessage('Change the journey');
    await click(button('Send message'));
    expect(onChange).toHaveBeenCalledTimes(callsBeforeResponse);
    expect(onChange.mock.lastCall![0]).toEqual(baseline);
    expect(undoButton().disabled).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No changes were made.');
    expect(composer().value).toBe('Change the journey');
  });
});

it('browsing provider tabs preserves requests, but cross-tab activation cancels and rejects a late workflow edit', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn<typeof fetch>().mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const { onChange, baseline } = await renderConnectedBuilder();
  await typeMessage('Rename the delay');
  await click(button('Send message'));
  const signal = fetcher.mock.calls[0][1]!.signal!;
  await click(host.querySelector<HTMLButtonElement>('[role="tab"][id$="-settings-tab"]')!);
  const providerTabs = [
    ...host.querySelectorAll<HTMLButtonElement>('[aria-label="AI providers"] [role="tab"]'),
  ];
  await click(providerTabs[1]);
  expect(signal.aborted).toBe(false);
  expect(new Headers(fetcher.mock.calls[0][1]!.headers).has('X-DXP-AI-Provider')).toBe(false);
  const otherTab = new AISettingsStore();
  otherTab.refresh();
  await act(async () => {
    await otherTab.saveProvider(
      'local',
      { apiKey: '', model: 'local-model', baseURL: 'http://127.0.0.1:11434/v1' },
      '',
      '/api/ai/chat',
    );
    window.dispatchEvent(new StorageEvent('storage'));
  });
  expect(signal.aborted).toBe(true);
  const before = onChange.mock.calls.length;
  await act(async () =>
    resolve(
      responseWithOperations([{ type: 'update_node', id: 'delay', label: 'Stale provider edit' }]),
    ),
  );
  expect(onChange).toHaveBeenCalledTimes(before);
  expect(onChange.mock.lastCall![0]).toEqual(baseline);
  expect(host.textContent).not.toContain('1 edit applied');
  expect(host.querySelector('.dxp-ai-header')?.textContent).toContain(
    'Active provider: Self-Hosted',
  );
});

it('displays streamed text before completion and replaces it with the validated reply', async () => {
  const pending = pendingResponse();
  let emit!: (text: string) => void;
  await renderChat({
    open: true,
    onSend: (_messages, _signal, onText) => {
      emit = onText!;
      return pending.promise;
    },
  });
  await typeMessage('Explain this');
  await pressKey('Enter');
  await act(async () => emit('**First words'));
  expect(host.querySelector('.dxp-ai-message-assistant')?.textContent).toContain('First words');
  expect(host.querySelector('.dxp-ai-applied')).toBeNull();
  await act(async () => emit(' arrive early**\n\n```js\nconst ready = true;'));
  expect(host.querySelector('.dxp-ai-message-assistant')?.textContent).toContain(
    'First words arrive early',
  );
  expect(host.querySelector('.dxp-ai-message-assistant strong')?.textContent).toBe(
    'First words arrive early',
  );
  expect(host.querySelector('.dxp-ai-message-assistant pre code')?.textContent).toContain(
    'const ready = true;',
  );
  await act(async () => pending.resolve({ message: '## Final reply', changeCount: 1 }));
  expect(host.querySelectorAll('.dxp-ai-message-assistant')).toHaveLength(1);
  expect(host.querySelector('.dxp-ai-message-assistant')?.textContent).toContain('Final reply');
  expect(host.querySelector('.dxp-ai-message-assistant h2')?.textContent).toBe('Final reply');
  expect(host.querySelector('.dxp-ai-message-assistant pre')).toBeNull();
  expect(host.querySelector('.dxp-ai-applied')).not.toBeNull();
});

it('keeps streaming reasoning separate from the answer and subsequent chat history', async () => {
  const pending = pendingResponse();
  let emitReasoning!: (text: string) => void;
  let emitText!: (text: string) => void;
  const onSend = vi.fn<CanvasChatProps['onSend']>((_messages, _signal, onText, onReasoning) => {
    emitText = onText!;
    emitReasoning = onReasoning!;
    return pending.promise;
  });
  await renderChat({ open: true, onSend });
  await typeMessage('Explain this');
  await pressKey('Enter');
  await act(async () => emitReasoning('Checking **connections**.'));
  const details = host.querySelector<HTMLDetailsElement>('.dxp-ai-reasoning')!;
  expect(details.querySelector('summary')?.textContent).toBe('Reasoning summary');
  expect(details.open).toBe(false);
  await click(details.querySelector('summary')!);
  expect(details.open).toBe(true);
  expect(details.querySelector('strong')?.textContent).toBe('connections');
  await act(async () => {
    emitText('Draft answer');
    emitReasoning('\n\nNo disconnected nodes.');
  });
  expect(details.open).toBe(true);
  expect(details.textContent).not.toContain('Draft answer');
  expect(host.querySelectorAll('.dxp-ai-message-assistant')).toHaveLength(1);
  await act(async () => pending.resolve({ message: 'Final answer', changeCount: 0 }));
  expect(details.textContent).toContain('No disconnected nodes.');
  expect(host.textContent).not.toContain('Draft answer');
  await typeMessage('Thanks');
  await pressKey('Enter');
  expect(onSend.mock.calls[1][0]).toEqual([
    { role: 'user', content: 'Explain this' },
    { role: 'assistant', content: 'Final answer' },
    { role: 'user', content: 'Thanks' },
  ]);
  await click(button('Start a new conversation'));
  expect(host.querySelector('.dxp-ai-reasoning')).toBeNull();
});

it.each(['cancel', 'error'])(
  'removes partial reasoning on %s and ignores late deltas',
  async (mode) => {
    let emitReasoning!: (text: string) => void;
    let reject!: (reason: Error) => void;
    await renderChat({
      open: true,
      onSend: (_messages, signal, _onText, onReasoning) => {
        emitReasoning = onReasoning!;
        return new Promise((_resolve, fail) => {
          reject = fail;
          signal.addEventListener('abort', () => fail(new Error('Stopped')));
        });
      },
    });
    await typeMessage('Explain this');
    await pressKey('Enter');
    await act(async () => emitReasoning('Partial summary'));
    expect(host.querySelector('.dxp-ai-reasoning')).not.toBeNull();
    if (mode === 'cancel') await click(button('Stop generating'));
    else await act(async () => reject(new Error('Interrupted')));
    await act(async () => emitReasoning('Late summary'));
    expect(host.querySelector('.dxp-ai-message-assistant')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No changes were made');
  },
);

it('connects streamed reasoning through the builder while applying only the final edit batch', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            stream = controller;
          },
        }),
        { headers: { 'Content-Type': 'application/x-ndjson' } },
      ),
    ),
  );
  const { onChange, baseline } = await renderConnectedBuilder();
  await typeMessage('Rename the delay');
  await click(button('Send message'));
  await act(async () =>
    stream.enqueue(encoder.encode('{"type":"reasoning","text":"Checking the delay."}\n')),
  );
  expect(host.querySelector('.dxp-ai-reasoning')?.textContent).toContain('Checking the delay.');
  expect(onChange.mock.lastCall![0]).toEqual(baseline);
  expect(undoButton().disabled).toBe(true);
  await act(async () => {
    stream.enqueue(
      encoder.encode(
        `${JSON.stringify({
          type: 'result',
          response: {
            message: 'Renamed.',
            operations: [{ type: 'update_node', id: 'delay', label: 'Pause' }],
          },
        })}\n`,
      ),
    );
    stream.close();
  });
  expect(onChange.mock.lastCall![0].nodes.find((node) => node.id === 'delay')?.data.label).toBe(
    'Pause',
  );
  expect(host.querySelector('.dxp-ai-reasoning')?.textContent).toContain('Checking the delay.');
  expect(host.querySelector('.dxp-ai-applied')?.textContent).toContain('1 edit applied');
});

it.each(['complete', 'interrupt'])(
  'applies the workflow before the explanation ends (%s) and never reapplies it',
  async (mode) => {
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              stream = controller;
            },
          }),
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      ),
    );
    const { onChange, baseline } = await renderConnectedBuilder();
    await typeMessage('Rename the delay');
    await click(button('Send message'));
    const response = {
      message: 'Ready.',
      operations: [{ type: 'update_node', id: 'delay', label: 'Pause' }],
    };
    await act(async () => {
      stream.enqueue(encoder.encode(JSON.stringify({ type: 'workflow-ready', response }) + '\n'));
    });
    expect(onChange.mock.lastCall?.[0].nodes.find((node) => node.id === 'delay')?.data.label).toBe(
      'Pause',
    );
    expect(host.querySelector('.dxp-ai-applied')?.textContent).toContain('1 edit applied');
    expect(button('Stop generating')).toBeTruthy();
    await click(undoButton());
    expect(onChange.mock.lastCall?.[0]).toEqual(baseline);
    await act(async () => {
      if (mode === 'complete')
        stream.enqueue(
          encoder.encode(
            JSON.stringify({ type: 'result', response: { ...response, message: 'Renamed.' } }) +
              '\n',
          ),
        );
      stream.close();
    });
    expect(onChange.mock.lastCall?.[0]).toEqual(baseline);
    expect(undoButton().disabled).toBe(true);
    if (mode === 'interrupt') {
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        'Workflow changes were applied',
      );
      expect(host.querySelector('[role="alert"]')?.textContent).not.toContain('No changes');
    }
  },
);

it('preserves applied edit status when the user stops the explanation', async () => {
  await renderChat({
    onSend: async (_messages, signal, _text, _reasoning, applied) => {
      applied?.(2);
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Stopped'))),
      );
    },
  });
  await click(button('AI chat'));
  await typeMessage('Update my workflow');
  await click(button('Send message'));
  expect(host.querySelector('.dxp-ai-applied')?.textContent).toContain('2 edits applied');
  await click(button('Stop generating'));
  expect(host.querySelector('.dxp-ai-applied')?.textContent).toContain('2 edits applied');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    'Workflow changes were applied',
  );
  expect(composer().value).toBe('');
});

it('rejects an early workflow batch after the canvas changes', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            stream = controller;
          },
        }),
        { headers: { 'Content-Type': 'application/x-ndjson' } },
      ),
    ),
  );
  const { onChange, baseline, api } = await renderConnectedBuilder();
  await typeMessage('Rename the delay');
  await click(button('Send message'));
  await act(async () => api.renameWorkflow('Manual title'));
  await act(async () =>
    stream.enqueue(
      new TextEncoder().encode(
        JSON.stringify({
          type: 'workflow-ready',
          response: {
            message: 'Ready.',
            operations: [{ type: 'update_node', id: 'delay', label: 'Pause' }],
          },
        }) + '\n',
      ),
    ),
  );
  expect(onChange.mock.lastCall?.[0]).toEqual({ ...baseline, name: 'Manual title' });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('The canvas changed');
});

it('retains the reviewed proposal and canvas version when the user approves an alternative', async () => {
  const reviewProposal = {
    workflowVersion: 'a'.repeat(64),
    proposal: 'Track confirmed purchases. Apply this?',
  };
  const onSend = vi
    .fn()
    .mockResolvedValueOnce({ message: reviewProposal.proposal, changeCount: 1, reviewProposal })
    .mockResolvedValueOnce({ message: 'Applied.', changeCount: 1 });
  await renderChat({ onSend, open: true });
  await typeMessage('Add purchase tracking');
  await pressKey('Enter');
  await typeMessage('Yes, apply that');
  await pressKey('Enter');
  expect(onSend.mock.calls[1][0]).toContainEqual({
    role: 'assistant',
    content: reviewProposal.proposal,
    reviewProposal,
  });
});
