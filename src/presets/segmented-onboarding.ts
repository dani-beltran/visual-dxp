import type { WorkflowPreset } from '../lib/types';

export const segmentedOnboardingPreset = {
  id: 'segmented-onboarding',
  name: 'Segmented onboarding journey',
  description:
    'Recognize prior visits; for new visitors, tailor guidance by campaign and record successful guidance delivery.',
  complexity: 'advanced',
  order: 120,
  tags: ['frame', 'trigger', 'fork', 'dom', 'note', 'delay', 'popover', 'http', 'cookie'],
  workflow: {
    version: 1,
    name: 'Segmented onboarding journey',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'onboarding-entry',
        type: 'workflow',
        position: {
          x: 60,
          y: 60,
        },
        data: {
          kind: 'frame',
          label: '1 · Recognize the visit',
          config: {},
        },
        width: 650,
        height: 1020,
      },
      {
        id: 'onboarding-guidance',
        type: 'workflow',
        position: {
          x: 800,
          y: 60,
        },
        data: {
          kind: 'frame',
          label: '2 · Contextual guidance',
          config: {},
        },
        width: 1010,
        height: 1160,
      },
      {
        id: 'onboarding-record',
        type: 'workflow',
        position: {
          x: 1900,
          y: 60,
        },
        data: {
          kind: 'frame',
          label: '3 · Record delivery',
          config: {},
        },
        width: 650,
        height: 1220,
      },
      {
        id: 'onboarding-load',
        type: 'workflow',
        position: {
          x: 30,
          y: 100,
        },
        data: {
          kind: 'trigger',
          label: 'Page loaded',
          config: {
            event: 'page-load',
          },
        },
        parentId: 'onboarding-entry',
      },
      {
        id: 'onboarding-seen',
        type: 'workflow',
        position: {
          x: 360,
          y: 100,
        },
        data: {
          kind: 'fork',
          label: 'Guidance delivered before?',
          config: {
            conditionType: 'cookie',
            conditionKey: 'dxp_onboarding_delivered',
            conditionValue: 'yes',
          },
        },
        parentId: 'onboarding-entry',
      },
      {
        id: 'onboarding-return',
        type: 'workflow',
        position: {
          x: 360,
          y: 370,
        },
        data: {
          kind: 'dom',
          label: 'Welcome back',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Welcome back. Your collection is ready to explore.',
          },
        },
        parentId: 'onboarding-entry',
      },
      {
        id: 'onboarding-entry-note',
        type: 'workflow',
        position: {
          x: 30,
          y: 590,
        },
        parentId: 'onboarding-entry',
        data: {
          kind: 'note',
          label: 'Setup: Frames and retesting',
          config: {
            noteText:
              'Frames group recognition, guidance, and delivery stages. Notes are disconnected annotations. Cookie/storage matches may classify a visitor as returning; clear all matching keys to retest.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'onboarding-campaign',
        type: 'workflow',
        position: {
          x: 30,
          y: 100,
        },
        data: {
          kind: 'fork',
          label: 'Onboarding campaign?',
          config: {
            conditionType: 'query-param',
            conditionKey: 'utm_campaign',
            conditionValue: 'onboarding',
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-campaign-copy',
        type: 'workflow',
        position: {
          x: 360,
          y: 100,
        },
        data: {
          kind: 'dom',
          label: 'Onboarding message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Welcome to your onboarding. Start with the collection and get to know Atelier.',
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-default-copy',
        type: 'workflow',
        position: {
          x: 360,
          y: 500,
        },
        data: {
          kind: 'dom',
          label: 'Discovery message',
          config: {
            selector: '.hero .description',
            action: 'text',
            value: 'Welcome. Discover natural materials and thoughtful details.',
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-campaign-delay',
        type: 'workflow',
        position: {
          x: 690,
          y: 100,
        },
        data: {
          kind: 'delay',
          label: 'Settle in for 1.5 seconds',
          config: {
            duration: 1500,
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-default-delay',
        type: 'workflow',
        position: {
          x: 690,
          y: 500,
        },
        data: {
          kind: 'delay',
          label: 'Settle in for 2 seconds',
          config: {
            duration: 2000,
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-campaign-help',
        type: 'workflow',
        position: {
          x: 690,
          y: 300,
        },
        data: {
          kind: 'popover',
          label: 'Explore your onboarding',
          config: {
            contentType: 'html',
            content:
              '<style>[data-visual-dxp-popover="onboarding-campaign-help"] > button { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">🌿</span> Start here to explore the collection.</p>',
            position: 'anchor',
            width: 240,
            selector: '#shop-now',
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-default-help',
        type: 'workflow',
        position: {
          x: 690,
          y: 700,
        },
        data: {
          kind: 'popover',
          label: 'Start with the collection',
          config: {
            contentType: 'html',
            content:
              '<style>[data-visual-dxp-popover="onboarding-default-help"] > button { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">🌿</span> Browse all objects in the collection.</p>',
            position: 'anchor',
            width: 240,
            selector: '#shop-now',
          },
        },
        parentId: 'onboarding-guidance',
      },
      {
        id: 'onboarding-guidance-note',
        type: 'workflow',
        position: {
          x: 30,
          y: 740,
        },
        parentId: 'onboarding-guidance',
        data: {
          kind: 'note',
          label: 'Setup: Guidance targets',
          config: {
            noteText:
              'Uses .hero .description, #shop-now, and #collection. Test with and without ?utm_campaign=onboarding. Guidance anchors must exist when the delays finish.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'onboarding-event',
        type: 'workflow',
        position: {
          x: 30,
          y: 100,
        },
        data: {
          kind: 'http',
          label: 'Record guidance displayed',
          config: {
            method: 'POST',
            url: 'https://events.example.invalid/dxp-events',
            headers: '{"Content-Type":"application/json"}',
            body: '{"event":"onboarding_guidance_displayed"}',
          },
        },
        parentId: 'onboarding-record',
      },
      {
        id: 'onboarding-cookie',
        type: 'workflow',
        position: {
          x: 360,
          y: 100,
        },
        data: {
          kind: 'cookie',
          label: 'Mark delivery complete',
          config: {
            cookieName: 'dxp_onboarding_delivered',
            cookieValue: 'yes',
            cookieDays: 30,
          },
        },
        parentId: 'onboarding-record',
      },
      {
        id: 'onboarding-record-note',
        type: 'workflow',
        position: {
          x: 30,
          y: 370,
        },
        parentId: 'onboarding-record',
        data: {
          kind: 'note',
          label: 'Setup: Event endpoint',
          config: {
            noteText:
              'Replace https://events.example.invalid/dxp-events with your own mock or event endpoint before running. Accept POST JSON with Content-Type: application/json and return 2xx; configure CORS if cross-origin. The reserved .invalid placeholder has no service.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'onboarding-marker-note',
        type: 'workflow',
        position: {
          x: 360,
          y: 370,
        },
        parentId: 'onboarding-record',
        data: {
          kind: 'note',
          label: 'Setup: Delivery marker',
          config: {
            noteText:
              'dxp_onboarding_delivered=yes lasts 30 days. True skips guidance and HTTP; false chooses one campaign branch. The generic POST body is {"event":"onboarding_guidance_displayed"}.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'onboarding-completion-note',
        type: 'workflow',
        position: {
          x: 30,
          y: 800,
        },
        parentId: 'onboarding-record',
        data: {
          kind: 'note',
          label: 'Setup: Completion meaning',
          config: {
            noteText:
              'Completion means DOM copy updated, guidance rendered, and HTTP returned 2xx. It does not observe reading, dismissal, link clicks, signup, purchase, or server persistence. An HTTP failure leaves no completion cookie.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'segmented-onboarding-overview',
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
              'Segmented onboarding journey\n\nRecognize prior visits; for new visitors, tailor guidance by campaign and record successful guidance delivery.',
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
        id: 'onboarding-load-to-onboarding-seen',
        source: 'onboarding-load',
        target: 'onboarding-seen',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-seen-to-onboarding-return',
        source: 'onboarding-seen',
        target: 'onboarding-return',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Returning',
      },
      {
        id: 'onboarding-seen-to-onboarding-campaign',
        source: 'onboarding-seen',
        target: 'onboarding-campaign',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'First guidance',
      },
      {
        id: 'onboarding-campaign-to-onboarding-campaign-copy',
        source: 'onboarding-campaign',
        target: 'onboarding-campaign-copy',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Onboarding',
      },
      {
        id: 'onboarding-campaign-to-onboarding-default-copy',
        source: 'onboarding-campaign',
        target: 'onboarding-default-copy',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'Other visitors',
      },
      {
        id: 'onboarding-campaign-copy-to-onboarding-campaign-delay',
        source: 'onboarding-campaign-copy',
        target: 'onboarding-campaign-delay',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-campaign-delay-to-onboarding-campaign-help',
        source: 'onboarding-campaign-delay',
        target: 'onboarding-campaign-help',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-default-copy-to-onboarding-default-delay',
        source: 'onboarding-default-copy',
        target: 'onboarding-default-delay',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-default-delay-to-onboarding-default-help',
        source: 'onboarding-default-delay',
        target: 'onboarding-default-help',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-campaign-help-to-onboarding-event',
        source: 'onboarding-campaign-help',
        target: 'onboarding-event',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-default-help-to-onboarding-event',
        source: 'onboarding-default-help',
        target: 'onboarding-event',
        type: 'smoothstep',
      },
      {
        id: 'onboarding-event-to-onboarding-cookie',
        source: 'onboarding-event',
        target: 'onboarding-cookie',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
