// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/app/api/ai/chat/route';
import { runLocalAgent, runRemoteAgent } from '../../src/server/ai/agent';
import { graph } from '../../src/server/ai/graph';
import { createWorkflowTools } from '../../src/server/ai/tools';
import type { AIChatRequest, AIChatResponse } from '../../src/server/ai/workflow/ai';

const input: AIChatRequest = {
  messages: [{ role: 'user', content: 'Add a short delay after the page loads.' }],
  selectedNodeIds: ['start'],
  workflow: {
    version: 1,
    name: 'Test journey',
    websiteUrl: '/demo-site.html',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: {
          kind: 'trigger',
          label: 'Page loads',
          config: { event: 'page-load' },
        },
      },
    ],
    edges: [],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('LangChain workflow tools', () => {
  it('edits selected note text with ranges and clears stale marks on text replacement', async () => {
    const toolkit = createWorkflowTools(input.workflow, []);
    const add = toolkit.tools.find((item) => item.name === 'add_node')!;
    const added = JSON.parse(
      await add.invoke({
        kind: 'note',
        config: {
          noteText: 'Read this note',
          noteMarks: [{ start: 5, end: 9, bold: true }],
        },
      }),
    );
    expect(added.ok).toBe(true);
    const id = added.operation.node.id;
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    const mark = { start: 10, end: 14, italic: true, strikethrough: true };
    expect(JSON.parse(await update.invoke({ id, config: { noteMarks: [mark] } })).ok).toBe(true);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config.noteMarks).toEqual([mark]);
    expect(
      JSON.parse(
        await update.invoke({
          id,
          config: { noteMarks: [{ start: 0, end: 50, bold: true }] },
        }),
      ).ok,
    ).toBe(false);
    expect(JSON.parse(await update.invoke({ id, config: { noteText: 'New' } })).ok).toBe(true);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config.noteMarks).toEqual([]);
    expect(toolkit.getOperations()).toHaveLength(3);
  });

  it('creates and updates notes without connecting them to the workflow', async () => {
    const toolkit = createWorkflowTools(input.workflow, []);
    const catalog = toolkit.tools.find((item) => item.name === 'read_node_catalog')!;
    expect(JSON.parse(await catalog.invoke({}))).toContainEqual(
      expect.objectContaining({
        kind: 'note',
        defaults: expect.objectContaining({ noteColor: '#fff4b8' }),
      }),
    );
    const add = toolkit.tools.find((item) => item.name === 'add_node')!;
    const added = JSON.parse(
      await add.invoke({ kind: 'note', config: { noteText: 'Review this' } }),
    );
    expect(added.ok).toBe(true);
    const noteId = added.operation.node.id;
    const update = toolkit.tools.find((item) => item.name === 'update_node')!;
    const changed = JSON.parse(
      await update.invoke({
        id: noteId,
        config: {
          noteColor: 'transparent',
          noteBold: true,
          noteItalic: true,
          noteStrikethrough: false,
        },
      }),
    );
    expect(changed.ok).toBe(true);
    expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toEqual({
      noteText: 'Review this',
      noteColor: 'transparent',
      noteMarks: [],
      noteBold: true,
      noteItalic: true,
      noteStrikethrough: false,
    });
    const connect = toolkit.tools.find((item) => item.name === 'add_connection')!;
    const connection = JSON.parse(await connect.invoke({ source: 'start', target: noteId }));
    expect(connection).toEqual({
      ok: false,
      error: 'Notes cannot have workflow connections.',
    });
    expect(toolkit.getOperations()).toHaveLength(2);
    expect(toolkit.getWorkflow().edges).toEqual([]);
  });

  it.each([
    ['route', 'gpt-4.1-mini'],
    ['route', 'gpt-6-luna'],
    ['browser', 'browser-model'],
    ['graph', 'gpt-6-luna'],
  ])(
    'completes the local %s with %s through the Responses API tool loop',
    async (entrypoint, model) => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      vi.stubEnv('OPENAI_MODEL', model);
      vi.stubEnv('LANGSMITH_TRACING', 'false');
      vi.stubEnv('LANGGRAPH_API_URL', '');
      let step = 0;
      const provider = vi.fn().mockImplementation((_url: unknown, init: RequestInit) => {
        expect(String(_url)).toBe('https://api.openai.com/v1/responses');
        const body = JSON.parse(String(init.body));
        expect(body.model).toBe(model);
        const current = step++;
        let name = 'read_workflow';
        let args: Record<string, unknown> = {};
        if (current === 1) {
          name = 'add_node';
          args = {
            kind: 'delay',
            label: 'Short pause',
            config: { duration: 2000 },
          };
        }
        if (current === 2) {
          const nodeResult = body.input
            .filter((item: { type: string }) => item.type === 'function_call_output')
            .at(-1);
          name = 'add_connection';
          args = {
            source: 'start',
            target: JSON.parse(nodeResult.output).operation.node.id,
          };
        }
        const output =
          current < 3
            ? [
                {
                  type: 'function_call',
                  id: `fc-${current}`,
                  call_id: `call-${current}`,
                  name,
                  arguments: JSON.stringify(args),
                  status: 'completed',
                },
              ]
            : [
                {
                  type: 'message',
                  id: 'msg-final',
                  role: 'assistant',
                  status: 'completed',
                  content: [
                    {
                      type: 'output_text',
                      text: 'Added and connected a 2-second delay.',
                      annotations: [],
                    },
                  ],
                },
              ];
        return Promise.resolve(
          Response.json({
            id: `resp-${current}`,
            object: 'response',
            created_at: 1,
            status: 'completed',
            model,
            output,
            usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
          }),
        );
      });
      vi.stubGlobal('fetch', provider);
      let result: AIChatResponse;
      if (entrypoint === 'browser') {
        result = await runLocalAgent(input, new AbortController().signal, {
          apiKey: 'browser-test-key',
          model,
          origin: 'https://builder.test',
        });
      } else if (entrypoint === 'route') {
        const response = await POST(
          new Request('http://localhost:3000/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
            body: JSON.stringify(input),
          }),
        );
        expect(response.status).toBe(200);
        result = await response.json();
      } else {
        result = (await graph.invoke({ request: input })).response;
      }
      expect(result.message).toBe('Added and connected a 2-second delay.');
      expect(result.operations).toHaveLength(2);
      expect(result.operations[0]).toMatchObject({
        type: 'add_node',
        node: { data: { kind: 'delay', config: { duration: 2000 } } },
      });
      expect(result.operations[1]).toMatchObject({
        type: 'add_edge',
        edge: { source: 'start' },
      });
      expect(input.workflow.nodes).toHaveLength(1);
      expect(provider).toHaveBeenCalledTimes(4);
    },
  );

  it('stages an edit and connection in a private draft, isolated across requests', async () => {
    const first = createWorkflowTools(input.workflow, ['start']);
    const second = createWorkflowTools(input.workflow, []);
    const add = first.tools.find((item) => item.name === 'add_node')!;
    const result = JSON.parse(
      await add.invoke({
        kind: 'delay',
        label: 'Wait briefly',
        config: { duration: 750 },
      }),
    );
    expect(result.ok).toBe(true);
    const connect = first.tools.find((item) => item.name === 'add_connection')!;
    const edge = JSON.parse(
      await connect.invoke({
        source: 'start',
        target: result.operation.node.id,
      }),
    );
    expect(edge.ok).toBe(true);
    expect(first.getWorkflow().nodes.at(-1)?.data.config.duration).toBe(750);
    expect(first.getOperations()).toHaveLength(2);
    expect(second.getWorkflow()).toEqual(input.workflow);
    expect(input.workflow.nodes).toHaveLength(1);
  });

  it('rejects invalid tool mutations without recording or partially applying them', async () => {
    const toolkit = createWorkflowTools(input.workflow, []);
    const tool = toolkit.tools.find((item) => item.name === 'add_connection')!;
    const result = JSON.parse(await tool.invoke({ source: 'start', target: 'missing' }));
    expect(result.ok).toBe(false);
    expect(toolkit.getOperations()).toEqual([]);
    expect(toolkit.getWorkflow()).toEqual(input.workflow);
  });

  it('reports missing model configuration before making a provider call', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(runLocalAgent(input, new AbortController().signal)).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe('LangSmith Deployment proxy', () => {
  it('uses the stateless graph contract and server-only credentials', async () => {
    vi.stubEnv('LANGGRAPH_API_URL', 'https://agent.example.test');
    vi.stubEnv('LANGGRAPH_ASSISTANT_ID', 'workflow_editor');
    vi.stubEnv('LANGSMITH_API_KEY', 'test-server-secret');
    const upstream = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { message: 'Ready.', operations: [] } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', upstream);
    expect(await runRemoteAgent(input, new AbortController().signal)).toEqual({
      message: 'Ready.',
      operations: [],
    });
    const [url, init] = upstream.mock.calls[0];
    expect(String(url)).toBe('https://agent.example.test/runs/wait');
    expect(init.headers['X-Api-Key']).toBe('test-server-secret');
    expect(JSON.parse(init.body)).toEqual({
      assistant_id: 'workflow_editor',
      input: { request: input },
      on_disconnect: 'cancel',
      config: {
        configurable: {
          dxpTelemetry: {
            traceparent: expect.stringMatching(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/),
            'x-dxp-run-id': expect.any(String),
            'x-dxp-workflow-id': expect.any(String),
          },
        },
      },
    });
    expect(JSON.parse(init.body)).not.toHaveProperty('thread_id');
  });

  it('rejects oversized deployment responses before parsing them', async () => {
    vi.stubEnv('LANGGRAPH_API_URL', 'https://agent.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1))),
    );
    await expect(runRemoteAgent(input, new AbortController().signal)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('2 MB'),
    });
  });
});

