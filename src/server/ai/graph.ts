import type { RunnableConfig } from '@langchain/core/runnables';
import { Annotation, END, getWriter, START, StateGraph } from '@langchain/langgraph';
import { type Carrier, withWorkflow } from '../observability';
import { flushTelemetry } from '../observability/sdk';
import { runLocalAgent } from './agent';
import type { AIChatRequest, AIChatResponse } from './workflow/ai';
import { parseAIChatRequest } from './workflow/ai';

const State = Annotation.Root({
  request: Annotation<AIChatRequest>(),
  response: Annotation<AIChatResponse>(),
});

// Each graph run builds a fresh private tool draft. The HTTP proxy uses stateless
// runs so replayed or checkpointed history cannot overwrite newer canvas edits.
export const graph = new StateGraph(State)
  .addNode('edit_workflow', async (state, config: RunnableConfig) => {
    const signal = config.signal
      ? AbortSignal.any([config.signal, AbortSignal.timeout(180000)])
      : AbortSignal.timeout(180000);
    const writer = config.configurable?.streamAIText ? getWriter(config) : undefined;
    try {
      return {
        response: await withWorkflow(
          state.request.workflow,
          () =>
            runLocalAgent(
              parseAIChatRequest(state.request),
              signal,
              undefined,
              writer ? (text) => writer({ type: 'text', text }) : undefined,
              writer ? (text) => writer({ type: 'reasoning', text }) : undefined,
            ),
          config.configurable?.dxpTelemetry as Carrier | undefined,
        ),
      };
    } finally {
      await flushTelemetry();
    }
  })
  .addEdge(START, 'edit_workflow')
  .addEdge('edit_workflow', END)
  .compile();
