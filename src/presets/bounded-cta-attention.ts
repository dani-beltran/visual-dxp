import type { WorkflowPreset } from '../lib/types';

export const boundedCtaAttentionPreset = {
  id: 'bounded-cta-attention',
  name: 'Bounded CTA attention sequence',
  description:
    'Highlight the collection heading twice after the main CTA is clicked, then show a completion tip.',
  complexity: 'advanced',
  order: 110,
  tags: ['trigger', 'loop', 'dom', 'delay', 'popover', 'note'],
  workflow: {
    version: 1,
    name: 'Bounded CTA attention sequence',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'attention-click',
        type: 'workflow',
        position: {
          x: 60,
          y: 240,
        },
        data: {
          kind: 'trigger',
          label: 'Click collection CTA',
          config: {
            event: 'click',
            selector: '#shop-now',
          },
        },
      },
      {
        id: 'attention-loop',
        type: 'workflow',
        position: {
          x: 400,
          y: 240,
        },
        data: {
          kind: 'loop',
          label: 'Repeat twice',
          config: {
            iterations: 2,
          },
        },
      },
      {
        id: 'attention-add',
        type: 'workflow',
        position: {
          x: 740,
          y: 60,
        },
        data: {
          kind: 'dom',
          label: 'Highlight destination',
          config: {
            selector: '#collection > div:nth-of-type(2)',
            action: 'add-class',
            value: 'dxp-cta-attention',
          },
        },
      },
      {
        id: 'attention-on',
        type: 'workflow',
        position: {
          x: 1080,
          y: 60,
        },
        data: {
          kind: 'delay',
          label: 'Hold for 600 ms',
          config: {
            duration: 600,
          },
        },
      },
      {
        id: 'attention-remove',
        type: 'workflow',
        position: {
          x: 1420,
          y: 60,
        },
        data: {
          kind: 'dom',
          label: 'Remove highlight',
          config: {
            selector: '#collection > div:nth-of-type(2)',
            action: 'remove-class',
            value: 'dxp-cta-attention',
          },
        },
      },
      {
        id: 'attention-off',
        type: 'workflow',
        position: {
          x: 1760,
          y: 60,
        },
        data: {
          kind: 'delay',
          label: 'Rest for 600 ms',
          config: {
            duration: 600,
          },
        },
      },
      {
        id: 'attention-done',
        type: 'workflow',
        position: {
          x: 740,
          y: 500,
        },
        data: {
          kind: 'popover',
          label: 'Collection is ready',
          config: {
            contentType: 'html',
            content: `<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">
  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>
  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">The everyday collection</p>
  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Explore at your own pace</h2>
  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">The collection heading has been highlighted twice. Take a closer look at any object that catches your eye.</p>
</div>`,
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'bounded-cta-attention-setup-1',
        type: 'workflow',
        position: {
          x: 1080,
          y: 360,
        },
        data: {
          kind: 'note',
          label: 'Setup: Required CSS',
          config: {
            noteText:
              'Uses #shop-now and #collection h2, the destination of the demo CTA scroll. The demo includes .dxp-cta-attention { outline: 3px solid #697856; outline-offset: 6px; }. Add that class to your own website stylesheet.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'bounded-cta-attention-setup-2',
        type: 'workflow',
        position: {
          x: 400,
          y: 800,
        },
        data: {
          kind: 'note',
          label: 'Setup: Loop wiring',
          config: {
            noteText:
              'The loop awaits the entire body twice (2.4 seconds total), then follows done once. Leave the final body delay unconnected: never connect it back to the loop or to done.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'bounded-cta-attention-setup-3',
        type: 'workflow',
        position: {
          x: 740,
          y: 800,
        },
        data: {
          kind: 'note',
          label: 'Setup: Completion limits',
          config: {
            noteText:
              'Completion means the class sequence finished, not that a visitor engaged. Repeated clicks may start overlapping runs. Destroying the runtime mid-body does not undo DOM changes; remove the class during host cleanup if necessary.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'bounded-cta-attention-overview',
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
              'Bounded CTA attention sequence\n\nHighlight the collection heading twice after the main CTA is clicked, then show a completion tip.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 30,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'attention-click-to-attention-loop',
        source: 'attention-click',
        target: 'attention-loop',
        type: 'smoothstep',
      },
      {
        id: 'attention-loop-to-attention-add',
        source: 'attention-loop',
        target: 'attention-add',
        type: 'smoothstep',
        sourceHandle: 'body',
        label: 'Repeat body',
      },
      {
        id: 'attention-add-to-attention-on',
        source: 'attention-add',
        target: 'attention-on',
        type: 'smoothstep',
      },
      {
        id: 'attention-on-to-attention-remove',
        source: 'attention-on',
        target: 'attention-remove',
        type: 'smoothstep',
      },
      {
        id: 'attention-remove-to-attention-off',
        source: 'attention-remove',
        target: 'attention-off',
        type: 'smoothstep',
      },
      {
        id: 'attention-loop-to-attention-done',
        source: 'attention-loop',
        target: 'attention-done',
        type: 'smoothstep',
        sourceHandle: 'done',
        label: 'After both repetitions',
      },
    ],
  },
} satisfies WorkflowPreset;
