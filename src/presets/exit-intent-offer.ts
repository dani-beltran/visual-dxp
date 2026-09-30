import type { WorkflowPreset } from '../lib/types';

export const exitIntentOfferPreset = {
  id: 'exit-intent-offer',
  name: 'Exit-intent offer with frequency control',
  description: 'Show a shipping reminder on exit intent only when its session marker is absent.',
  complexity: 'intermediate',
  order: 70,
  tags: ['trigger', 'fork', 'popover', 'cookie', 'note'],
  workflow: {
    version: 1,
    name: 'Exit-intent offer with frequency control',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'exit-trigger',
        type: 'workflow',
        position: {
          x: 60,
          y: 180,
        },
        data: {
          kind: 'trigger',
          label: 'Pointer leaves at top',
          config: {
            event: 'exit-intent',
          },
        },
      },
      {
        id: 'exit-check',
        type: 'workflow',
        position: {
          x: 400,
          y: 180,
        },
        data: {
          kind: 'fork',
          label: 'Offer already shown?',
          config: {
            conditionType: 'cookie',
            conditionKey: 'dxp_exit_offer',
            conditionValue: 'shown',
          },
        },
      },
      {
        id: 'exit-popover',
        type: 'workflow',
        position: {
          x: 740,
          y: 300,
        },
        data: {
          kind: 'popover',
          label: 'Before you go',
          config: {
            contentType: 'html',
            content:
              '<h2>A thoughtful delivery</h2><p>Complimentary shipping on orders over €75. Take another look whenever you are ready.</p><a href="#collection">Back to the collection</a>',
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'exit-cookie',
        type: 'workflow',
        position: {
          x: 1080,
          y: 300,
        },
        data: {
          kind: 'cookie',
          label: 'Remember for this session',
          config: {
            cookieName: 'dxp_exit_offer',
            cookieValue: 'shown',
            cookieDays: 0,
          },
        },
      },
      {
        id: 'exit-intent-offer-setup-1',
        type: 'workflow',
        position: {
          x: 740,
          y: 600,
        },
        data: {
          kind: 'note',
          label: 'Setup: Offer terms',
          config: {
            noteText:
              'Uses the demo shipping offer and #collection link; verify your own offer terms before use.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'exit-intent-offer-setup-2',
        type: 'workflow',
        position: {
          x: 1080,
          y: 600,
        },
        data: {
          kind: 'note',
          label: 'Setup: Session marker',
          config: {
            noteText:
              'Writes dxp_exit_offer=shown as a session cookie (cookieDays: 0). Matching true ends silently. Clear the cookie and matching browser storage keys to retest.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'exit-intent-offer-setup-3',
        type: 'workflow',
        position: {
          x: 60,
          y: 600,
        },
        data: {
          kind: 'note',
          label: 'Setup: Exit detection',
          config: {
            noteText:
              'Exit intent is a pointer leaving the top edge, once per runtime installation; it is not a mobile back-navigation detector.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'exit-intent-offer-overview',
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
              'Exit-intent offer with frequency control\n\nShow a shipping reminder on exit intent only when its session marker is absent.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 40,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'exit-trigger-to-exit-check',
        source: 'exit-trigger',
        target: 'exit-check',
        type: 'smoothstep',
      },
      {
        id: 'exit-check-to-exit-popover',
        source: 'exit-check',
        target: 'exit-popover',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'Not yet shown',
      },
      {
        id: 'exit-popover-to-exit-cookie',
        source: 'exit-popover',
        target: 'exit-cookie',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
