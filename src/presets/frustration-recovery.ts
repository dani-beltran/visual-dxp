import type { WorkflowPreset } from '../lib/types';

export const frustrationRecoveryPreset = {
  id: 'frustration-recovery',
  name: 'Frustration recovery',
  description:
    'Offer browsing assistance after repeated nearby clicks and record a generic assistance event.',
  complexity: 'advanced',
  order: 100,
  tags: ['trigger', 'fork', 'popover', 'http', 'cookie', 'note'],
  workflow: {
    version: 1,
    name: 'Frustration recovery',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'recovery-trigger',
        type: 'workflow',
        position: {
          x: 60,
          y: 180,
        },
        data: {
          kind: 'trigger',
          label: 'Three nearby clicks',
          config: {
            event: 'rage-click',
            rageClickCount: 3,
            rageClickWindow: 1000,
            rageClickRadius: 40,
          },
        },
      },
      {
        id: 'recovery-check',
        type: 'workflow',
        position: {
          x: 400,
          y: 180,
        },
        data: {
          kind: 'fork',
          label: 'Assistance already shown?',
          config: {
            conditionType: 'cookie',
            conditionKey: 'dxp_assistance_shown',
            conditionValue: 'shown',
          },
        },
      },
      {
        id: 'recovery-help',
        type: 'workflow',
        position: {
          x: 740,
          y: 300,
        },
        data: {
          kind: 'popover',
          label: 'A little browsing help',
          config: {
            contentType: 'html',
            content:
              '<h2>Having trouble exploring?</h2><p>Try the collection navigation, or take a break and return when you are ready.</p><a href="#collection">View the collection</a>',
            position: 'bottom-right',
            width: 340,
          },
        },
      },
      {
        id: 'recovery-event',
        type: 'workflow',
        position: {
          x: 1080,
          y: 300,
        },
        data: {
          kind: 'http',
          label: 'Record assistance shown',
          config: {
            method: 'POST',
            url: 'https://events.example.invalid/dxp-events',
            headers: '{"Content-Type":"application/json"}',
            body: '{"event":"assistance_shown"}',
          },
        },
      },
      {
        id: 'recovery-cookie',
        type: 'workflow',
        position: {
          x: 1420,
          y: 300,
        },
        data: {
          kind: 'cookie',
          label: 'Remember assistance shown',
          config: {
            cookieName: 'dxp_assistance_shown',
            cookieValue: 'shown',
            cookieDays: 0,
          },
        },
      },
      {
        id: 'frustration-recovery-setup-1',
        type: 'workflow',
        position: {
          x: 1080,
          y: 600,
        },
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
        id: 'frustration-recovery-setup-2',
        type: 'workflow',
        position: {
          x: 1420,
          y: 600,
        },
        data: {
          kind: 'note',
          label: 'Setup: Generic event only',
          config: {
            noteText:
              'The body is only {"event":"assistance_shown"}. Do not add personal data, page URLs, form values, credentials, or identifiers. This is not an analytics integration or support ticket.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'frustration-recovery-setup-3',
        type: 'workflow',
        position: {
          x: 60,
          y: 600,
        },
        data: {
          kind: 'note',
          label: 'Setup: Rage-click scope',
          config: {
            noteText:
              'Rage clicks are detected across the document, not scoped by a selector. Uses #collection in the support copy.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'frustration-recovery-setup-4',
        type: 'workflow',
        position: {
          x: 400,
          y: 600,
        },
        data: {
          kind: 'note',
          label: 'Setup: Frequency limits',
          config: {
            noteText:
              'dxp_assistance_shown is a session cookie written after HTTP success. Failure stops before the cookie; concurrent triggers before the response can repeat requests. This is best-effort frequency control, not an atomic rate limit.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'frustration-recovery-overview',
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
              'Frustration recovery\n\nOffer browsing assistance after repeated nearby clicks and record a generic assistance event.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 20,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'recovery-trigger-to-recovery-check',
        source: 'recovery-trigger',
        target: 'recovery-check',
        type: 'smoothstep',
      },
      {
        id: 'recovery-check-to-recovery-help',
        source: 'recovery-check',
        target: 'recovery-help',
        type: 'smoothstep',
        sourceHandle: 'false',
        label: 'Not yet shown',
      },
      {
        id: 'recovery-help-to-recovery-event',
        source: 'recovery-help',
        target: 'recovery-event',
        type: 'smoothstep',
      },
      {
        id: 'recovery-event-to-recovery-cookie',
        source: 'recovery-event',
        target: 'recovery-cookie',
        type: 'smoothstep',
      },
    ],
  },
} satisfies WorkflowPreset;
