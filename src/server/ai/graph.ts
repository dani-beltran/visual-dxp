import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { RunnableConfig } from '@langchain/core/runnables';
import { parseAIChatRequest } from './workflow/ai';
import type { AIChatRequest, AIChatResponse } from './workflow/ai';
import { runLocalAgent } from './agent';

const State = Annotation.Root({
  request: Annotation<AIChatRequest>(),
  response: Annotation<AIChatResponse>(),
});

// Each graph run builds a fresh private tool draft. The HTTP proxy uses stateless
// runs so replayed or checkpointed history cannot overwrite newer canvas edits.
export const graph = new StateGraph(State)
  .addNode('edit_workflow', async (state, config: RunnableConfig) => {
    const signal = config.signal
      ? AbortSignal.any([config.signal, AbortSignal.timeout(90000)])
      : AbortSignal.timeout(90000);
    return { response: await runLocalAgent(parseAIChatRequest(state.request), signal) };
  })
  .addEdge(START, 'edit_workflow')
  .addEdge('edit_workflow', END)
  .compile();
