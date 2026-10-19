import type { AIChatRequest } from '../../src/server/ai/workflow/ai';

// Page load selects one of two headline variants. Fractional positions and dimensions
// ensure configuration edits preserve unrelated canvas metadata.
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
      name: 'Headline experiment',
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'page-load',
          type: 'workflow',
          position: {
            x: 60,
            y: 220,
          },
          width: 238,
          height: 156,
          data: {
            kind: 'trigger',
            label: 'Page loaded',
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'headline-experiment',
          type: 'workflow',
          position: {
            x: 360,
            y: 220,
          },
          width: 238,
          height: 180,
          data: {
            kind: 'experiment',
            label: 'Headline experiment',
            config: {
              experimentSplit: 50,
            },
          },
        },
        {
          id: 'headline-a',
          type: 'workflow',
          position: {
            x: 910.5,
            y: 120.75,
          },
          width: 238,
          height: 156,
          data: {
            kind: 'dom',
            label: 'Headline A',
            config: {
              selector: 'h1',
              action: 'text',
              value: 'Hola',
            },
          },
        },
        {
          id: 'headline-b',
          type: 'workflow',
          position: {
            x: 660,
            y: 380,
          },
          width: 238,
          height: 156,
          data: {
            kind: 'dom',
            label: 'Headline B',
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
          id: 'start-experiment',
          source: 'page-load',
          target: 'headline-experiment',
          type: 'smoothstep',
        },
        {
          id: 'experiment-to-a',
          source: 'headline-experiment',
          target: 'headline-a',
          type: 'smoothstep',
          sourceHandle: 'a',
          label: 'Variant A',
        },
        {
          id: 'experiment-to-b',
          source: 'headline-experiment',
          target: 'headline-b',
          type: 'smoothstep',
          sourceHandle: 'b',
          label: 'Variant B',
        },
      ],
    },
    selectedNodeIds: ['headline-experiment'],
  };
}

// Explaining the workflow requires no selection and authorizes no configuration changes.
export function experimentExplanationRequest(): AIChatRequest {
  const request = experimentKeyRequest();
  request.messages = [{ role: 'user', content: 'what is this workflow?' }];
  request.selectedNodeIds = [];
  return request;
}
