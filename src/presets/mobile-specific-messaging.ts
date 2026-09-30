import type { WorkflowPreset } from '../lib/types';

export const mobileSpecificMessagingPreset = {
  id: 'mobile-specific-messaging',
  name: 'Mobile-specific messaging',
  description: 'Choose concise mobile copy or fuller desktop copy for the hero description.',
  complexity: 'intermediate',
  order: 50,
  tags: ['trigger', 'fork', 'dom', 'note'],
  workflow: {
    version: 1,
    name: 'Mobile-specific messaging',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'device-load',
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
        id: 'device-check',
        type: 'workflow',
        position: {
          x: 400,
          y: 230,
        },
        data: {
          kind: 'fork',
          label: 'Mobile device?',
          config: {
            conditionType: 'device',
            conditionValue: 'mobile',
          },
        },
      },
      {
        id: 'device-mobile',
        type: 'workflow',
        position: {
          x: 740,
          y: 60,
        },
        data: {
          kind: 'dom',
          label: 'Mobile message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Everyday favorites, ready to explore on the go.',
          },
        },
      },
      {
        id: 'device-desktop',
        type: 'workflow',
        position: {
          x: 740,
          y: 400,
        },
        data: {
          kind: 'dom',
          label: 'Desktop message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value:
              'Take a closer look at natural materials and thoughtful details in our everyday collection.',
          },
        },
      },
      {
        id: 'mobile-specific-messaging-setup-1',
        type: 'workflow',
        position: {
          x: 400,
          y: 680,
        },
        data: {
          kind: 'note',
          label: 'Setup: Device detection',
          config: {
            noteText:
              'Uses .hero .description. Device detection uses browser device hints or user agent, not viewport width; resizing the preview is not mobile emulation.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'mobile-specific-messaging-overview',
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
              'Mobile-specific messaging\n\nChoose concise mobile copy or fuller desktop copy for the hero description.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 25,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'device-load-to-device-check',
        source: 'device-load',
        target: 'device-check',
        type: 'smoothstep',
      },
      {
        id: 'device-check-to-device-mobile',
        source: 'device-check',
        target: 'device-mobile',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Mobile',
      },
      {
        id: 'device-check-to-device-desktop',
        source: 'device-check',
        target: 'device-desktop',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'Desktop',
      },
    ],
  },
} satisfies WorkflowPreset;
