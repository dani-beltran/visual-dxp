import type { WorkflowPreset } from '../../src';

export const welcomePreset = {
  id: 'welcome',
  name: 'Welcome message',
  description: 'Welcome visitors with a message when the page loads.',
  complexity: 'beginner',
  order: 10,
  tags: ['welcome', 'popover'],
  setupInstructions: ['Edit the welcome message before publishing.'],
  workflow: {
    version: 1,
    name: 'Welcome message',
    websiteUrl: '',
    nodes: [
      {
        id: 'welcome-start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Page loaded', config: { event: 'page-load' } },
      },
      {
        id: 'welcome-message',
        type: 'workflow',
        position: { x: 320, y: 0 },
        data: {
          kind: 'popover',
          label: 'Welcome message',
          config: {
            contentType: 'html',
            content: '<h2>Welcome!</h2><p>Explore what is new.</p>',
            position: 'bottom-right',
            width: 360,
          },
        },
      },
    ],
    edges: [{ id: 'welcome-connection', source: 'welcome-start', target: 'welcome-message' }],
  },
} satisfies WorkflowPreset;
