import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIChatRequest } from '../src/lib/ai';
import {
  AI_LIMITS,
  applyWorkflowOperations,
  parseAIChatRequest,
  parseAIChatResponse,
  requestAIChat,
  workflowFingerprint,
} from '../src/lib/ai';
import type { NodeKind, StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function step(id: string, kind: NodeKind = 'delay', config: StepConfig = {}): WorkflowNode {
  return { id, type: 'workflow', position: { x: 10, y: 20 }, data: { kind, label: id, config } };
}

function workflow(): Workflow {
  return {
    version: 1,
    name: 'Journey',
    websiteUrl: '/site',
    nodes: [
      step('start', 'trigger', { event: 'page-load' }),
      step('wait', 'delay', { duration: 1000 }),
    ],
    edges: [{ id: 'start-wait', source: 'start', target: 'wait' }],
  };
}

function request(): AIChatRequest {
  return {
    messages: [{ role: 'user', content: 'Add a step' }],
    workflow: workflow(),
    selectedNodeIds: ['wait'],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('atomic AI workflow edits', () => {
  it('adds and updates notes while preserving explicit false formatting and unchanged fields', () => {
    const config: StepConfig = {
      noteText: 'Explain this journey',
      noteColor: '#fff4b8',
      noteBold: true,
      noteItalic: false,
      noteStrikethrough: true,
    };
    const added = applyWorkflowOperations(workflow(), [
      { type: 'add_node', node: step('note', 'note', config) },
    ]);
    expect(added.nodes.at(-1)).toEqual(step('note', 'note', config));
    const updated = applyWorkflowOperations(added, [
      {
        type: 'update_node',
        id: 'note',
        config: { noteText: 'Reviewed', noteColor: 'transparent', noteBold: false },
      },
    ]);
    expect(updated.nodes.at(-1)?.data.config).toEqual({
      ...config,
      noteText: 'Reviewed',
      noteColor: 'transparent',
      noteBold: false,
      noteItalic: false,
      noteStrikethrough: false,
      noteMarks: [],
    });
    expect(added.nodes.at(-1)?.data.config).toEqual(config);
  });

  it('rejects connecting notes from either direction, including updated connections', () => {
    const original = workflow();
    original.nodes.push(step('note', 'note'));
    for (const edge of [
      { id: 'annotation', source: 'start', target: 'note' },
      { id: 'annotation', source: 'note', target: 'wait' },
    ]) {
      expect(() => applyWorkflowOperations(original, [{ type: 'add_edge', edge }])).toThrow(
        'Notes cannot have workflow connections.',
      );
    }
    expect(() =>
      applyWorkflowOperations(original, [
        { type: 'update_edge', id: 'start-wait', target: 'note' },
      ]),
    ).toThrow('Notes cannot have workflow connections.');
  });

  it('adds, updates and connects nodes without mutating the original', () => {
    const original = workflow();
    const snapshot = JSON.stringify(original);
    const result = applyWorkflowOperations(original, [
      { type: 'add_node', node: step('offer', 'popover', { contentType: 'html', content: 'Hi' }) },
      {
        type: 'update_node',
        id: 'wait',
        label: 'Pause briefly',
        description: 'Before the offer',
        config: { duration: 3000 },
        position: { x: 80, y: 40 },
      },
      {
        type: 'add_edge',
        edge: { id: 'wait-offer', source: 'wait', target: 'offer', label: 'Continue' },
      },
    ]);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(result.nodes[1]).toMatchObject({
      position: { x: 80, y: 40 },
      data: { label: 'Pause briefly', description: 'Before the offer', config: { duration: 3000 } },
    });
    expect(result.edges).toHaveLength(2);
    expect(result.nodes).toHaveLength(3);
  });

  it('shallow merges configuration and cannot change the kind', () => {
    const original = workflow();
    original.nodes.push(step('http', 'http', { url: '/api', method: 'GET' }));
    const result = applyWorkflowOperations(original, [
      { type: 'update_node', id: 'http', config: { method: 'POST', body: '{}' } },
    ]);
    expect(result.nodes[2].data.config).toEqual({ url: '/api', method: 'POST', body: '{}' });
    expect(() =>
      applyWorkflowOperations(original, [
        { type: 'update_node', id: 'http', kind: 'dom', label: 'Changed' },
      ]),
    ).toThrow(/step type/);
  });

  it('removes incident connections when removing a node', () => {
    const result = applyWorkflowOperations(workflow(), [{ type: 'remove_node', id: 'wait' }]);
    expect(result.nodes.map((entry) => entry.id)).toEqual(['start']);
    expect(result.edges).toEqual([]);
  });

  it('allows explicitly clearing the canvas', () => {
    const result = applyWorkflowOperations(workflow(), [
      { type: 'remove_node', id: 'start' },
      { type: 'remove_node', id: 'wait' },
    ]);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('allows removing the last trigger and continuing to edit the partial workflow', () => {
    const partial = applyWorkflowOperations(workflow(), [{ type: 'remove_node', id: 'start' }]);
    expect(partial.nodes.map((entry) => entry.id)).toEqual(['wait']);
    expect(partial.edges).toEqual([]);
    expect(() =>
      applyWorkflowOperations(partial, [
        { type: 'update_node', id: 'wait', config: { duration: -1 } },
      ]),
    ).toThrow(/milliseconds/);
    const empty = applyWorkflowOperations(partial, [{ type: 'remove_node', id: 'wait' }]);
    expect(empty.nodes).toEqual([]);
    expect(empty.edges).toEqual([]);
  });

  it('validates the final graph, allowing references to nodes added later and remove/add rewrites', () => {
    const result = applyWorkflowOperations(workflow(), [
      { type: 'add_edge', edge: { id: 'next', source: 'wait', target: 'next' } },
      { type: 'add_node', node: step('next') },
      { type: 'remove_node', id: 'start' },
      { type: 'add_node', node: step('start', 'trigger') },
      { type: 'add_edge', edge: { id: 'start-wait', source: 'start', target: 'wait' } },
    ]);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  it('validates final configuration rather than intermediate configuration', () => {
    const result = applyWorkflowOperations(workflow(), [
      { type: 'update_node', id: 'wait', config: { duration: -1 } },
      { type: 'update_node', id: 'wait', config: { duration: 2000 } },
    ]);
    expect(result.nodes[1].data.config.duration).toBe(2000);
  });

  it('rolls back the whole batch if any operation or the final graph fails', () => {
    const original = workflow();
    const snapshot = JSON.stringify(original);
    expect(() =>
      applyWorkflowOperations(original, [
        { type: 'update_node', id: 'wait', label: 'Changed' },
        { type: 'add_edge', edge: { id: 'broken', source: 'wait', target: 'missing' } },
      ]),
    ).toThrow(/missing step/);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(() =>
      applyWorkflowOperations(original, [{ type: 'update_node', id: 'missing', label: 'Changed' }]),
    ).toThrow(/does not exist/);
    expect(() =>
      applyWorkflowOperations(original, [{ type: 'remove_edge', id: 'missing' }]),
    ).toThrow(/does not exist/);
  });

  it('permits pre-existing incomplete configuration but rejects newly introduced problems', () => {
    const original = workflow();
    original.nodes.push(step('incomplete', 'http'));
    expect(() =>
      applyWorkflowOperations(original, [{ type: 'update_node', id: 'wait', label: 'New label' }]),
    ).not.toThrow();
    expect(() =>
      applyWorkflowOperations(original, [{ type: 'add_node', node: step('new-http', 'http') }]),
    ).toThrow(/request URL/);
    expect(() =>
      applyWorkflowOperations(original, [
        { type: 'update_node', id: 'wait', config: { duration: -1 } },
      ]),
    ).toThrow(/milliseconds/);
  });

  it('rejects invalid config enums, ranges, header shapes and unsafe URL protocols', () => {
    for (const node of [
      step('bad', 'loop', { iterations: 1.5 }),
      step('bad', 'popover', { width: 100 }),
      step('bad', 'trigger', { event: 'invalid' as 'click' }),
      step('bad', 'http', { url: 'javascript:alert(1)' }),
      step('bad', 'http', { url: '/api', headers: '{"a":2}' }),
      step('bad', 'dom', { selector: '#x', action: 'invalid' as 'text' }),
    ])
      expect(() => applyWorkflowOperations(workflow(), [{ type: 'add_node', node }])).toThrow();
  });

  it('rejects duplicate IDs, duplicate connections, incoming triggers and cycles', () => {
    expect(() =>
      applyWorkflowOperations(workflow(), [{ type: 'add_node', node: step('wait') }]),
    ).toThrow(/already exists/);
    expect(() =>
      applyWorkflowOperations(workflow(), [
        { type: 'add_edge', edge: { id: 'duplicate', source: 'start', target: 'wait' } },
      ]),
    ).toThrow(/Duplicate connections/);
    expect(() =>
      applyWorkflowOperations(workflow(), [
        { type: 'add_edge', edge: { id: 'incoming', source: 'wait', target: 'start' } },
      ]),
    ).toThrow(/Triggers/);
    expect(() =>
      applyWorkflowOperations(workflow(), [
        { type: 'add_node', node: step('second') },
        { type: 'add_edge', edge: { id: 'forward', source: 'wait', target: 'second' } },
        { type: 'add_edge', edge: { id: 'back', source: 'second', target: 'wait' } },
      ]),
    ).toThrow(/Circular/);
  });

  it('uses only the source handles supported by the node kind', () => {
    for (const [kind, valid, invalid, config] of [
      ['fork', 'true', 'body', { condition: '#present' }],
      ['loop', 'body', 'true', { iterations: 2 }],
      ['delay', null, 'true', {}],
    ] as const) {
      const original = workflow();
      original.nodes.push(step('source', kind, config));
      const add = (sourceHandle: string | null) => [
        { type: 'add_edge', edge: { id: 'test', source: 'source', target: 'wait', sourceHandle } },
      ];
      expect(() => applyWorkflowOperations(original, add(valid))).not.toThrow();
      expect(() => applyWorkflowOperations(original, add(invalid))).toThrow(/invalid output/);
    }
    expect(() =>
      applyWorkflowOperations(workflow(), [
        {
          type: 'add_edge',
          edge: { id: 'bad', source: 'start', target: 'wait', targetHandle: 'input' },
        },
      ]),
    ).toThrow(/target handles/);
  });

  it('updates connections and clears a branch handle when changing to a normal source', () => {
    const original = workflow();
    original.nodes.push(step('branch', 'fork', { condition: '#present' }), step('second'));
    original.edges.push({
      id: 'branch-second',
      source: 'branch',
      target: 'second',
      sourceHandle: 'true',
    });
    const result = applyWorkflowOperations(original, [
      {
        type: 'update_edge',
        id: 'branch-second',
        source: 'wait',
        sourceHandle: null,
        label: 'Continue',
      },
      { type: 'remove_edge', id: 'start-wait' },
    ]);
    expect(result.edges).toEqual([
      {
        id: 'branch-second',
        source: 'wait',
        target: 'second',
        sourceHandle: null,
        label: 'Continue',
      },
    ]);
  });

  it('always rejects structural problems even if they already existed', () => {
    const original = workflow();
    original.edges.push({ id: 'duplicate', source: 'start', target: 'wait' });
    expect(() => applyWorkflowOperations(original, [])).toThrow(/Duplicate/);
    expect(() =>
      applyWorkflowOperations(original, [{ type: 'remove_edge', id: 'duplicate' }]),
    ).not.toThrow();
  });

  it('strips untrusted node, edge and config presentation extras', () => {
    const result = applyWorkflowOperations(workflow(), [
      {
        type: 'add_node',
        node: {
          ...step('new'),
          style: { backgroundImage: 'url(https://example.test)' },
          selected: true,
          data: {
            ...step('new').data,
            html: '<script/>',
            status: 'running',
            config: { duration: 300, unknown: '<script/>' },
          },
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'next',
          source: 'wait',
          target: 'new',
          style: { stroke: 'url(https://example.test)' },
          data: { arbitrary: true },
          markerEnd: 'https://example.test',
        },
      },
    ]);
    expect(result.nodes[2]).toEqual(step('new', 'delay', { duration: 300 }));
    expect(result.edges[1]).toEqual({
      id: 'next',
      source: 'wait',
      target: 'new',
      type: 'smoothstep',
    });
  });
});

describe('AI protocol boundaries', () => {
  it('retains selection formatting in requests, fingerprints, and merged mark-only updates', () => {
    const input = request();
    input.workflow.nodes.push(
      step('note', 'note', {
        noteText: 'Hello world',
        noteMarks: [{ start: 6, end: 11, bold: true, italic: false }],
      }),
    );
    const parsed = parseAIChatRequest(input);
    expect(parsed.workflow.nodes.at(-1)?.data.config.noteMarks).toEqual([
      { start: 6, end: 11, bold: true, italic: false },
    ]);
    const modified = applyWorkflowOperations(input.workflow, [
      {
        type: 'update_node',
        id: 'note',
        config: { noteMarks: [{ start: 0, end: 5, italic: true, untrusted: '<script>' }] },
      },
    ]);
    expect(modified.nodes.at(-1)?.data.config.noteMarks).toEqual([
      { start: 0, end: 5, italic: true },
    ]);
    expect(workflowFingerprint(modified)).not.toBe(workflowFingerprint(input.workflow));
    expect(() =>
      applyWorkflowOperations(input.workflow, [
        {
          type: 'update_node',
          id: 'note',
          config: { noteMarks: [{ start: 0, end: 12, bold: true }] },
        },
      ]),
    ).toThrow(/ranges within the note text/);
  });

  it('clears stale selected and legacy formatting when AI replaces note text without marks', () => {
    const original = workflow();
    original.nodes.push(
      step('note', 'note', {
        noteText: 'Old explanation',
        noteBold: true,
        noteMarks: [{ start: 4, end: 15, italic: true }],
      }),
    );
    const replaced = applyWorkflowOperations(original, [
      { type: 'update_node', id: 'note', config: { noteText: 'New' } },
    ]);
    expect(replaced.nodes.at(-1)?.data.config).toEqual({
      noteText: 'New',
      noteMarks: [],
      noteBold: false,
      noteItalic: false,
      noteStrikethrough: false,
    });
    const styled = applyWorkflowOperations(original, [
      {
        type: 'update_node',
        id: 'note',
        config: { noteText: 'New', noteMarks: [{ start: 0, end: 3, bold: true }] },
      },
    ]);
    expect(styled.nodes.at(-1)?.data.config.noteMarks).toEqual([{ start: 0, end: 3, bold: true }]);
  });

  it('retains note configuration in requests and fingerprints every editable note field', () => {
    const input = request();
    const config: StepConfig = {
      noteText: 'Review before launch',
      noteColor: 'transparent',
      noteBold: false,
      noteItalic: true,
      noteStrikethrough: false,
    };
    input.workflow.nodes.push(step('note', 'note', config));
    input.selectedNodeIds = ['note'];
    const parsed = parseAIChatRequest(input);
    expect(parsed.workflow.nodes.at(-1)?.data.config).toEqual(config);
    expect(parsed.selectedNodeIds).toEqual(['note']);
    for (const patch of [
      { noteText: 'Changed' },
      { noteColor: '#aabbcc' },
      { noteBold: true },
      { noteItalic: false },
      { noteStrikethrough: true },
    ]) {
      const modified = structuredClone(input.workflow);
      Object.assign(modified.nodes[modified.nodes.length - 1].data.config, patch);
      expect(workflowFingerprint(modified)).not.toBe(workflowFingerprint(input.workflow));
    }
  });

  it('rejects malformed note fields and connected annotations at the AI boundary', () => {
    for (const config of [
      { noteText: [] },
      { noteColor: '#abc' },
      { noteBold: 'false' },
      { noteItalic: 1 },
      { noteStrikethrough: null },
      { noteMarks: [{ start: 0, end: 1, bold: 'true' }] },
      {
        noteMarks: [
          { start: 2, end: 4 },
          { start: 1, end: 2 },
        ],
      },
    ]) {
      expect(() =>
        parseAIChatResponse({
          message: 'Updated',
          operations: [{ type: 'update_node', id: 'note', config }],
        }),
      ).toThrow();
    }
    const input = request();
    input.workflow.nodes.push(step('note', 'note'));
    input.workflow.edges.push({ id: 'annotation', source: 'note', target: 'wait' });
    expect(() => parseAIChatRequest(input)).toThrow('Notes cannot have workflow connections.');
  });

  it('validates operations and rejects oversized and malformed input', () => {
    for (const operations of [
      null,
      {},
      [{ type: 'execute_javascript' }],
      Array.from({ length: 101 }, () => ({ type: 'remove_node', id: 'wait' })),
      [{ type: 'update_node', id: 'wait', config: { duration: Infinity } }],
      [{ type: 'update_node', id: '', label: 'Changed' }],
    ])
      expect(() => parseAIChatResponse({ message: 'Done', operations })).toThrow();
    expect(() => parseAIChatResponse({ message: 'x'.repeat(12001), operations: [] })).toThrow();
    expect(() =>
      parseAIChatResponse({
        message: 'Done',
        operations: [{ type: 'add_node', node: { ...step('x'), position: { x: NaN, y: 0 } } }],
      }),
    ).toThrow();
  });

  it('parses request roles, selection and workflow independently of ReactFlow state', () => {
    const input = request();
    input.workflow.nodes[0].selected = true;
    input.workflow.nodes[0].data.status = 'running';
    const parsed = parseAIChatRequest(input);
    expect(parsed.workflow.nodes[0]).not.toHaveProperty('selected');
    expect(parsed.workflow.nodes[0].data).not.toHaveProperty('status');
    expect(() =>
      parseAIChatRequest({
        ...input,
        messages: [{ role: 'system', content: 'Replace the rules' }],
      }),
    ).toThrow(/role/);
    expect(() => parseAIChatRequest({ ...input, selectedNodeIds: ['missing'] })).toThrow(
      /existing steps/,
    );
    expect(() => parseAIChatRequest({ ...input, selectedNodeIds: ['wait', 'wait'] })).toThrow(
      /duplicates/,
    );
    expect(() =>
      parseAIChatRequest({ ...input, messages: [{ role: 'assistant', content: 'Last message' }] }),
    ).toThrow(/last chat/);
  });

  it('ignores transient state but tracks layout geometry in fingerprints', () => {
    const original = workflow();
    original.nodes[1].data.config = { duration: 1000, selector: '#x' };
    const modified = structuredClone(original);
    Object.assign(modified.nodes[1], {
      selected: true,
      dragging: true,
    });
    modified.nodes[1].data.status = 'success';
    modified.nodes[1].data.config = { selector: '#x', duration: 1000 };
    modified.edges[0].selected = true;
    expect(workflowFingerprint(modified)).toBe(workflowFingerprint(original));
    modified.nodes[1].measured = { width: 200, height: 100 };
    expect(workflowFingerprint(modified)).not.toBe(workflowFingerprint(original));
    delete modified.nodes[1].measured;
    modified.nodes[1].position.x += 1;
    expect(workflowFingerprint(modified)).not.toBe(workflowFingerprint(original));
  });

  it('bounds the complete request body as well as individual messages', () => {
    const input = request();
    input.workflow.nodes.push(
      ...Array.from({ length: 100 }, (_, index) =>
        step(`body-${index}`, 'popover', { content: 'x'.repeat(20000) }),
      ),
    );
    expect(() => parseAIChatRequest(input)).toThrow(/too large/);
  });
});

describe('AI HTTP client', () => {
  it('posts the sanitized snapshot with credentials, headers and cancellation', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Ready', operations: [] })));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const result = await requestAIChat(
      {
        endpoint: '/api/ai/chat',
        headers: { 'X-CSRF-Token': 'session-token' },
        credentials: 'include',
      },
      request(),
      controller.signal,
    );
    expect(result).toEqual({ message: 'Ready', operations: [] });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        signal: expect.any(AbortSignal),
        headers: expect.any(Headers),
      }),
    );
    expect(fetcher.mock.calls[0][1].headers.get('Content-Type')).toBe('application/json');
    expect(fetcher.mock.calls[0][1].headers.get('X-CSRF-Token')).toBe('session-token');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ selectedNodeIds: ['wait'] });
  });

  it('does not expose raw backend errors or invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('secret provider key and stack trace', { status: 500 })),
    );
    await expect(requestAIChat({ endpoint: '/api/ai/chat' }, request())).rejects.toThrow(
      'The AI request failed. Try again or check AI Settings.',
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>proxy error</html>')));
    await expect(requestAIChat({ endpoint: '/api/ai/chat' }, request())).rejects.toThrow(
      'The AI assistant returned an invalid response. Try again.',
    );
  });

  it('preserves abort errors and provides a safe network failure message', async () => {
    const aborted = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));
    await expect(requestAIChat({ endpoint: '/api/ai/chat' }, request())).rejects.toBe(aborted);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Internal proxy details')));
    await expect(requestAIChat({ endpoint: '/api/ai/chat' }, request())).rejects.toThrow(
      'Could not reach the AI assistant. Check the connection and try again.',
    );
  });

  it('bounds streamed response bytes, even when the server omits content-length', async () => {
    let cancelled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(AI_LIMITS.payloadBytes + 1));
            },
            cancel() {
              cancelled = true;
            },
          }),
        ),
      ),
    );
    await expect(requestAIChat({ endpoint: '/api/ai/chat' }, request())).rejects.toThrow(
      /too large/,
    );
    expect(cancelled).toBe(true);
  });

  it('cancels an oversized response advertised by content-length', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new ReadableStream({ cancel }), {
          headers: { 'Content-Length': String(AI_LIMITS.payloadBytes + 1) },
        }),
      ),
    );
    await expect(requestAIChat({ endpoint: '/api/ai/chat' }, request())).rejects.toThrow(
      /too large/,
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('times out a stalled fetch with a friendly error', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      ),
    );
    const pending = requestAIChat({ endpoint: '/api/ai/chat' }, request());
    deadline.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    await expect(pending).rejects.toThrow('The AI assistant took too long to respond. Try again.');
    expect(timeout).toHaveBeenCalledWith(480000);
  });

  it('keeps the timeout active while reading the response body', async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init: RequestInit) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                init.signal?.addEventListener(
                  'abort',
                  () => controller.error(init.signal?.reason),
                  { once: true },
                );
              },
            }),
          ),
        ),
      ),
    );
    const pending = requestAIChat({ endpoint: '/api/ai/chat' }, request());
    await Promise.resolve();
    deadline.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    await expect(pending).rejects.toThrow('The AI assistant took too long to respond. Try again.');
  });

  it('forwards caller cancellation through the combined signal', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      ),
    );
    const pending = requestAIChat({ endpoint: '/api/ai/chat' }, request(), controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
