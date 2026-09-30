import type { WorkflowPreset } from '../lib/types';

export const campaignUrlPersonalizationPreset = {
  id: 'campaign-url-personalization',
  name: 'Campaign URL personalization',
  description:
    'Welcome everyday-edit campaign visitors with tailored copy while retaining a default message.',
  complexity: 'intermediate',
  order: 60,
  tags: ['trigger', 'fork', 'dom', 'note'],
  workflow: {
    version: 1,
    name: 'Campaign URL personalization',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'campaign-load',
        type: 'workflow',
        position: {
          x: 60,
          y: 230,
        },
        data: {
          kind: 'trigger',
          label: 'Page loaded',
          config: {
            event: 'page-load',
          },
        },
      },
      {
        id: 'campaign-check',
        type: 'workflow',
        position: {
          x: 400,
          y: 230,
        },
        data: {
          kind: 'fork',
          label: 'Everyday edit campaign?',
          config: {
            conditionType: 'query-param',
            conditionKey: 'utm_campaign',
            conditionValue: 'everyday-edit',
          },
        },
      },
      {
        id: 'campaign-matched',
        type: 'workflow',
        position: {
          x: 740,
          y: 60,
        },
        data: {
          kind: 'dom',
          label: 'Campaign message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Welcome to the everyday edit: thoughtful objects for slower mornings.',
          },
        },
      },
      {
        id: 'campaign-default',
        type: 'workflow',
        position: {
          x: 740,
          y: 400,
        },
        data: {
          kind: 'dom',
          label: 'Default message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Discover thoughtful objects for everyday living.',
          },
        },
      },
      {
        id: 'campaign-url-personalization-setup-1',
        type: 'workflow',
        position: {
          x: 400,
          y: 680,
        },
        data: {
          kind: 'note',
          label: 'Setup: Campaign parameter',
          config: {
            noteText:
              'Visit /demo-site.html?utm_campaign=everyday-edit to match. Query values are exact and case-sensitive; replace the parameter and value for your campaign.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'campaign-url-personalization-setup-2',
        type: 'workflow',
        position: {
          x: 740,
          y: 680,
        },
        data: {
          kind: 'note',
          label: 'Setup: Preview website',
          config: {
            noteText:
              'Uses .hero .description. Configure the builder website URL for the page you will test; applying a preset preserves the current website URL.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'campaign-url-personalization-overview',
        type: 'workflow',
        position: {
          x: -280,
          y: 60,
        },
        data: {
          kind: 'note',
          label: 'Preset overview',
          config: {
            noteText:
              'Campaign URL personalization\n\nWelcome everyday-edit campaign visitors with tailored copy while retaining a default message.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 28,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'campaign-load-to-campaign-check',
        source: 'campaign-load',
        target: 'campaign-check',
        type: 'smoothstep',
      },
      {
        id: 'campaign-check-to-campaign-matched',
        source: 'campaign-check',
        target: 'campaign-matched',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Campaign match',
      },
      {
        id: 'campaign-check-to-campaign-default',
        source: 'campaign-check',
        target: 'campaign-default',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'Default',
      },
    ],
  },
} satisfies WorkflowPreset;
