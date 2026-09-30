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
            content:
              '<h2>Welcome to Atelier</h2><p>Start with the everyday collection and discover objects made to be kept.</p><a href="#collection">Explore the collection</a>',
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
