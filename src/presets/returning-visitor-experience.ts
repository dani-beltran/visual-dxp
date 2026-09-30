import type { WorkflowPreset } from '../lib/types';

export const returningVisitorExperiencePreset = {
  id: 'returning-visitor-experience',
  name: 'Returning-visitor experience',
  description:
    'Greet repeat visitors, or welcome new visitors and remember that the welcome was displayed.',
  complexity: 'intermediate',
  order: 80,
  tags: ['trigger', 'fork', 'dom', 'popover', 'cookie', 'note'],
  workflow: {
    version: 1,
    name: 'Returning-visitor experience',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'visitor-load',
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
        id: 'visitor-check',
        type: 'workflow',
        position: {
          x: 400,
          y: 230,
        },
        data: {
          kind: 'fork',
          label: 'Welcomed before?',
          config: {
            conditionType: 'cookie',
            conditionKey: 'dxp_visitor_welcome',
            conditionValue: 'shown',
          },
        },
      },
      {
        id: 'visitor-returning',
        type: 'workflow',
        position: {
          x: 740,
          y: 60,
        },
        data: {
          kind: 'dom',
          label: 'Welcome back message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Welcome back. Discover something thoughtful for your everyday.',
          },
        },
      },
      {
        id: 'visitor-welcome',
        type: 'workflow',
        position: {
          x: 740,
          y: 400,
        },
        data: {
          kind: 'popover',
          label: 'First-visit welcome',
          config: {
            contentType: 'html',
            content: `<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">
  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>
  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Thoughtfully made</p>
  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Welcome to Atelier</h2>
  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Start with the everyday collection and discover objects made to be kept.</p>
  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Explore the collection</span><span aria-hidden="true">↗</span></a>
</div>`,
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'visitor-cookie',
        type: 'workflow',
        position: {
          x: 1080,
          y: 400,
        },
        data: {
          kind: 'cookie',
          label: 'Remember welcome shown',
          config: {
            cookieName: 'dxp_visitor_welcome',
            cookieValue: 'shown',
            cookieDays: 30,
          },
        },
      },
      {
        id: 'returning-visitor-experience-setup-1',
        type: 'workflow',
        position: {
          x: 740,
          y: 700,
        },
        data: {
          kind: 'note',
          label: 'Setup: Welcome and marker',
          config: {
            noteText:
              'Uses .hero .description and #collection. dxp_visitor_welcome=shown lasts 30 days and records a displayed welcome, not identity or purchase history.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'returning-visitor-experience-setup-2',
        type: 'workflow',
        position: {
          x: 1080,
          y: 700,
        },
        data: {
          kind: 'note',
          label: 'Setup: Retest first visit',
          config: {
            noteText:
              'Clear the cookie and matching local/session storage key to test the first-visit branch again.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'returning-visitor-experience-overview',
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
              'Returning-visitor experience\n\nGreet repeat visitors, or welcome new visitors and remember that the welcome was displayed.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 28,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'visitor-load-to-visitor-check',
        source: 'visitor-load',
        target: 'visitor-check',
        type: 'smoothstep',
      },
      {
        id: 'visitor-check-to-visitor-returning',
        source: 'visitor-check',
        target: 'visitor-returning',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Returning',
      },
      {
        id: 'visitor-check-to-visitor-welcome',
        source: 'visitor-check',
        target: 'visitor-welcome',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'First welcome',
      },
      {
        id: 'visitor-welcome-to-visitor-cookie',
        source: 'visitor-welcome',
        target: 'visitor-cookie',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
