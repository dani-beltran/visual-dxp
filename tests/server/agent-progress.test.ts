import { generateText, streamText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyWorkflowOperations as applyClient,
  parseAIChatResponse as parseClient,
  requestAIChat,
} from '../../src/lib/ai';
import { AIServiceError, runLocalAgent } from '../../src/server/ai/agent';
import { graph } from '../../src/server/ai/graph';
import { CHAT_TIMEOUT_MS, handleChat } from '../../src/server/ai/http';
import { reviewWorkflow } from '../../src/server/ai/review';
import * as workflowTools from '../../src/server/ai/tools';
import type { AIChatRequest, AIChatResponse } from '../../src/server/ai/workflow/ai';
import { experimentKeyRequest } from './headline-experiment-fixture';

vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

const config = { apiKey: 'test-private-key', model: 'test-model', origin: 'https://builder.test' };
const scroll = {
  event: 'scroll-thrashing',
  scrollDirectionChanges: 4,
  scrollThrashWindow: 2000,
  scrollMinDistance: 50,
};
function request(): AIChatRequest {
  return {
    messages: [{ role: 'user', content: 'Change the selected step for a scroll trashing' }],
    selectedNodeIds: ['start'],
    workflow: {
      version: 1,
      name: 'Offer',
      websiteUrl: 'https://site.test',
      includeSubpages: false,
      nodes: [
        {
          id: 'start',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'trigger',
            label: 'Start',
            config: {
              event: 'rage-click',
              selector: '#old',
              rageClickCount: 3,
              rageClickWindow: 1000,
              rageClickRadius: 50,
            },
          },
        },
        {
          id: 'offer',
          type: 'workflow',
          position: { x: 300, y: 0 },
          data: {
            kind: 'popover',
            label: 'Offer',
            config: { contentType: 'html', content: '<p>Offer</p>', width: 360 },
          },
        },
      ],
      edges: [{ id: 'edge', type: 'smoothstep', source: 'start', target: 'offer' }],
    },
  };
}
type Call = [name: string, input: unknown];
const read: Call = ['read_workflow', {}];
const edit: Call = ['update_node', { id: 'start', config: scroll }];
let toolkit: ReturnType<typeof workflowTools.createWorkflowTools>;
const createTools = workflowTools.createWorkflowTools;

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.mocked(reviewWorkflow).mockClear();
  vi.mocked(generateText).mockReset();
  vi.mocked(streamText).mockReset();
  vi.spyOn(workflowTools, 'createWorkflowTools').mockImplementation((...args) => {
    toolkit = createTools(...args);
    return toolkit;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function provider(
  calls: (Call | Call[] | (() => Call | Call[]))[],
  streaming: boolean,
  finalText = 'Changed the selected trigger to scroll thrashing.',
) {
  let turn = 0;
  function result() {
    const index = turn++;
    const step = calls[index];
    const call = typeof step === 'function' ? step() : step;
    const batch = call ? (typeof call[0] === 'string' ? [call as Call] : (call as Call[])) : [];
    const toolCalls = batch.map(([toolName, input], offset) => ({
      toolCallId: offset === 0 ? `unique-${index}` : `unique-${index}-${offset}`,
      toolName,
      input,
    }));
    return {
      content: [],
      responseMessages: toolCalls.length
        ? [
            {
              role: 'assistant',
              content: toolCalls.map((tool) => ({ type: 'tool-call', ...tool })),
            },
          ]
        : [],
      text: call ? '' : finalText,
      finishReason: call ? 'tool-calls' : 'stop',
      toolCalls,
    };
  }
  if (streaming)
    vi.mocked(streamText).mockImplementation(() => {
      const output = result();
      return {
        ...output,
        fullStream: (async function* () {
          yield { type: 'finish' };
        })(),
      } as never;
    });
  else vi.mocked(generateText).mockImplementation(async () => result() as never);
  return () => (streaming ? vi.mocked(streamText).mock.calls : vi.mocked(generateText).mock.calls);
}

describe.each([false, true])('agent progress (streaming: %s)', (streaming) => {
  const emit = () => (streaming ? vi.fn() : undefined);

  it('delivers one no-op correction opportunity and then rejects read/update repetition despite new IDs and key ordering', async () => {
    const input = request();
    const before = structuredClone(input);
    const reordered: Call = [
      'update_node',
      {
        config: {
          scrollMinDistance: 50,
          scrollThrashWindow: 2000,
          event: 'scroll-thrashing',
          scrollDirectionChanges: 4,
        },
        id: 'start',
      },
    ];
    const invocations = provider([read, edit, read, reordered, read, edit], streaming);
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      status: 422,
      code: 'repeated_tool_loop',
      message: expect.stringContaining('No workflow changes were applied'),
    });
    expect(invocations()).toHaveLength(6);
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(invocations()[4][0]?.messages).toContainEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'unique-3',
          toolName: 'update_node',
          output: { type: 'text', value: expect.stringContaining('"changed":false') },
        },
      ],
    });
    expect(input).toEqual(before);
  });

  it('finishes a correct edit after reading again and replays exactly the server draft', async () => {
    const input = request();
    provider([read, edit, read], streaming);
    const response = await runLocalAgent(input, new AbortController().signal, config, emit());
    expect(response.operations).toEqual([{ type: 'update_node', id: 'start', config: scroll }]);
    expect(response.message).toBe('Changed the selected trigger to scroll thrashing.');
    expect(
      applyClient(input.workflow, parseClient(JSON.parse(JSON.stringify(response))).operations),
    ).toEqual(toolkit.getWorkflow());
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('allows a no-op followed by a final summary and resets repetition detection after actual intervening edits', async () => {
    const input = request();
    const different: Call = ['update_node', { id: 'start', config: { scrollMinDistance: 75 } }];
    const invocations = provider([read, edit, read, edit, different, edit, read, edit], streaming);
    const response = await runLocalAgent(input, new AbortController().signal, config, emit());
    expect(response.operations).toHaveLength(3);
    expect(toolkit.getWorkflow().nodes[0].data.config).toEqual(scroll);
    expect(invocations()).toHaveLength(9);
  });

  it('rejects completion after a recoverable error and discards earlier staged edits', async () => {
    const input = request();
    const invocations = provider(
      [
        read,
        edit,
        ['update_node', { id: 'start', config: { iterations: 3, content: 'private payload' } }],
      ],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      status: 422,
      code: 'invalid_workflow_edit',
      message: expect.stringContaining('No workflow changes were applied'),
    });
    expect(invocations()).toHaveLength(4);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  const invalidConnection: Call = ['update_connection', { id: 'edge', sourceHandle: 'true' }];
  const correctedConnection: Call = ['update_connection', { id: 'edge', sourceHandle: null }];

  function outputs(invocations: ReturnType<ReturnType<typeof provider>>) {
    return invocations
      .at(-1)?.[0]
      ?.messages?.flatMap((message) => (message.role === 'tool' ? message.content : []));
  }

  it.each([false, true])(
    'corrects fork-only fields on an experiment without recreating nodes (repeat rejection: %s)',
    async (repeat) => {
      const input = experimentKeyRequest();
      const before = structuredClone(input);
      const id = input.selectedNodeIds[0];
      const invalid: Call = [
        'update_node',
        { id, config: { experimentSplit: 50, conditionType: 'selector', condition: 'h1' } },
      ];
      const reordered: Call = [
        'update_node',
        { config: { condition: 'h1', conditionType: 'selector', experimentSplit: 50 }, id },
      ];
      const corrected: Call = [
        'update_node',
        { id, config: { experimentKey: 'headline-test-v1' } },
      ];
      const invocations = provider(
        repeat ? [read, invalid, read, reordered, corrected] : [read, invalid, corrected],
        streaming,
      );
      const response = await runLocalAgent(input, new AbortController().signal, config, emit());
      expect(response.operations).toEqual([
        { type: 'update_node', id, config: { experimentKey: 'headline-test-v1' } },
      ]);
      const results = outputs(invocations()) ?? [];
      const failures = results
        .filter((item) => item.type === 'tool-result')
        .map((item) => JSON.parse((item.output as { value: string }).value))
        .filter((item) => item.ok === false);
      expect(failures).toHaveLength(repeat ? 2 : 1);
      expect(failures[0]).toMatchObject({
        details: { kind: 'experiment', invalidFields: ['condition', 'conditionType'] },
      });
      if (repeat)
        expect(failures[1]).toMatchObject({
          repeatedRejectedCall: true,
          rejectedAttempts: 2,
          repairHint: expect.stringContaining('already rejected'),
        });
      const expected = structuredClone(input.workflow);
      const experiment = expected.nodes.find((node) => node.id === id);
      if (!experiment) throw new Error('Missing fixture experiment');
      experiment.data.config.experimentKey = 'headline-test-v1';
      expect(applyClient(input.workflow, response.operations)).toEqual(expected);
      expect(toolkit.getWorkflow()).toEqual(expected);
      expect(input).toEqual(before);
    },
  );

  it('discards staged edits when repeated invalid experiment patches exhaust the correction budget', async () => {
    const input = experimentKeyRequest();
    const before = structuredClone(input);
    const id = input.selectedNodeIds[0];
    const invalid: Call = [
      'update_node',
      { id, config: { conditionType: 'selector', condition: 'h1' } },
    ];
    const invocations = provider(
      [read, ['update_node', { id, label: 'Staged only' }], invalid, read, invalid, invalid],
      streaming,
    );
    const ready = vi.fn();
    await expect(
      runLocalAgent(
        input,
        new AbortController().signal,
        config,
        emit(),
        undefined,
        streaming ? ready : undefined,
      ),
    ).rejects.toMatchObject({ code: 'invalid_workflow_edit' });
    expect(invocations()).toHaveLength(6);
    expect(ready).not.toHaveBeenCalled();
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input).toEqual(before);
  });

  const missingDevice: Call = ['add_node', { kind: 'fork', config: { conditionType: 'device' } }];
  const mobileDevice: Call = [
    'add_node',
    { kind: 'fork', config: { conditionType: 'device', conditionValue: 'mobile' } },
  ];

  it('repairs the mobile workflow from the logs, preserving the trigger and resubmitting skipped edits', async () => {
    const input = request();
    input.messages = [
      { role: 'user', content: 'On #shop-now click, if mobile, set h1 to Vamos amigo!' },
    ];
    input.workflow.nodes = [];
    input.workflow.edges = [];
    input.selectedNodeIds = [];
    const before = structuredClone(input);
    const heading: Call = [
      'add_node',
      { kind: 'dom', config: { selector: 'h1', action: 'text', value: 'Vamos amigo!' } },
    ];
    let triggerId = '';
    const invocations = provider(
      [
        read,
        ['add_node', { kind: 'trigger', config: { event: 'click', selector: '#shop-now' } }],
        [missingDevice, heading],
        () => {
          expect(toolkit.getWorkflow().nodes).toHaveLength(1);
          triggerId = toolkit.getWorkflow().nodes[0].id;
          const results = outputs(invocations()) ?? [];
          const failure = results.find(
            (result) => result.type === 'tool-result' && result.toolCallId === 'unique-2',
          );
          expect(failure).toMatchObject({
            output: { value: expect.stringContaining('config.conditionValue') },
          });
          expect(failure).toMatchObject({
            output: { value: expect.stringContaining('"retryable":true') },
          });
          expect(results).toContainEqual(
            expect.objectContaining({
              toolCallId: 'unique-2-1',
              output: { type: 'text', value: expect.stringContaining('skipped_after_failure') },
            }),
          );
          return [mobileDevice, heading];
        },
        () => {
          const [trigger, fork, dom] = toolkit.getWorkflow().nodes;
          expect(trigger.id).toBe(triggerId);
          return [
            ['add_connection', { source: trigger.id, target: fork.id }],
            ['add_connection', { source: fork.id, target: dom.id, sourceHandle: 'true' }],
          ];
        },
        ...(streaming ? [['finish_workflow', {}] as Call] : []),
      ],
      streaming,
      'Created the mobile workflow.',
    );
    const ready = streaming ? vi.fn() : undefined;
    const response = await runLocalAgent(
      input,
      new AbortController().signal,
      {
        ...config,
        provider: 'local',
        baseURL: 'http://127.0.0.1:5050/v1',
      },
      emit(),
      undefined,
      ready,
    );
    expect(response.operations).toHaveLength(5);
    const workflow = applyClient(input.workflow, response.operations);
    expect(workflow).toEqual(toolkit.getWorkflow());
    expect(workflow.nodes.map((node) => node.data.kind)).toEqual(['trigger', 'fork', 'dom']);
    expect(workflow.nodes[1].data.config).toEqual({
      conditionType: 'device',
      conditionValue: 'mobile',
    });
    expect(workflow.nodes[2].data.config.value).toBe('Vamos amigo!');
    expect(workflow.edges).toHaveLength(2);
    if (ready) expect(ready).toHaveBeenCalledTimes(1);
    expect(input).toEqual(before);
  });

  it('uses the shared correction budget for semantic, schema and connection errors', async () => {
    const input = request();
    const before = structuredClone(input);
    const invocations = provider(
      [
        read,
        edit,
        missingDevice,
        read,
        mobileDevice,
        ['update_node', { id: 'offer', config: { width: 'wide' } }],
        ['update_node', { id: 'offer', config: { width: 400 } }],
        invalidConnection,
      ],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
    expect(invocations()).toHaveLength(8);
    expect(input).toEqual(before);
  });

  it('stops after two unsuccessful semantic corrections without applying a partial workflow', async () => {
    const input = request();
    const before = structuredClone(input);
    const invocations = provider(
      [read, edit, missingDevice, missingDevice, missingDevice],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
    expect(invocations()).toHaveLength(5);
    expect(input).toEqual(before);
  });

  it('does not accept a label-only update as a repair of missing semantic configuration', async () => {
    const input = request();
    const before = structuredClone(input);
    provider(
      [
        read,
        edit,
        ['update_node', { id: 'offer', config: { contentType: 'iframe' } }],
        ['update_node', { id: 'offer', label: 'Iframe' }],
      ],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
    expect(input).toEqual(before);
  });

  it('does not let an unrelated node creation resolve a failed mobile condition', async () => {
    const input = request();
    const before = structuredClone(input);
    provider(
      [
        read,
        missingDevice,
        ['add_node', { kind: 'dom', config: { selector: 'h1', value: 'Vamos amigo!' } }],
      ],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
    expect(input).toEqual(before);
  });

  it('corrects a connection without recreating successful nodes or changing generated IDs', async () => {
    const input = request();
    input.workflow.nodes = [];
    input.workflow.edges = [];
    const before = structuredClone(input);
    let source = '';
    let target = '';
    const invocations = provider(
      [
        read,
        [
          ['add_node', { kind: 'trigger' }],
          ['add_node', { kind: 'popover', config: { content: '<p>Offer</p>' } }],
        ],
        () => {
          [source, target] = toolkit.getWorkflow().nodes.map((node) => node.id);
          return ['add_connection', { source, target, sourceHandle: 'true' }];
        },
        read,
        () => ['add_connection', { source, target }],
      ],
      streaming,
    );
    const response = await runLocalAgent(input, new AbortController().signal, config, emit());
    expect(response.operations).toHaveLength(3);
    expect(response.operations[2]).toMatchObject({ type: 'add_edge', edge: { source, target } });
    expect(toolkit.getWorkflow().nodes.map((node) => node.id)).toEqual([source, target]);
    expect(applyClient(input.workflow, response.operations)).toEqual(toolkit.getWorkflow());
    expect(outputs(invocations())).toContainEqual(
      expect.objectContaining({
        toolCallId: 'unique-2',
        output: {
          type: 'text',
          value: JSON.stringify({
            ok: false,
            error: 'Trigger nodes have no named output. Omit sourceHandle or set it to null.',
            code: 'invalid_source_handle',
            retryable: true,
          }),
        },
      }),
    );
    expect(input).toEqual(before);
  });

  it('allows exactly two corrections after the initial failed call', async () => {
    const invocations = provider(
      [read, invalidConnection, invalidConnection, correctedConnection],
      streaming,
    );
    const response = await runLocalAgent(request(), new AbortController().signal, config, emit());
    expect(response.operations).toEqual([{ type: 'update_edge', id: 'edge', sourceHandle: null }]);
    expect(invocations()).toHaveLength(5);
  });

  it('exhausts its budget across reads and successful corrections without returning any changes', async () => {
    const input = request();
    const before = structuredClone(input);
    const invocations = provider(
      [
        read,
        edit,
        invalidConnection,
        read,
        correctedConnection,
        invalidConnection,
        ['update_node', { id: 'offer', label: 'New offer' }],
        correctedConnection,
        read,
        invalidConnection,
      ],
      streaming,
    );
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
      message: expect.stringContaining('No workflow changes were applied'),
    });
    expect(invocations()).toHaveLength(10);
    expect(toolkit.getOperations().length).toBeGreaterThan(0);
    expect(input).toEqual(before);
  });

  it('does not let reads or unrelated successful mutations resolve a failed edit', async () => {
    const invocations = provider(
      [
        read,
        invalidConnection,
        read,
        ['update_connection', { id: 'edge', label: 'Unrelated label' }],
        edit,
      ],
      streaming,
    );
    await expect(
      runLocalAgent(request(), new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
    expect(invocations()).toHaveLength(6);
  });

  it('pairs every call with a result and skips dependent calls until the next response', async () => {
    const invocations = provider(
      [
        read,
        [
          read,
          edit,
          invalidConnection,
          ['remove_node', { id: 'offer' }],
          ['read_workflow', {}],
          correctedConnection,
        ],
        () => {
          expect(toolkit.getOperations()).toEqual([
            { type: 'update_node', id: 'start', config: scroll },
          ]);
          expect(toolkit.getWorkflow().nodes).toHaveLength(2);
          return correctedConnection;
        },
      ],
      streaming,
    );
    const response = await runLocalAgent(request(), new AbortController().signal, config, emit());
    expect(response.operations).toHaveLength(2);
    const results = outputs(invocations()) ?? [];
    expect(results).toHaveLength(8);
    for (const index of [3, 4, 5]) {
      expect(results[index + 1]).toMatchObject({
        toolCallId: `unique-1-${index}`,
        output: { type: 'text', value: expect.stringContaining('skipped_after_failure') },
      });
    }
  });

  it('corrects schema and configuration errors using their repair hints', async () => {
    const invocations = provider(
      [
        read,
        ['update_node', { id: 'start', config: { scrollDirectionChanges: 'four' } }],
        ['update_node', { id: 'start', config: { ...scroll, iterations: 3 } }],
        edit,
      ],
      streaming,
    );
    const response = await runLocalAgent(request(), new AbortController().signal, config, emit());
    expect(response.operations).toHaveLength(1);
    const results = outputs(invocations()) ?? [];
    expect(results[1]).toMatchObject({
      output: { value: expect.stringContaining('config.scrollDirectionChanges') },
    });
    expect(results[2]).toMatchObject({
      output: { value: expect.stringContaining('Send only fields supported') },
    });
  });

  it('can repair malformed identity arguments without recreating a successful node', async () => {
    provider(
      [
        read,
        ['add_node', { kind: 'unsupported' }],
        ['add_node', { kind: 'delay', config: { duration: 100 } }],
        ['update_node', { id: null, label: 'Renamed' }],
        ['update_node', { id: 'offer', label: 'Renamed' }],
      ],
      streaming,
    );
    const response = await runLocalAgent(request(), new AbortController().signal, config, emit());
    expect(response.operations).toHaveLength(2);
    expect(toolkit.getWorkflow().nodes).toHaveLength(3);
  });

  it('does not treat an empty configuration patch as resolving a failed edit', async () => {
    provider(
      [
        read,
        ['update_node', { id: 'start', config: { iterations: 3 } }],
        ['update_node', { id: 'start', config: {} }],
      ],
      streaming,
    );
    await expect(
      runLocalAgent(request(), new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
  });

  it('does not mask unsafe provider output after a recoverable tool error', async () => {
    const input = request();
    provider([read, edit, invalidConnection], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation()!;
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) => {
        const result = complete(...args);
        return ++turn === 4
          ? ({ ...result, content: [{ type: 'text', text: config.apiKey }] } as never)
          : result;
      });
    } else {
      const complete = vi.mocked(generateText).getMockImplementation()!;
      let turn = 0;
      vi.mocked(generateText).mockImplementation(async (...args) => {
        const result = await complete(...args);
        return ++turn === 4
          ? ({ ...result, content: [{ type: 'text', text: config.apiKey }] } as never)
          : result;
      });
    }
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({ code: 'provider_failed' });
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('does not retry an internal tool exception after a recoverable error', async () => {
    const invocations = provider(
      [
        read,
        edit,
        invalidConnection,
        () => {
          vi.spyOn(toolkit, 'invokePrivate').mockImplementation(() => {
            throw new Error('Internal failure');
          });
          return correctedConnection;
        },
      ],
      streaming,
    );
    await expect(
      runLocalAgent(request(), new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({ code: 'provider_failed' });
    expect(invocations()).toHaveLength(4);
  });

  it('keeps unclassified tool failures fatal without spending a correction turn', async () => {
    const invocations = provider([read, edit, ['remove_node', { id: 'missing' }]], streaming);
    await expect(
      runLocalAgent(request(), new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({
      code: 'invalid_workflow_edit',
    });
    expect(invocations()).toHaveLength(3);
  });

  it('keeps staged operations private when final output is empty', async () => {
    const input = request();
    provider([read, edit], streaming, '');
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({ code: 'provider_failed' });
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('discards staged edits if the subsequent provider turn is interrupted', async () => {
    const input = request();
    provider([read, edit, invalidConnection], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked streaming provider.');
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) =>
        ++turn < 4
          ? complete(...args)
          : ({
              fullStream: (async function* () {
                yield { type: 'text-delta', text: 'Unfinished' };
              })(),
            } as never),
      );
    } else {
      const complete = vi.mocked(generateText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked provider.');
      let turn = 0;
      vi.mocked(generateText).mockImplementation(async (...args) =>
        ++turn < 4
          ? complete(...args)
          : ({
              content: [],
              responseMessages: [],
              text: 'Unfinished',
              finishReason: 'length',
              toolCalls: [],
            } as never),
      );
    }
    await expect(
      runLocalAgent(input, new AbortController().signal, config, emit()),
    ).rejects.toMatchObject({ code: 'provider_failed' });
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('preserves cancellation after staging an edit and before accepting a final response', async () => {
    const input = request();
    const controller = new AbortController();
    const cancelled = new DOMException('Cancelled', 'AbortError');
    provider([read, edit, invalidConnection], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked streaming provider.');
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) => {
        if (++turn === 4) controller.abort(cancelled);
        return complete(...args);
      });
    } else {
      const complete = vi.mocked(generateText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked provider.');
      let turn = 0;
      vi.mocked(generateText).mockImplementation((...args) => {
        if (++turn === 4) controller.abort(cancelled);
        return complete(...args);
      });
    }
    await expect(runLocalAgent(input, controller.signal, config, emit())).rejects.toBe(cancelled);
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
  });

  it('returns no operations when the HTTP deadline expires after staging, even if the provider ignores cancellation', async () => {
    vi.useFakeTimers();
    const input = request();
    let stalled!: () => void;
    const pending = new Promise<void>((resolve) => {
      stalled = resolve;
    });
    provider([read, edit, invalidConnection], streaming);
    if (streaming) {
      const complete = vi.mocked(streamText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked streaming provider.');
      let turn = 0;
      vi.mocked(streamText).mockImplementation((...args) =>
        ++turn < 4
          ? complete(...args)
          : ({
              fullStream: (async function* () {
                stalled();
                await new Promise(() => {});
              })(),
            } as never),
      );
    } else {
      const complete = vi.mocked(generateText).getMockImplementation();
      if (!complete) throw new Error('Expected a mocked provider.');
      let turn = 0;
      vi.mocked(generateText).mockImplementation((...args) => {
        if (++turn < 4) return complete(...args);
        stalled();
        return new Promise(() => {});
      });
    }
    const response = handleChat(
      new Request('https://builder.test/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DXP-AI-Override': 'browser',
          'X-DXP-OpenAI-Key': config.apiKey,
          'X-DXP-OpenAI-Model': config.model,
          Accept: streaming ? 'application/x-ndjson' : 'application/json',
        },
        body: JSON.stringify(input),
      }),
    );
    await pending;
    await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS);
    const completed = await response;
    const body = await completed.text();
    expect(body).not.toContain('operations');
    if (streaming) expect(JSON.parse(body).type).toBe('error');
    else expect(completed.status).toBe(504);
    expect(toolkit.getOperations()).toHaveLength(1);
    expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['invalid_workflow_edit', 'repeated_tool_loop'])(
    'reports sanitized %s through HTTP and the browser client without a result event',
    async (code) => {
      const input = request();
      const calls =
        code === 'invalid_workflow_edit'
          ? [
              read,
              edit,
              [
                'update_node',
                { id: 'start', config: { iterations: 3, content: 'private provider payload' } },
              ] as Call,
              read,
              invalidConnection,
              read,
              invalidConnection,
            ]
          : [read, edit, read, edit, read, edit];
      provider(calls, streaming);
      const response = await handleChat(
        new Request('https://builder.test/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DXP-AI-Override': 'browser',
            'X-DXP-OpenAI-Key': config.apiKey,
            'X-DXP-OpenAI-Model': config.model,
            Accept: streaming ? 'application/x-ndjson' : 'application/json',
          },
          body: JSON.stringify(input),
        }),
      );
      const body = await response.text();
      const failure = JSON.parse(body.trim());
      expect(failure.code).toBe(code);
      expect(failure.error).toContain('No workflow changes were applied');
      expect(body).not.toContain(config.apiKey);
      expect(body).not.toContain('private provider payload');
      expect(body).not.toContain('operations');
      if (streaming) expect(failure.type).toBe('error');
      else expect(response.status).toBe(422);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(body, { status: response.status, headers: response.headers }),
          ),
      );
      await expect(
        requestAIChat(
          { endpoint: 'https://builder.test/api/ai/chat' },
          input,
          undefined,
          config,
          emit(),
        ),
      ).rejects.toMatchObject({ code, message: failure.error });
      expect(input.workflow.nodes[0].data.config.event).toBe('rage-click');
    },
  );

  it('uses fixed messages for recognized failure codes even if an upstream supplies unsafe details', async () => {
    const input = request();
    const response = await handleChat(
      new Request('https://builder.test/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: streaming ? 'application/x-ndjson' : 'application/json',
        },
        body: JSON.stringify(input),
      }),
      async () => {
        throw new AIServiceError(422, 'private payload and credentials', 'repeated_tool_loop');
      },
    );
    const body = await response.text();
    expect(body).toContain('repeated_tool_loop');
    expect(body).not.toContain('private payload');
    expect(body).toContain('No workflow changes were applied');
    const unsafe = streaming
      ? `${JSON.stringify({
          type: 'error',
          code: 'repeated_tool_loop',
          error: 'raw internal exception',
        })}\n`
      : JSON.stringify({ code: 'repeated_tool_loop', error: 'raw internal exception' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(unsafe, {
          status: streaming ? 200 : 422,
          headers: { 'Content-Type': streaming ? 'application/x-ndjson' : 'application/json' },
        }),
      ),
    );
    await expect(
      requestAIChat(
        { endpoint: 'https://builder.test/api/ai/chat' },
        input,
        undefined,
        config,
        emit(),
      ),
    ).rejects.toMatchObject({
      code: 'repeated_tool_loop',
      message: expect.stringContaining('No workflow changes were applied'),
    });
  });
});

it('commits a reviewed batch without another editor generation', async () => {
  const calls = provider(
    [read, ['update_node', { id: 'offer', label: 'Updated offer' }], ['finish_workflow', {}]],
    true,
  );
  const ready = vi.fn();
  const result = await runLocalAgent(
    request(),
    new AbortController().signal,
    config,
    vi.fn(),
    undefined,
    ready,
  );
  expect(ready).toHaveBeenCalledTimes(1);
  expect(ready.mock.calls[0][0].operations).toEqual(result.operations);
  expect(result.operations).toHaveLength(1);
  expect(calls()).toHaveLength(3);
});

it('does not commit while a failed edit remains unresolved', async () => {
  provider(
    [
      read,
      ['update_node', { id: 'start', config: { event: 'not-an-event' } }],
      ['finish_workflow', {}],
    ],
    true,
  );
  const ready = vi.fn();
  await expect(
    runLocalAgent(request(), new AbortController().signal, config, vi.fn(), undefined, ready),
  ).rejects.toThrow();
  expect(ready).not.toHaveBeenCalled();
});

it.each(['first', 'last'])(
  'accepts finish_workflow %s in the same provider batch as the final edit',
  async (position) => {
    const edit: Call = ['update_node', { id: 'offer', label: 'Updated offer' }];
    const finish: Call = ['finish_workflow', {}];
    provider([read, position === 'first' ? [finish, edit] : [edit, finish]], true);
    const ready = vi.fn();
    const result = await runLocalAgent(
      request(),
      new AbortController().signal,
      config,
      vi.fn(),
      undefined,
      ready,
    );
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0][0].operations).toEqual(result.operations);
    expect(result.operations).toHaveLength(1);
  },
);

it('keeps the batch private when an edit after finish_workflow fails, then permits correction', async () => {
  provider(
    [
      read,
      [
        ['finish_workflow', {}],
        ['update_node', { id: 'start', config: { event: 'not-an-event' } }],
      ],
      ['update_node', { id: 'start', config: scroll }],
      ['finish_workflow', {}],
    ],
    true,
  );
  const ready = vi.fn();
  const implementation = vi.mocked(streamText).getMockImplementation();
  if (!implementation) throw new Error('Missing provider mock.');
  let turn = 0;
  vi.mocked(streamText).mockImplementation((...args) => {
    if (++turn <= 3) expect(ready).not.toHaveBeenCalled();
    return implementation(...args);
  });
  const result = await runLocalAgent(
    request(),
    new AbortController().signal,
    config,
    vi.fn(),
    undefined,
    ready,
  );
  expect(ready).toHaveBeenCalledTimes(1);
  expect(ready.mock.calls[0][0].operations).toEqual(result.operations);
  expect(result.operations).toHaveLength(1);
});

it('recovers a local textual finish marker without streaming markup or applying twice', async () => {
  const marker = '<tool_call>\n<function=finish_workflow>\n</function>\n</tool_call>';
  provider(
    [
      ['read_workflow', {}],
      ['update_node', { id: 'offer', label: 'Updated offer' }],
    ],
    true,
    'Updated the offer label.',
  );
  const implementation = vi.mocked(streamText).getMockImplementation();
  if (!implementation) throw new Error('Missing provider mock.');
  let turn = 0;
  vi.mocked(streamText).mockImplementation((...args) => {
    const result = implementation(...args);
    turn++;
    if (turn === 4) {
      expect(args[0].toolChoice).toBe('none');
      expect(args[0].system).not.toContain('call finish_workflow before');
    }
    if (turn !== 3) return result;
    return {
      ...result,
      text: marker,
      responseMessages: [{ role: 'assistant', content: marker }],
      fullStream: (async function* () {
        for (const text of [
          '<too',
          'l_call>\n<function=',
          'finish_workflow>\n</function>\n</tool_call>',
        ])
          yield { type: 'text-delta', text };
        yield { type: 'finish' };
      })(),
    } as never;
  });
  const ready = vi.fn();
  const text = vi.fn();
  const result = await runLocalAgent(
    request(),
    new AbortController().signal,
    {
      ...config,
      provider: 'local',
      baseURL: 'http://127.0.0.1:5050/v1',
    },
    text,
    undefined,
    ready,
  );
  expect(result.message).toBe('Changed the selected trigger to scroll thrashing.');
  expect(result.operations).toHaveLength(1);
  expect(ready).toHaveBeenCalledTimes(1);
  expect(text.mock.calls.flat().join('')).not.toContain('<tool');
});

it('does not interpret a textual mutation as an executable tool call', async () => {
  provider(
    [['read_workflow', {}]],
    true,
    '<tool_call><function=remove_node><parameter=id>start</parameter></function></tool_call>',
  );
  const ready = vi.fn();
  await expect(
    runLocalAgent(
      request(),
      new AbortController().signal,
      {
        ...config,
        provider: 'local',
        baseURL: 'http://127.0.0.1:5050/v1',
      },
      vi.fn(),
      undefined,
      ready,
    ),
  ).rejects.toThrow();
  expect(ready).not.toHaveBeenCalled();
});

it('finishes after the first reviewed textual finish marker', async () => {
  const calls = provider(
    [['read_workflow', {}]],
    true,
    '<tool_call><function=finish_workflow></function></tool_call>',
  );
  const ready = vi.fn();
  await expect(
    runLocalAgent(
      request(),
      new AbortController().signal,
      {
        ...config,
        provider: 'local',
        baseURL: 'http://127.0.0.1:5050/v1',
      },
      vi.fn(),
      undefined,
      ready,
    ),
  ).resolves.toMatchObject({ operations: [] });
  expect(ready).toHaveBeenCalledTimes(1);
  expect(calls()).toHaveLength(2);
});

// Provider/tool-loop tests isolate the independent semantic review call.
vi.mock('../../src/server/ai/review', async (original) => ({
  ...(await original<typeof import('../../src/server/ai/review')>()),
  reviewWorkflow: vi.fn(async () => ({
    summary: 'Changed the selected trigger to scroll thrashing.',
    findings: [],
    question: '',
  })),
}));

describe.each(['openai', 'claude', 'local'] as const)('required read: %s', (selected) => {
  const selectedConfig = {
    ...config,
    provider: selected,
    ...(selected === 'local' ? { baseURL: 'http://127.0.0.1:11434/v1' } : {}),
  };
  describe.each([false, true])('streaming: %s', (streaming) => {
    const emit = () => (streaming ? vi.fn() : undefined);
    it('unlocks edits only after the actual read and preserves review/atomic commitment', async () => {
      const calls = provider([read, edit], streaming);
      const input = request();
      const before = structuredClone(input);
      const response = await runLocalAgent(
        input,
        new AbortController().signal,
        selectedConfig,
        emit(),
      );
      expect(Object.keys(calls()[0][0]?.tools ?? {})).toEqual(['read_workflow']);
      expect(calls()[0][0]?.toolChoice).toBe('required');
      expect(calls()[1][0]?.tools).toHaveProperty('update_node');
      expect(calls()[1][0]?.toolChoice).toBe('auto');
      expect(response.operations).toHaveLength(1);
      expect(reviewWorkflow).toHaveBeenCalledOnce();
      expect(input).toEqual(before);
      expect(calls()).toHaveLength(3);
    });

    it.each([
      ['text completion', []],
      ['finish tool', [['finish_workflow', {}]]],
      ['mutation only', [edit]],
      ['catalog only', [['read_node_catalog', {}]]],
      ['read then mutation', [[read, edit]]],
      ['mutation then read', [[edit, read]]],
      ['read and finish', [[read, ['finish_workflow', {}]]]],
      ['duplicate reads', [[read, read]]],
    ] as [string, (Call | Call[])[]][])(
      'rejects %s before any tool executes',
      async (_name, turns) => {
        const calls = provider(turns, streaming);
        const ready = vi.fn();
        let invoke!: ReturnType<typeof vi.spyOn>;
        vi.spyOn(workflowTools, 'createWorkflowTools').mockImplementation((...args) => {
          toolkit = createTools(...args);
          invoke = vi.spyOn(toolkit, 'invokePrivate');
          return toolkit;
        });
        await expect(
          runLocalAgent(
            request(),
            new AbortController().signal,
            selectedConfig,
            emit(),
            undefined,
            streaming ? ready : undefined,
          ),
        ).rejects.toMatchObject({ status: 422 });
        expect(invoke).not.toHaveBeenCalled();
        expect(toolkit.getOperations()).toEqual([]);
        expect(ready).not.toHaveBeenCalled();
        expect(reviewWorkflow).not.toHaveBeenCalled();
        expect(calls()).toHaveLength(1);
      },
    );

    it.each(['text', 'finish', 'edit'] as const)(
      'does not unlock %s after malformed read arguments',
      async (next) => {
        const calls = provider(
          [
            ['read_workflow', null],
            ...(next === 'text'
              ? []
              : [next === 'edit' ? edit : (['finish_workflow', {}] as Call)]),
          ],
          streaming,
        );
        const ready = vi.fn();
        await expect(
          runLocalAgent(
            request(),
            new AbortController().signal,
            selectedConfig,
            emit(),
            undefined,
            streaming ? ready : undefined,
          ),
        ).rejects.toMatchObject({ status: 422 });
        for (const [options] of calls()) {
          expect(Object.keys(options?.tools ?? {})).toEqual(['read_workflow']);
          expect(options?.toolChoice).toBe('required');
        }
        expect(toolkit.getOperations()).toEqual([]);
        expect(ready).not.toHaveBeenCalled();
        expect(reviewWorkflow).not.toHaveBeenCalled();
      },
    );

    it.each(['{}', '{"ok":true}', '{"ok":false}', '{"workflow":{}}', 'null', 'not JSON', 'throw'])(
      'rejects failed or malformed read output %s',
      async (output) => {
        const calls = provider(
          [
            () => {
              vi.spyOn(toolkit, 'invokePrivate').mockImplementation(() => {
                if (output === 'throw') throw new Error('Read failed');
                return output;
              });
              return read;
            },
            edit,
          ],
          streaming,
        );
        await expect(
          runLocalAgent(request(), new AbortController().signal, selectedConfig, emit()),
        ).rejects.toMatchObject({ status: 422 });
        expect(calls()).toHaveLength(1);
        expect(toolkit.getOperations()).toEqual([]);
        expect(reviewWorkflow).not.toHaveBeenCalled();
      },
    );

    it('allows a corrected read within the existing argument repair budget', async () => {
      const calls = provider([['read_workflow', null], read, edit], streaming);
      const response = await runLocalAgent(
        request(),
        new AbortController().signal,
        selectedConfig,
        emit(),
      );
      expect(calls()[1][0]?.toolChoice).toBe('required');
      expect(calls()[2][0]?.toolChoice).toBe('auto');
      expect(response.operations).toHaveLength(1);
    });

    it('bounds repeated malformed reads without enabling edits', async () => {
      const calls = provider(
        Array.from({ length: 3 }, (): Call => ['read_workflow', null]),
        streaming,
      );
      await expect(
        runLocalAgent(request(), new AbortController().signal, selectedConfig, emit()),
      ).rejects.toMatchObject({ code: 'invalid_workflow_edit' });
      expect(calls()).toHaveLength(3);
      expect(toolkit.getOperations()).toEqual([]);
      expect(reviewWorkflow).not.toHaveBeenCalled();
    });

    it('rejects the textual finish marker before reading', async () => {
      provider([], streaming, '<tool_call><function=finish_workflow></function></tool_call>');
      const ready = vi.fn();
      await expect(
        runLocalAgent(
          request(),
          new AbortController().signal,
          selectedConfig,
          emit(),
          undefined,
          streaming ? ready : undefined,
        ),
      ).rejects.toMatchObject({ status: 422 });
      expect(ready).not.toHaveBeenCalled();
      expect(reviewWorkflow).not.toHaveBeenCalled();
    });
  });
});

describe.each([false, true])('LangGraph required read (streaming: %s)', (streaming) => {
  it.each(['success', 'text', 'mixed', 'failed'] as const)(
    'enforces the shared gate for %s',
    async (scenario) => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      vi.stubEnv('LOCAL_LLM_BASE_URL', '');
      vi.stubEnv('LOCAL_LLM_MODEL', '');
      const calls = provider(
        scenario === 'success'
          ? [read, edit]
          : scenario === 'mixed'
            ? [[read, edit]]
            : scenario === 'failed'
              ? [['read_workflow', null], edit]
              : [],
        streaming,
      );
      const ready: unknown[] = [];
      const run = async () => {
        if (!streaming) return (await graph.invoke({ request: request() })).response;
        let response: AIChatResponse | undefined;
        const events = await graph.stream(
          { request: request() },
          {
            streamMode: ['custom', 'values'],
            configurable: { streamAIText: true },
          },
        );
        for await (const [mode, value] of events) {
          if (mode === 'custom' && value.type === 'workflow-ready') ready.push(value.response);
          if (mode === 'values' && value.response) response = value.response;
        }
        return response;
      };
      if (scenario === 'success') {
        expect((await run())?.operations).toHaveLength(1);
        expect(reviewWorkflow).toHaveBeenCalledOnce();
        expect(ready).toHaveLength(streaming ? 1 : 0);
      } else {
        await expect(run()).rejects.toMatchObject({ status: 422 });
        expect(toolkit.getOperations()).toEqual([]);
        expect(ready).toEqual([]);
        expect(reviewWorkflow).not.toHaveBeenCalled();
      }
      expect(Object.keys(calls()[0][0]?.tools ?? {})).toEqual(['read_workflow']);
      expect(calls()[0][0]?.toolChoice).toBe('required');
    },
  );
});
