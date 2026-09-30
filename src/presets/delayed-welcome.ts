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
            content: `<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">
  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>
  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Welcome to Atelier</p>
  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Make yourself at home</h2>
  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Explore considered objects for everyday living, at your own pace.</p>
  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Browse the collection</span><span aria-hidden="true">↗</span></a>
</div>`,
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
