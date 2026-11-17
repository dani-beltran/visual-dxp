// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionPreview } from '../src/lib/connections';
import { exportWorkflow } from '../src/lib/export';
import { getNodeDataFlow, getNodeDataPorts } from '../src/lib/nodeData';
import { popoverHasForm } from '../src/lib/popoverForm';
import { createRuntime } from '../src/lib/runtime';
import type { NodeKind, RunLog, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function node(id: string, kind: NodeKind, config: StepConfig = {}): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function workflow(nodes: WorkflowNode[], connections: [string, string][]): Workflow {
  return {
    version: 1,
    name: 'Form experience',
    websiteUrl: window.location.href,
    nodes,
    edges: connections.map(([source, target], index) => ({ id: `e${index}`, source, target })),
  };
}

const signupForm =
  '<form action="https://example.com/never" method="post">' +
  '<input name="email" value="ada@example.com">' +
  '<input type="checkbox" name="topics" value="news" checked>' +
  '<input type="checkbox" name="topics" value="offers" checked>' +
  '<input type="checkbox" name="topics" value="events">' +
  '<button name="plan" value="pro">Join</button>' +
  '</form>';

type Runtime = ReturnType<typeof createRuntime>;
const runtimes: Runtime[] = [];
function runtime(...args: Parameters<typeof createRuntime>) {
  const instance = createRuntime(...args);
  runtimes.push(instance);
  return instance;
}

afterEach(() => {
  runtimes.splice(0).forEach((instance) => {
    instance.destroy();
  });
  const exported = (window as Window & { visualDXP?: Runtime }).visualDXP;
  exported?.destroy();
  delete (window as Window & { visualDXP?: Runtime }).visualDXP;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function popoverForm(id = 'signup'): HTMLFormElement {
  const form = document.querySelector(`[data-visual-dxp-popover="${id}"] form`);
  if (!(form instanceof HTMLFormElement)) throw new Error('Expected a popover form.');
  return form;
}
function resultText(): string | null | undefined {
  return document.querySelector('#result')?.textContent;
}
function submitButton(id = 'signup'): HTMLButtonElement {
  return popoverForm(id).querySelector('button') as HTMLButtonElement;
}

describe('popover form detection', () => {
  it.each([
    ['<form><input name="email"></form>', true],
    ['<div><FORM class="signup">…</FORM></div>', true],
    ['<form\n  id="multiline"></form>', true],
    ['<form/>', true],
    ['<p>Fill in our form below</p>', false],
    ['<formula>x</formula>', false],
    ['<!-- <form> disabled for now -->', false],
    ['<script>const markup = "<form>";</script>', false],
    ['<style>form { color: red }</style>', false],
    ['<textarea><form></form></textarea>', false],
    ['<template><form></form></template>', false],
    ['<template><form></form></template><form></form>', true],
  ])('%s → %s', (content, expected) => {
    expect(popoverHasForm({ contentType: 'html', content })).toBe(expected);
  });

  it('treats missing content types as HTML and never inspects iframe popovers', () => {
    expect(popoverHasForm({ content: '<form></form>' })).toBe(true);
    expect(popoverHasForm({ contentType: 'iframe', content: '<form></form>' })).toBe(false);
    expect(popoverHasForm({})).toBe(false);
  });
});

describe('popover form data flow', () => {
  it('makes a popover with a form produce data like an HTTP request', () => {
    const nodes = [
      node('request', 'http'),
      node('signup', 'popover', { content: signupForm }),
      node('wait', 'delay'),
      node('save', 'http'),
    ];
    const edges = [
      { source: 'request', target: 'signup' },
      { source: 'signup', target: 'wait' },
      { source: 'wait', target: 'save' },
    ];
    expect(nodes.map(({ id }) => getNodeDataFlow(id, nodes, edges))).toEqual([
      'produces',
      'produces',
      'forwards',
      'produces',
    ]);
    expect(getNodeDataFlow('signup', nodes, [])).toBe('produces');
    expect(getNodeDataPorts(nodes[1].data)).toEqual({ acceptsData: false, outputsData: true });
  });

  it('keeps popovers without a form, including iframes, as ordinary forwarding steps', () => {
    for (const config of [
      { content: '<h2>Hello</h2>' },
      { contentType: 'iframe' as const, url: 'https://example.com', content: '<form></form>' },
    ]) {
      const nodes = [node('message', 'popover', config), node('update', 'dom')];
      const edges = [{ source: 'message', target: 'update' }];
      expect(getNodeDataFlow('message', nodes, edges)).toBeUndefined();
      expect(getNodeDataFlow('update', nodes, edges)).toBeUndefined();
      expect(getNodeDataPorts(nodes[0].data).outputsData).toBe(false);
    }
  });
});

describe('popover form runtime', () => {
  function signupWorkflow(extra: StepConfig = {}) {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    return workflow(
      [
        node('start', 'trigger'),
        node('signup', 'popover', { content: signupForm, ...extra }),
        node('update', 'dom', { selector: '#result', value: '{{email}} · {{topics[1]}}' }),
      ],
      [
        ['start', 'signup'],
        ['signup', 'update'],
      ],
    );
  }

  it('waits for submission, prevents it, and passes the payload downstream', async () => {
    const logs: RunLog[] = [];
    const previews: [string, ConnectionPreview][] = [];
    const instance = runtime(signupWorkflow(), {
      onLog: (log) => logs.push(log),
      onConnectionPreview: (edgeId, preview) => previews.push([edgeId, preview]),
    });
    let finished = false;
    const running = instance.run('start').then(() => {
      finished = true;
    });
    await vi.waitFor(() => popoverForm());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(finished).toBe(false);
    expect(resultText()).toBe('Waiting');
    expect(logs.at(-1)).toMatchObject({
      nodeId: 'signup',
      status: 'running',
      message: 'Waiting for the form to be submitted',
    });

    const submitted = vi.fn((event: Event) => event.defaultPrevented);
    // Author handlers that stop propagation cannot bypass the capture listener.
    popoverForm().addEventListener('submit', (event) => {
      submitted(event);
      event.stopPropagation();
    });
    submitButton().click();
    await running;

    expect(submitted).toHaveReturnedWith(true);
    expect(resultText()).toBe('ada@example.com · offers');
    expect(document.querySelector('[data-visual-dxp-popover]')).toBeNull();
    expect(previews).toEqual([
      ['e0', { source: { exists: false, value: undefined } }],
      [
        'e1',
        {
          source: {
            exists: true,
            value: { email: 'ada@example.com', topics: ['news', 'offers'], plan: 'pro' },
          },
        },
      ],
    ]);
    expect(logs.filter((log) => log.nodeId === 'signup').map((log) => log.message)).toEqual([
      'Running step',
      'Waiting for the form to be submitted',
      'Form submission captured. The form was not sent; this data is passed to the next step:',
    ]);
    // The log shows exactly what the next step receives, as formatted JSON.
    const captured = logs.find((log) => log.nodeId === 'signup' && log.data !== undefined);
    expect(captured?.status).toBe('success');
    expect(captured?.data).toBe(JSON.stringify(previews[1][1].source.value, null, 2));
    expect(captured?.data).toBe(
      '{\n  "email": "ada@example.com",\n  "topics": [\n    "news",\n    "offers"\n  ],\n  "plan": "pro"\n}',
    );
    expect(logs.filter((log) => log.data !== undefined)).toHaveLength(1);
  });

  it('bounds very large captured data in the log without truncating the data itself', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const logs: RunLog[] = [];
    const long = 'x'.repeat(20000);
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('signup', 'popover', {
            content: `<form><textarea name="notes">${long}</textarea><button>Send</button></form>`,
          }),
          node('update', 'dom', { selector: '#result', value: '{{notes}}' }),
        ],
        [
          ['start', 'signup'],
          ['signup', 'update'],
        ],
      ),
      { onLog: (log) => logs.push(log) },
    );
    const running = instance.run('start');
    await vi.waitFor(() => popoverForm());
    submitButton().click();
    await running;
    const data = logs.find((log) => log.data !== undefined)?.data ?? '';
    expect(data.startsWith('{\n  "notes": "xxx')).toBe(true);
    expect(data.endsWith('… (truncated in this log)')).toBe(true);
    expect(data.length).toBeLessThan(8100);
    expect(resultText()).toBe(long);
  });

  it('sends the captured fields in a downstream HTTP request body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('signup', 'popover', {
            content:
              '<form><input name="email" value="ada@example.com"><input name="__proto__" value="kept"><input type="file" name="avatar"><button>Send</button></form>',
          }),
          node('save', 'http', {
            url: 'https://api.example.com/subscribe',
            method: 'POST',
            body: '{"email": {{email}}, "legacy": {{__proto__}}, "avatar": {{avatar}}}',
          }),
        ],
        [
          ['start', 'signup'],
          ['signup', 'save'],
        ],
      ),
      { fetch: fetcher },
    );
    const running = instance.run('start');
    await vi.waitFor(() => popoverForm());
    submitButton().click();
    await running;
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Names such as __proto__ stay ordinary fields; empty file inputs become empty names.
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      email: 'ada@example.com',
      legacy: 'kept',
      avatar: '',
    });
  });

  it('stops the path without data when the popover is closed before submitting', async () => {
    const logs: RunLog[] = [];
    const instance = runtime(signupWorkflow(), { onLog: (log) => logs.push(log) });
    const running = instance.run('start');
    await vi.waitFor(() => popoverForm());
    (
      document.querySelector('[data-visual-dxp-popover] button[aria-label]') as HTMLButtonElement
    ).click();
    await running;
    expect(resultText()).toBe('Waiting');
    expect(logs.some((log) => log.nodeId === 'update')).toBe(false);
    expect(logs.at(-1)).toMatchObject({
      nodeId: 'signup',
      status: 'success',
      message: 'Popover closed before the form was submitted',
    });
  });

  it('ends an earlier wait when the same popover is shown again', async () => {
    const instance = runtime(signupWorkflow());
    const first = instance.run('start');
    await vi.waitFor(() => popoverForm());
    const firstForm = popoverForm();
    const second = instance.run('start');
    await first;
    expect(firstForm.isConnected).toBe(false);
    expect(document.querySelectorAll('[data-visual-dxp-popover]')).toHaveLength(1);
    expect(resultText()).toBe('Waiting');
    submitButton().click();
    await second;
    expect(resultText()).toBe('ada@example.com · offers');
  });

  it('releases a waiting run when the runtime is destroyed', async () => {
    const instance = runtime(signupWorkflow());
    const running = instance.run('start');
    await vi.waitFor(() => popoverForm());
    instance.destroy();
    await expect(running).resolves.toBeUndefined();
    expect(document.querySelector('[data-visual-dxp-popover]')).toBeNull();
    expect(resultText()).toBe('Waiting');
  });

  it('keeps popovers without forms non-blocking', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const instance = runtime(
      workflow(
        [
          node('start', 'trigger'),
          node('message', 'popover', { content: '<h2>Hello</h2>' }),
          node('update', 'dom', { selector: '#result', value: 'Done' }),
        ],
        [
          ['start', 'message'],
          ['message', 'update'],
        ],
      ),
    );
    await instance.run('start');
    expect(resultText()).toBe('Done');
    expect(document.querySelector('[data-visual-dxp-popover] h2')).not.toBeNull();
  });

  it('captures form submissions in exported scripts', async () => {
    const graph = signupWorkflow();
    new Function('window', 'document', exportWorkflow(graph))(window, document);
    const exported = (window as Window & { visualDXP?: Runtime }).visualDXP;
    if (!exported) throw new Error('Expected the exported runtime to be installed.');
    const running = exported.run('start');
    await vi.waitFor(() => popoverForm());
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: submitButton(),
    });
    popoverForm().dispatchEvent(event);
    await running;
    expect(event.defaultPrevented).toBe(true);
    expect(resultText()).toBe('ada@example.com · offers');
  });
});
