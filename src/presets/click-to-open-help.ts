import type { WorkflowPreset } from '../lib/types';

export const clickToOpenHelpPreset = {
  id: 'click-to-open-help',
  name: 'Click-to-open help',
  description: 'Offer newsletter help next to the form when the newsletter link is clicked.',
  complexity: 'beginner',
  order: 10,
  tags: ['trigger', 'popover', 'note'],
  workflow: {
    version: 1,
    name: 'Click-to-open help',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'help-click',
        type: 'workflow',
        position: {
          x: 60,
          y: 180,
        },
        data: {
          kind: 'trigger',
          label: 'Click newsletter link',
          config: {
            event: 'click',
            selector: '#collection .section-heading a',
          },
        },
      },
      {
        id: 'help-popover',
        type: 'workflow',
        position: {
          x: 400,
          y: 180,
        },
        data: {
          kind: 'popover',
          label: 'Newsletter help',
          config: {
            contentType: 'html',
            content:
              '<h2>A quieter kind of inbox</h2><p>Enter your email in the newsletter form for occasional collection news. You can unsubscribe at any time.</p>',
            position: 'anchor',
            width: 340,
            selector: '#newsletter form',
          },
        },
      },
      {
        id: 'click-to-open-help-setup-1',
        type: 'workflow',
        position: {
          x: 60,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Help target',
          config: {
            noteText:
              'Uses #collection .section-heading a as the demo click target and #newsletter form as the anchor. The demo link scrolls to the newsletter; use a keyboard-accessible link or help button on your site.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'click-to-open-help-setup-2',
        type: 'workflow',
        position: {
          x: 400,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Help copy',
          config: {
            noteText:
              'Edit the copy to match your newsletter terms. Opening help does not submit or confirm a subscription.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'click-to-open-help-overview',
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
              'Click-to-open help\n\nOffer newsletter help next to the form when the newsletter link is clicked.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 18,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'help-click-to-help-popover',
        source: 'help-click',
        target: 'help-popover',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
