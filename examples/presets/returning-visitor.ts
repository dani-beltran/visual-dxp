import type { WorkflowPreset } from '../../src';

export const returningVisitorPreset = {
  id: 'returning-visitor',
  name: 'Returning visitor greeting',
  description: 'Show a greeting only when a visitor has your returning-visitor cookie.',
  complexity: 'intermediate',
  order: 20,
  tags: ['cookie', 'personalization'],
  setupInstructions: [
    'Set the condition cookie name and expected value to match your website.',
    'Customize the returning visitor message.',
  ],
  workflow: {
    version: 1,
    name: 'Returning visitor greeting',
    websiteUrl: '',
    nodes: [
      {
        id: 'returning-start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Page loaded', config: { event: 'page-load' } },
      },
      {
        id: 'returning-condition',
        type: 'workflow',
        position: { x: 320, y: 0 },
        data: {
          kind: 'fork',
          label: 'Returning visitor?',
          config: { conditionType: 'cookie', conditionKey: 'returning', conditionValue: 'yes' },
        },
      },
      {
        id: 'returning-message',
        type: 'workflow',
        position: { x: 640, y: -100 },
        data: {
          kind: 'popover',
          label: 'Welcome back',
          config: { contentType: 'html', content: '<h2>Welcome back!</h2>', position: 'center' },
        },
      },
    ],
    edges: [
      { id: 'returning-check', source: 'returning-start', target: 'returning-condition' },
      {
        id: 'returning-yes',
        source: 'returning-condition',
        sourceHandle: 'true',
        target: 'returning-message',
      },
    ],
  },
} satisfies WorkflowPreset;