it('authors ordered Data Transform nodes and flow-only connections through the AI tools', () => {
  const toolkit = createWorkflowTools(input.workflow, []);
  const catalog = JSON.parse(toolkit.invokePrivate('read_node_catalog', {}));
  expect(catalog).toContainEqual(
    expect.objectContaining({ kind: 'transform', defaults: { dataPath: '', transformations: [] } }),
  );
  const config = {
    dataPath: 'user.items[0].name',
    transformations: [
      { type: 'fallback', value: ' Guest ' },
      { type: 'trim' },
      { type: 'uppercase' },
      { type: 'prefix', value: 'Hello ' },
    ],
  };
  const added = JSON.parse(toolkit.invokePrivate('add_node', { kind: 'transform', config }));
  expect(added.ok).toBe(true);
  const transformId = added.operation.node.id;
  expect(toolkit.getWorkflow().nodes.at(-1)?.data.config).toEqual(config);
  const connected = JSON.parse(
    toolkit.invokePrivate('add_connection', { source: 'start', target: transformId }),
  );
  expect(connected.ok).toBe(true);
  expect(toolkit.getWorkflow().edges.at(-1)?.data).toBeUndefined();
  const before = toolkit.getWorkflow();
  expect(
    JSON.parse(
      toolkit.invokePrivate('update_node', {
        id: transformId,
        config: { transformations: [{ type: 'replace', find: '', replacement: 'x' }] },
      }),
    ).ok,
  ).toBe(false);
  expect(toolkit.getWorkflow()).toEqual(before);
});
