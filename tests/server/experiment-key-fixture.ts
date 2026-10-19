import type { AIChatRequest } from '../../src/server/ai/workflow/ai';

// Graph and selection from issue #38's recorded run; keep its IDs and canvas metadata.
export function experimentKeyRequest(): AIChatRequest {
  return {
    messages: [
      {
        role: 'assistant',
        content:
          'I can add the optional experiment key headline-test-v1. Changing the key starts a new assignment bucket.',
      },
      {
        role: 'user',
        content: 'add the experiment key',
      },
    ],
    workflow: {
      version: 1,
      name: 'Experimento de titulares',
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'trigger-bb56a200-c266-45fe-a347-a982c1b7b198',
          type: 'workflow',
          position: {
            x: 60,
            y: 220,
          },
          width: 238,
          height: 156,
          data: {
            kind: 'trigger',
            label: 'Al cargar la landing',
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'experiment-6360188b-b552-445c-b61c-e7c70eeb6674',
          type: 'workflow',
          position: {
            x: 360,
            y: 220,
          },
          width: 238,
          height: 180,
          data: {
            kind: 'experiment',
            label: 'Experimento de titulares',
            config: {
              experimentSplit: 50,
            },
          },
        },
        {
          id: 'dom-60b2ec83-2f49-438d-8ee0-dbaccf3b7c12',
          type: 'workflow',
          position: {
            x: 907.0085989404618,
            y: 120.7187028250948,
          },
          width: 238,
          height: 156,
          data: {
            kind: 'dom',
            label: 'Título variante A',
            config: {
              selector: 'h1',
              action: 'text',
              value: 'Hola',
            },
          },
        },
        {
          id: 'dom-13a29b99-c21a-4b4d-8984-dfcc3560cd11',
          type: 'workflow',
          position: {
            x: 660,
            y: 380,
          },
          width: 238,
          height: 156,
          data: {
            kind: 'dom',
            label: 'Título variante B',
            config: {
              selector: 'h1',
              action: 'text',
              value: 'Adios',
            },
          },
        },
      ],
      edges: [
        {
          id: 'edge-b86a73b9-797c-42b3-abd1-2a5856f2001c',
          source: 'trigger-bb56a200-c266-45fe-a347-a982c1b7b198',
          target: 'experiment-6360188b-b552-445c-b61c-e7c70eeb6674',
          type: 'smoothstep',
        },
        {
          id: 'edge-5106b763-742e-4dd8-8396-1c55720bbe2c',
          source: 'experiment-6360188b-b552-445c-b61c-e7c70eeb6674',
          target: 'dom-60b2ec83-2f49-438d-8ee0-dbaccf3b7c12',
          type: 'smoothstep',
          sourceHandle: 'a',
          label: 'Variante A',
        },
        {
          id: 'edge-ec3795d8-a4e1-440b-9f16-43fe0bbf98e9',
          source: 'experiment-6360188b-b552-445c-b61c-e7c70eeb6674',
          target: 'dom-13a29b99-c21a-4b4d-8984-dfcc3560cd11',
          type: 'smoothstep',
          sourceHandle: 'b',
          label: 'Variante B',
        },
      ],
    },
    selectedNodeIds: ['experiment-6360188b-b552-445c-b61c-e7c70eeb6674'],
  };
}

// Issue #39 is the preceding read-only request over the same recorded graph.
export function experimentExplanationRequest(): AIChatRequest {
  const request = experimentKeyRequest();
  request.messages = [{ role: 'user', content: 'what is this workflow?' }];
  request.selectedNodeIds = [];
  return request;
}
