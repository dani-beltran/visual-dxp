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
              '<style>[data-visual-dxp-popover="idle-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="idle-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="idle-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">✉️</span> Enter your email and use the arrow button to subscribe.</p>',
            position: 'anchor',
            width: 240,
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
            content: `<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">
  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>
  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">At your own pace</p>
  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Take your time</h2>
  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Use the page navigation to keep exploring. You can close this tip whenever you like.</p>
</div>`,
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
