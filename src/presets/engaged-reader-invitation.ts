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
            content: `<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">
  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>
  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">The Atelier journal</p>
  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Enjoying the collection?</h2>
  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Find occasional stories and new objects in our newsletter.</p>
  <a href="#newsletter" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Explore the newsletter</span><span aria-hidden="true">↗</span></a>
</div>`,
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
