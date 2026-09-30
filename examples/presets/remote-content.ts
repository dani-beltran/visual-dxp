import type { WorkflowPreset } from '../../src';

export const remoteContentPreset = {
  id: 'remote-content',
  name: 'Remote content',
  description: 'Fetch content from an API and update an element when it exists on the page.',
  complexity: 'advanced',
  order: 30,
  tags: ['api', 'data', 'dom'],
  setupInstructions: [
    'Replace the API URL with a public endpoint that allows requests from your website.',
    'Set the response data path to the text field in your API response.',
    'Replace #announcement in both the condition and update step with your target selector.',
  ],
  workflow: {
    version: 1,
    name: 'Remote content',
    websiteUrl: '',
    nodes: [
      {
        id: 'remote-start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Page loaded', config: { event: 'page-load' } },
      },
      {
        id: 'remote-condition',
        type: 'workflow',
        position: { x: 320, y: 0 },
        data: {
          kind: 'fork',
          label: 'Announcement exists?',
          config: { conditionType: 'selector', condition: '#announcement' },
        },
      },
      {
        id: 'remote-fetch',
        type: 'workflow',
        position: { x: 640, y: -100 },
        data: {
          kind: 'http',
          label: 'Fetch announcement',
          config: {
            url: 'https://example.com/api/announcement',
            method: 'GET',
            responseDataPath: 'message',
          },
        },
      },
      {
        id: 'remote-update',
        type: 'workflow',
        position: { x: 960, y: -100 },
        data: {
          kind: 'dom',
          label: 'Update announcement',
          config: { selector: '#announcement', action: 'text', valueSource: 'incoming-data' },
        },
      },
    ],
    edges: [
      { id: 'remote-check', source: 'remote-start', target: 'remote-condition' },
      {
        id: 'remote-yes',
        source: 'remote-condition',
        sourceHandle: 'true',
        target: 'remote-fetch',
      },
      { id: 'remote-content', source: 'remote-fetch', target: 'remote-update' },
    ],
  },
} satisfies WorkflowPreset;
