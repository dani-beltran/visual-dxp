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
    websiteUrl: 'https://example.com',
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
  const exported = (window as Window & { FormaDXP?: ReturnType<typeof createRuntime> }).FormaDXP;
  exported?.destroy();
  delete (window as Window & { FormaDXP?: ReturnType<typeof createRuntime> }).FormaDXP;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('workflow runtime', () => {
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
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
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

  it('sends headers and body, reports HTTP failures, and does not execute downstream steps', async () => {
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
          node('update', 'dom', { selector: '#result', value: 'Wrong' }),
        ],
        [
          ['start', 'request'],
          ['request', 'update'],
        ],
      ),
      { fetch: request, onLog: (entry) => logs.push(entry) },
    );
    await expect(instance.run()).rejects.toThrow('HTTP 503 Unavailable');
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
    expect(document.querySelector('#result')!.textContent).toBe('Waiting');
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
    expect(document.querySelector('[data-forma-popover]')).toBeNull();
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
    expect(document.querySelector('[data-forma-popover="html"] h2')!.textContent).toBe('Welcome');
    const frame = document.querySelector('[data-forma-popover="frame"] iframe')!;
    expect(frame.getAttribute('src')).toBe('https://example.com/embed');
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    (document.querySelector('[data-forma-popover="html"] button') as HTMLButtonElement).click();
    expect(document.querySelectorAll('[data-forma-popover]')).toHaveLength(1);
    instance.destroy();
    expect(document.querySelectorAll('[data-forma-popover]')).toHaveLength(0);
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
    Object.assign(window, { FormaDXP: previous });
    new Function('window', 'document', script)(window, document);
    expect(previous.destroy).toHaveBeenCalledOnce();
    (document.querySelector('#result') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(document.querySelector('#result')!.textContent).toBe('</script> & \u2028 hello'),
    );
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
