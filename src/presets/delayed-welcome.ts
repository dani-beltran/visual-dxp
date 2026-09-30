import type { WorkflowPreset } from '../lib/types';

export const delayedWelcomePreset = {
  id: 'delayed-welcome',
  name: 'Delayed welcome',
  description: 'Give visitors two seconds to settle in before a small welcome message.',
  complexity: 'beginner',
  order: 20,
  tags: ['trigger', 'delay', 'popover', 'note'],
  workflow: {
    version: 1,
    name: 'Delayed welcome',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'welcome-load',
        type: 'workflow',
        position: {
          x: 60,
          y: 180,
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
        id: 'welcome-delay',
        type: 'workflow',
        position: {
          x: 400,
          y: 180,
        },
        data: {
          kind: 'delay',
          label: 'Wait two seconds',
          config: {
            duration: 2000,
          },
        },
      },
      {
        id: 'welcome-popover',
        type: 'workflow',
        position: {
          x: 740,
          y: 180,
        },
        data: {
          kind: 'popover',
          label: 'Welcome to Atelier',
          config: {
            contentType: 'html',
            content:
              '<h2>Make yourself at home</h2><p>Explore considered objects for everyday living, at your own pace.</p><a href="#collection">Browse the collection</a>',
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'delayed-welcome-setup-1',
        type: 'workflow',
        position: {
          x: 740,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Welcome content',
          config: {
            noteText:
              'The demo contains #collection. Update the link and welcome copy for your website.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'delayed-welcome-setup-2',
        type: 'workflow',
        position: {
          x: 400,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Display frequency',
          config: {
            noteText: 'Runs once per page load; there is no cross-visit frequency gate.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'delayed-welcome-overview',
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
              'Delayed welcome\n\nGive visitors two seconds to settle in before a small welcome message.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 15,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'welcome-load-to-welcome-delay',
        source: 'welcome-load',
        target: 'welcome-delay',
        type: 'smoothstep',
      },
      {
        id: 'welcome-delay-to-welcome-popover',
        source: 'welcome-delay',
        target: 'welcome-popover',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
