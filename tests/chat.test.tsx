// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasChat, type CanvasChatProps } from '../src/components/CanvasChat';
import { VisualDXPBuilder, type VisualDXPBuilderApi } from '../src/components/VisualDXPBuilder';
import type { Workflow } from '../src/lib/types';

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;

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
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
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
    expect(host.textContent).toContain('Server defaults active');
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
    expect(composer().disabled).toBe(true);
    expect(button('Send message').disabled).toBe(true);
    expect(host.querySelector('.dxp-ai-suggestions')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
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

  it('allows stopping an active request and restores the draft after cancellation', async () => {
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
    await click(button('Stop generating'));
    expect(signal.aborted).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Stopped.');
    expect(composer().value).toBe('Add ten steps');
    expect(composer().disabled).toBe(false);
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
