// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import type { NodeKind, RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function node(id: string, kind: NodeKind, config: StepConfig = {}): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function workflow(nodes: WorkflowNode[], connections: [string, string, string?][]): Workflow {
  return {
    version: 1,
    name: 'Test experience',
    websiteUrl: window.location.href,
    nodes,
    edges: connections.map(([source, target, sourceHandle], index) => ({
      id: `e${index}`,
      source,
      target,
      sourceHandle,
    })),
  };
}

const runtimes: ReturnType<typeof createRuntime>[] = [];
function runtime(...args: Parameters<typeof createRuntime>) {
  const instance = createRuntime(...args);
  runtimes.push(instance);
  return instance;
}

afterEach(() => {
  runtimes.splice(0).forEach((instance) => {
    instance.destroy();
  });
  const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP;
  exported?.destroy();
  delete (window as Window & { visualDXP?: ReturnType<typeof createRuntime> }).visualDXP;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('workflow runtime', () => {
  it('resolves proxied-preview HTTP steps against the original upstream base', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    const graph = workflow(
      [
        node('load', 'trigger', { event: 'page-load' }),
        node('request', 'http', { url: '../api/products?limit=1', method: 'GET' }),
      ],
      [['load', 'request']],
    );
    const instance = runtime(graph, {
      baseUrl: 'https://shop.example/catalog/item',
      fetch: fetcher,
    });
    await instance.run('load');
    expect(fetcher.mock.calls[0][0]).toBe('https://shop.example/api/products?limit=1');
    expect(graph.websiteUrl).toBe(window.location.href);
  });

  it.each(['note', 'frame'] as const)(
    'ignores connected %s annotations without logs, step budget usage, or following their outputs',
    async (kind) => {
      document.body.innerHTML = '<p id="result">Waiting</p><p id="annotation-output">Unchanged</p>';
      const logs: RunLog[] = [];
      const instance = runtime(
        workflow(
          [
            node('start', 'trigger'),
            node('note', kind, { noteText: 'Canvas only', selector: '#result', value: 'Wrong' }),
            node('hidden', 'dom', { selector: '#annotation-output', value: 'Wrong' }),
            node('update', 'dom', { selector: '#result', value: 'Done' }),
          ],
          [
            ['start', 'note'],
            ['note', 'hidden'],
            ['note', 'note'],
            ['start', 'update'],
          ],
        ),
        { maxSteps: 2, onLog: (entry) => logs.push(entry) },
      );
      await expect(instance.run()).resolves.toBeUndefined();
      expect(document.querySelector('#result')?.textContent).toBe('Done');
      expect(document.querySelector('#annotation-output')?.textContent).toBe('Unchanged');
      expect(logs.map((entry) => entry.nodeId)).toEqual(['start', 'start', 'update', 'update']);
    },
  );

  it('waits for DOM readiness and cancels a pending page-load trigger on destroy', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const graph = workflow(
      [
        node('start', 'trigger', { event: 'page-load' }),
        node('update', 'dom', { selector: '#result', value: 'Ready' }),
      ],
      [['start', 'update']],
    );
    const active = runtime(graph);
    active.start();
    expect(document.querySelector('#result')!.textContent).toBe('Waiting');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await vi.waitFor(() => expect(document.querySelector('#result')!.textContent).toBe('Ready'));
    const cancelled = runtime(graph);
    cancelled.start();
    cancelled.destroy();
    document.querySelector('#result')!.textContent = 'Waiting';
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();
    expect(document.querySelector('#result')!.textContent).toBe('Waiting');
  });

  it('delegates click triggers to dynamically added elements and removes listeners on destroy', async () => {
    const logs: RunLog[] = [];
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger', { event: 'click', selector: '.buy' }),
          node('update', 'dom', { selector: '#result', action: 'text', value: 'Added' }),
        ],
        [['start', 'update']],
      ),
      { onLog: (entry) => logs.push(entry) },
    );
    instance.start();
    instance.start();
    document.body.innerHTML =
      '<button class="buy"><span>Buy</span></button><p id="result">Waiting</p>';
    document.querySelector('span')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('#result')!.textContent).toBe('Added'));
    expect(
      logs.filter((entry) => entry.nodeId === 'start' && entry.status === 'success'),
    ).toHaveLength(1);
    instance.destroy();
    document.querySelector('#result')!.textContent = 'Unchanged';
    document.querySelector('button')!.click();
    await Promise.resolve();
    expect(document.querySelector('#result')!.textContent).toBe('Unchanged');
  });

  it('installs triggers and applies effects only in the supplied website iframe', async () => {
    document.body.innerHTML = '<button class="buy">Editor</button><p id="result">Editor</p>';
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const website = frame.contentDocument;
    const websiteWindow = frame.contentWindow;
    if (!website || !websiteWindow) throw new Error('Expected an accessible website iframe.');
    website.body.innerHTML =
      '<button class="buy"><span>Buy</span></button><p id="result">Waiting</p>';
    vi.spyOn(website, 'readyState', 'get').mockReturnValue('complete');
    const instance = runtime(
      workflow(
        [
          node('load', 'trigger', { event: 'page-load' }),
          node('ready', 'dom', { selector: '#result', value: 'Ready' }),
          node('click', 'trigger', { event: 'click', selector: '.buy' }),
          node('update', 'dom', { selector: '#result', value: 'Purchased' }),
          node('message', 'popover', { content: '<h2>Thank you</h2>' }),
        ],
        [
          ['load', 'ready'],
          ['click', 'update'],
          ['update', 'message'],
        ],
      ),
      { document: website, window: websiteWindow },
    );

    instance.start();
    await vi.waitFor(() => expect(website.querySelector('#result')?.textContent).toBe('Ready'));
    expect(website.querySelector('[data-visual-dxp-popover]')).toBeNull();
    (document.querySelector('.buy') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(website.querySelector('#result')?.textContent).toBe('Ready');

    (website.querySelector('.buy span') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(website.querySelector('[data-visual-dxp-popover] h2')?.textContent).toBe('Thank you'),
    );
    expect(website.querySelector('#result')?.textContent).toBe('Purchased');
    expect(document.querySelector('#result')?.textContent).toBe('Editor');
    expect(document.querySelector('[data-visual-dxp-popover]')).toBeNull();

    instance.destroy();
    expect(website.querySelector('[data-visual-dxp-popover]')).toBeNull();
    const result = website.querySelector('#result');
    if (!result) throw new Error('Expected the website result element.');
    result.textContent = 'Stopped';
    (website.querySelector('.buy') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(result.textContent).toBe('Stopped');
  });

  it('resolves requests against the website document and calls its window fetch', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const website = frame.contentDocument;
    const websiteWindow = frame.contentWindow;
    if (!website || !websiteWindow) throw new Error('Expected an accessible website iframe.');
    website.head.innerHTML = '<base href="https://shop.example.com/products/">';
    const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response('ok'));
    Object.defineProperty(websiteWindow, 'fetch', { configurable: true, value: request });
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('request', 'http', { url: './events', method: 'POST', body: 'purchased' }),
        ],
        [['start', 'request']],
      ),
      { document: website, window: websiteWindow },
    );

    await instance.run();
    expect(request).toHaveBeenCalledWith(
      'https://shop.example.com/products/events',
      expect.objectContaining({ method: 'POST', body: 'purchased' }),
    );
    expect(request.mock.contexts).toEqual([websiteWindow]);
    instance.destroy();
    expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it.each([true, false])(
    'chooses exactly one branch based on selector existence: %s',
    async (matches) => {
      document.body.innerHTML = `${matches ? '<div class="member"></div>' : ''}<p id="result">Waiting</p>`;
      const instance = runtime(
        workflow(
          [
            node('start', 'trigger'),
            node('branch', 'fork', { condition: '.member' }),
            node('yes', 'dom', { selector: '#result', value: 'Member' }),
            node('no', 'dom', { selector: '#result', value: 'Guest' }),
          ],
          [
            ['start', 'branch'],
            ['branch', 'yes', 'true'],
            ['branch', 'no', 'false'],
          ],
        ),
      );
      await instance.run();
      expect(document.querySelector('#result')!.textContent).toBe(matches ? 'Member' : 'Guest');
    },
  );

  it('awaits every repeated body before executing the done branch once', async () => {
    const completed: string[] = [];
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response('ok'));
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('repeat', 'loop', { iterations: 3 }),
          node('request', 'http', { url: 'https://example.com/event' }),
          node('done', 'dom', { selector: '#result', value: 'Done' }),
        ],
        [
          ['start', 'repeat'],
          ['repeat', 'request', 'body'],
          ['repeat', 'done', 'done'],
        ],
      ),
      {
        fetch: request,
        onLog: (entry) => {
          if (entry.status === 'success') completed.push(entry.nodeId);
        },
      },
    );
    await instance.run();
    expect(request).toHaveBeenCalledTimes(3);
    expect(completed).toEqual(['start', 'repeat', 'request', 'request', 'request', 'done']);
    expect(document.querySelector('#result')!.textContent).toBe('Done');
  });

  it('waits before downstream effects and cancels pending delays when destroyed', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const graph = workflow(
      [
        node('start', 'trigger'),
        node('wait', 'delay', { duration: 500 }),
        node('update', 'dom', { selector: '#result', value: 'Finished' }),
      ],
      [
        ['start', 'wait'],
        ['wait', 'update'],
      ],
    );
    const first = runtime(graph);
    const firstRun = first.run();
    await vi.advanceTimersByTimeAsync(499);
    expect(document.querySelector('#result')!.textContent).toBe('Waiting');
    await vi.advanceTimersByTimeAsync(1);
    await firstRun;
    expect(document.querySelector('#result')!.textContent).toBe('Finished');
    document.querySelector('#result')!.textContent = 'Waiting';
    const second = runtime(graph);
    const secondRun = second.run();
    expect(vi.getTimerCount()).toBe(1);
    second.destroy();
    await secondRun;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector('#result')!.textContent).toBe('Waiting');
  });

  it('sends headers and body, reports HTTP failures, and executes downstream steps', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('failed', { status: 503, statusText: 'Unavailable' }));
    const logs: RunLog[] = [];
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('request', 'http', {
            url: 'https://example.com/event',
            method: 'POST',
            headers: '{"Content-Type":"application/json"}',
            body: '{"hello":true}',
          }),
          node('update', 'dom', { selector: '#result', value: '{{$}}' }),
        ],
        [
          ['start', 'request'],
          ['request', 'update'],
        ],
      ),
      { fetch: request, onLog: (entry) => logs.push(entry) },
    );
    await expect(instance.run()).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      'https://example.com/event',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"hello":true}',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(logs.filter((entry) => entry.status === 'error').map((entry) => entry.nodeId)).toEqual([
      'request',
    ]);
    expect(JSON.parse(document.querySelector('#result')!.textContent!)).toEqual({
      error: { message: 'Request failed: HTTP 503 Unavailable.', code: 503 },
    });
    expect(logs.some((entry) => entry.nodeId === 'request' && entry.status === 'success')).toBe(
      false,
    );
    instance.destroy();
    expect((request.mock.calls[0][1]!.signal as AbortSignal).aborted).toBe(true);
  });

  it('aborts an in-flight request when the external signal aborts', async () => {
    const external = new AbortController();
    const logs: RunLog[] = [];
    const request = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('request', 'http', { url: 'https://example.com/event' }),
          node('after', 'popover', { content: 'This must not appear' }),
        ],
        [
          ['start', 'request'],
          ['request', 'after'],
        ],
      ),
      { fetch: request, signal: external.signal, onLog: (entry) => logs.push(entry) },
    );
    const pending = instance.run();
    expect(request).toHaveBeenCalledOnce();
    external.abort();
    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelector('[data-visual-dxp-popover]')).toBeNull();
    expect(logs.some((entry) => entry.status === 'error')).toBe(false);
    expect((request.mock.calls[0][1]!.signal as AbortSignal).aborted).toBe(true);
  });

  it('updates every matching element and supports class, attribute, visibility, and HTML actions', async () => {
    document.body.innerHTML =
      '<p class="target old" hidden style="display:none">Old</p><p class="target old">Old</p>';
    const steps = [
      node('start', 'trigger'),
      node('html', 'dom', { selector: '.target', action: 'html', value: '<strong>New</strong>' }),
      node('add', 'dom', { selector: '.target', action: 'add-class', value: 'new highlighted' }),
      node('remove', 'dom', { selector: '.target', action: 'remove-class', value: 'old' }),
      node('attribute', 'dom', {
        selector: '.target',
        action: 'attribute',
        attribute: 'data-state',
        value: 'ready',
      }),
      node('show', 'dom', { selector: '.target', action: 'show' }),
    ];
    await runtime(
      workflow(
        steps,
        steps.slice(1).map((step, index) => [steps[index].id, step.id]),
      ),
    ).run();
    for (const target of document.querySelectorAll('.target')) {
      expect(target.innerHTML).toBe('<strong>New</strong>');
      expect(target.className).toBe('target new highlighted');
      expect(target.getAttribute('data-state')).toBe('ready');
      expect(target.hasAttribute('hidden')).toBe(false);
      expect((target as HTMLElement).style.display).not.toBe('none');
    }
  });

  it('creates anchored HTML and sandboxed iframe popovers and cleans them up', async () => {
    document.body.innerHTML = '<button id="anchor">Anchor</button>';
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('html', 'popover', {
            contentType: 'html',
            content: '<h2>Welcome</h2>',
            position: 'anchor',
            selector: '#anchor',
          }),
          node('frame', 'popover', {
            contentType: 'iframe',
            url: 'https://example.com/embed',
            position: 'top-left',
            width: 400,
          }),
        ],
        [
          ['start', 'html'],
          ['html', 'frame'],
        ],
      ),
    );
    await instance.run();
    expect(document.querySelector('[data-visual-dxp-popover="html"] h2')!.textContent).toBe(
      'Welcome',
    );
    const frame = document.querySelector('[data-visual-dxp-popover="frame"] iframe')!;
    expect(frame.getAttribute('src')).toBe('https://example.com/embed');
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    (
      document.querySelector('[data-visual-dxp-popover="html"] button') as HTMLButtonElement
    ).click();
    expect(document.querySelectorAll('[data-visual-dxp-popover]')).toHaveLength(1);
    instance.destroy();
    expect(document.querySelectorAll('[data-visual-dxp-popover]')).toHaveLength(0);
  });

  it('rejects circular connections even when validation is bypassed', async () => {
    const instance = runtime(
      workflow(
        [node('start', 'trigger'), node('cycle', 'fork', { condition: 'body' })],
        [
          ['start', 'cycle'],
          ['cycle', 'cycle', 'true'],
        ],
      ),
      { maxSteps: 5 },
    );
    await expect(instance.run()).rejects.toThrow('Circular connections');
  });

  it('limits the combined number of steps in repeated executions', async () => {
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('repeat', 'loop', { iterations: 10 }),
          node('body', 'fork', { condition: 'body' }),
        ],
        [
          ['start', 'repeat'],
          ['repeat', 'body', 'body'],
        ],
      ),
      { maxSteps: 5 },
    );
    await expect(instance.run()).rejects.toThrow('Execution stopped after 5 steps');
  });
});

