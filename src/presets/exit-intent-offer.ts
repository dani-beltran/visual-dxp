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
            content: `<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">
  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>
  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">A thoughtful delivery</p>
  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">A thoughtful delivery</h2>
  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Complimentary shipping on orders over €75. Take another look whenever you are ready.</p>
  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Back to the collection</span><span aria-hidden="true">↗</span></a>
</div>`,
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
