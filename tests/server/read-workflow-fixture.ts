// Real Responses API fixtures for tests whose subject begins after the mandatory read.
export function workflowReadResponse(streaming = false) {
  const item = {
    type: 'function_call',
    id: 'fc-read',
    call_id: 'call-read',
    name: 'read_workflow',
    arguments: '{}',
    status: 'completed',
  };
  const response = {
    id: 'resp-read',
    created_at: 1,
    status: 'completed',
    model: 'fixture-model',
    output: [item],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  };
  if (!streaming) return Response.json(response);
  return new Response(
    [
      { type: 'response.created', response },
      { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '' } },
      {
        type: 'response.function_call_arguments.delta',
        output_index: 0,
        item_id: item.id,
        delta: '{}',
      },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join(''),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