describe('workflow export', () => {
  it('accepts blank annotations and omits all note content from executable scripts', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const graph = workflow(
      [
        node('start', 'trigger', { event: 'click', selector: '#result' }),
        node('update', 'dom', { selector: '#result', value: 'Done' }),
        node('private-note', 'note', { noteText: 'Annotation content only', noteBold: true }),
        node('empty-note', 'note'),
      ],
      [['start', 'update']],
    );
    expect(validateWorkflow(graph)).toEqual([]);
    const script = exportWorkflow(graph);
    expect(script).not.toContain('private-note');
    expect(script).not.toContain('empty-note');
    expect(script).not.toContain('Annotation content only');
    expect(script).not.toContain('noteBold');
    new Function('window', 'document', script)(window, document);
    (document.querySelector('#result') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('#result')?.textContent).toBe('Done'));
  });

  it('rejects connections to and from notes when validating or exporting', () => {
    for (const connection of [
      ['start', 'note'],
      ['note', 'update'],
    ] as [string, string][]) {
      const graph = workflow(
        [
          node('start', 'trigger'),
          node('note', 'note'),
          node('update', 'dom', { selector: '#result', value: 'Done' }),
        ],
        [connection],
      );
      expect(validateWorkflow(graph)).toEqual([
        { nodeId: 'note', message: 'Notes cannot have workflow connections.' },
      ]);
      expect(() => exportWorkflow(graph)).toThrow('Notes cannot have workflow connections.');
    }
  });

  it('reports malformed note colors and formatting without requiring annotation text', () => {
    const graph = workflow(
      [
        node('start', 'trigger'),
        node('note', 'note', { noteColor: 'red', noteBold: 'true' as unknown as boolean }),
      ],
      [],
    );
    expect(validateWorkflow(graph)).toEqual([
      { nodeId: 'note', message: 'Note text formatting must contain boolean values.' },
      { nodeId: 'note', message: 'Note colors must be a six-digit hex color or transparent.' },
    ]);
  });

  it('produces an executable dependency-free script, escapes inline-script content, and replaces previous runtimes', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const graph = workflow(
      [
        node('start', 'trigger', { event: 'click', selector: '#result' }),
        node('update', 'dom', { selector: '#result', value: '</script> & \u2028 hello' }),
      ],
      [['start', 'update']],
    );
    const script = exportWorkflow(graph);
    expect(script).not.toContain('</script>');
    expect(script).toContain('\\u003c/script\\u003e');
    expect(script).not.toContain('import ');
    const previous = { destroy: vi.fn() };
    Object.assign(window, { visualDXP: previous });
    new Function('window', 'document', script)(window, document);
    expect(previous.destroy).toHaveBeenCalledOnce();
    (document.querySelector('#result') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(document.querySelector('#result')!.textContent).toBe('</script> & \u2028 hello'),
    );
  });

  it('exports connected runtime modules with shared cancellation and popover cleanup', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="start">Run</button><p id="result">Waiting</p>';
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('ok'));
    const graph = workflow(
      [
        node('start', 'trigger', { event: 'click', selector: '#start' }),
        node('wait', 'delay', { duration: 100 }),
        node('branch', 'fork', { condition: '#result' }),
        node('repeat', 'loop', { iterations: 2 }),
        node('request', 'http', { url: 'https://example.com/event' }),
        node('update', 'dom', { selector: '#result', value: 'Done' }),
        node('message', 'popover', { content: '<h2>Finished</h2>' }),
      ],
      [
        ['start', 'wait'],
        ['wait', 'branch'],
        ['branch', 'repeat', 'true'],
        ['repeat', 'request', 'body'],
        ['repeat', 'update', 'done'],
        ['update', 'message'],
      ],
    );

    new Function('window', 'document', exportWorkflow(graph))(window, document);
    const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
      .visualDXP;
    if (!exported) throw new Error('Expected the exported runtime to be installed.');
    const running = exported.run();
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    await running;
    expect(request).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#result')?.textContent).toBe('Done');
    expect(document.querySelector('[data-visual-dxp-popover] h2')?.textContent).toBe('Finished');

    const cancelled = exported.run();
    exported.destroy();
    await cancelled;
    expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(document.querySelector('[data-visual-dxp-popover]')).toBeNull();
    (document.querySelector('#start') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(100);
    expect(request).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects cycles, invalid branch connections, unsafe URLs, and malformed headers', () => {
    const graph = workflow(
      [
        node('start', 'trigger'),
        node('branch', 'fork', { condition: 'body' }),
        node('request', 'http', { url: 'javascript:alert(1)', headers: '["wrong"]' }),
      ],
      [
        ['start', 'branch'],
        ['branch', 'request'],
        ['request', 'branch'],
      ],
    );
    const messages = validateWorkflow(graph)
      .map((issue) => issue.message)
      .join(' ');
    expect(messages).toContain('Circular connections');
    expect(messages).toContain('Yes or No');
    expect(messages).toContain('HTTP or HTTPS');
    expect(messages).toContain('JSON object');
    expect(() => exportWorkflow(graph)).toThrow('Circular connections');
  });

  it('reports malformed JSON imports without throwing during editor validation', () => {
    const graph = workflow(
      [node('start', 'trigger', { event: 'click', selector: 42 as unknown as string })],
      [],
    );
    expect(validateWorkflow(graph)).toEqual([
      { nodeId: 'start', message: 'Step text parameters must contain strings.' },
    ]);
    expect(
      validateWorkflow({ nodes: [null], edges: [] } as unknown as Workflow)[0].message,
    ).toContain('configuration object');
    expect(validateWorkflow(null as unknown as Workflow)[0].message).toContain('arrays');
  });

  it.each(['javascript:alert(1)', 'data:text/html,hello', ''])(
    'rejects unsafe or empty popover frame URLs: %s',
    (url) => {
      const graph = workflow(
        [
          node('start', 'trigger'),
          node('frame', 'popover', {
            contentType: 'iframe',
            url,
            content: '<h2>Previously entered HTML</h2>',
          }),
        ],
        [['start', 'frame']],
      );
      expect(validateWorkflow(graph).some((issue) => issue.message.includes('HTTP or HTTPS'))).toBe(
        true,
      );
    },
  );
});
