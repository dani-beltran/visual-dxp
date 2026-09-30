import type { WorkflowPreset } from '../lib/types';

export const inactivityAssistancePreset = {
  id: 'inactivity-assistance',
  name: 'Inactivity assistance',
  description:
    'After 30 seconds without activity, offer newsletter guidance if the form exists or general guidance otherwise.',
  complexity: 'intermediate',
  order: 90,
  tags: ['trigger', 'fork', 'delay', 'popover', 'note'],
  workflow: {
    version: 1,
    name: 'Inactivity assistance',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'idle-trigger',
        type: 'workflow',
        position: {
          x: 60,
          y: 230,
        },
        data: {
          kind: 'trigger',
          label: 'Idle for 30 seconds',
          config: {
            event: 'inactivity',
            duration: 30000,
          },
        },
      },
      {
        id: 'idle-check',
        type: 'workflow',
        position: {
          x: 400,
          y: 230,
        },
        data: {
          kind: 'fork',
          label: 'Newsletter form exists?',
          config: {
            conditionType: 'selector',
            condition: '#newsletter form',
          },
        },
      },
      {
        id: 'idle-delay',
        type: 'workflow',
        position: {
          x: 740,
          y: 60,
        },
        data: {
          kind: 'delay',
          label: 'Wait one more second',
          config: {
            duration: 1000,
          },
        },
      },
      {
        id: 'idle-help',
        type: 'workflow',
        position: {
          x: 1080,
          y: 60,
        },
        data: {
          kind: 'popover',
          label: 'Newsletter guidance',
          config: {
            contentType: 'html',
            content:
              '<h2>Need a hand?</h2><p>The newsletter form is here whenever you want occasional updates. No need to rush.</p>',
            position: 'anchor',
            width: 340,
            selector: '#newsletter form',
          },
        },
      },
      {
        id: 'idle-fallback',
        type: 'workflow',
        position: {
          x: 740,
          y: 400,
        },
        data: {
          kind: 'popover',
          label: 'General browsing help',
          config: {
            contentType: 'html',
            content:
              '<h2>Take your time</h2><p>Use the page navigation to keep exploring. You can close this tip whenever you like.</p>',
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'inactivity-assistance-setup-1',
        type: 'workflow',
        position: {
          x: 400,
          y: 700,
        },
        data: {
          kind: 'note',
          label: 'Setup: Anchor and fallback',
          config: {
            noteText:
              'Uses #newsletter form; remove it to exercise the fallback. The condition checks existence, not visibility, validity, or engagement.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'inactivity-assistance-setup-2',
        type: 'workflow',
        position: {
          x: 740,
          y: 700,
        },
        data: {
          kind: 'note',
          label: 'Setup: Timing behavior',
          config: {
            noteText:
              'Activity resets the inactivity timer and can cause later assistance. Activity during the subsequent 1-second delay does not cancel it. The anchor must still exist after that delay.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'inactivity-assistance-overview',
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
              'Inactivity assistance\n\nAfter 30 seconds without activity, offer newsletter guidance if the form exists or general guidance otherwise.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 21,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'idle-trigger-to-idle-check',
        source: 'idle-trigger',
        target: 'idle-check',
        type: 'smoothstep',
      },
      {
        id: 'idle-check-to-idle-delay',
        source: 'idle-check',
        target: 'idle-delay',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Form available',
      },
      {
        id: 'idle-delay-to-idle-help',
        source: 'idle-delay',
        target: 'idle-help',
        type: 'smoothstep',
      },
      {
        id: 'idle-check-to-idle-fallback',
        source: 'idle-check',
        target: 'idle-fallback',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'No form',
      },
    ],
  },
} satisfies WorkflowPreset;
