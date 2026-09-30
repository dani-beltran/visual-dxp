import type { WorkflowPreset } from '../lib/types';

export const engagedReaderInvitationPreset = {
  id: 'engaged-reader-invitation',
  name: 'Engaged-reader invitation',
  description: 'Invite visitors who scroll through 70% of the page to explore the newsletter.',
  complexity: 'beginner',
  order: 40,
  tags: ['trigger', 'popover', 'cookie', 'note'],
  workflow: {
    version: 1,
    name: 'Engaged-reader invitation',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'reader-scroll',
        type: 'workflow',
        position: {
          x: 60,
          y: 180,
        },
        data: {
          kind: 'trigger',
          label: 'Scroll down to 70%',
          config: {
            event: 'scroll-depth',
            scrollThreshold: 70,
          },
        },
      },
      {
        id: 'reader-popover',
        type: 'workflow',
        position: {
          x: 400,
          y: 180,
        },
        data: {
          kind: 'popover',
          label: 'A little inspiration',
          config: {
            contentType: 'html',
            content:
              '<h2>Enjoying the collection?</h2><p>Find occasional stories and new objects in our newsletter.</p><a href="#newsletter">Explore the newsletter</a>',
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'reader-cookie',
        type: 'workflow',
        position: {
          x: 740,
          y: 180,
        },
        data: {
          kind: 'cookie',
          label: 'Record invitation shown',
          config: {
            cookieName: 'dxp_reader_invitation',
            cookieValue: 'shown',
            cookieDays: 7,
          },
        },
      },
      {
        id: 'engaged-reader-invitation-setup-1',
        type: 'workflow',
        position: {
          x: 400,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Scroll and link',
          config: {
            noteText:
              'Requires a scrollable page and downward scrolling; #newsletter exists in the demo.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'engaged-reader-invitation-setup-2',
        type: 'workflow',
        position: {
          x: 740,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Invitation marker',
          config: {
            noteText:
              'Writes dxp_reader_invitation=shown for 7 days immediately after rendering. This records display, not signup, and does not gate future page loads.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'engaged-reader-invitation-overview',
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
              'Engaged-reader invitation\n\nInvite visitors who scroll through 70% of the page to explore the newsletter.',
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
        id: 'reader-scroll-to-reader-popover',
        source: 'reader-scroll',
        target: 'reader-popover',
        type: 'smoothstep',
      },
      {
        id: 'reader-popover-to-reader-cookie',
        source: 'reader-popover',
        target: 'reader-cookie',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
