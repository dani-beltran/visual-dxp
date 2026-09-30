import type { WorkflowPreset } from '../lib/types';

// Resolve the current Monday–Sunday week once when this module loads.
// Store date strings in the preset so applied/exported workflows remain serializable.
const weekStart = new Date();
weekStart.setUTCHours(0, 0, 0, 0);
weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

export const campaignHeadlinePreset = {
  id: 'campaign-headline',
  name: 'Campaign headline',
  description:
    'Replace the hero headline during the current UTC week, Monday through Sunday; leave it unchanged otherwise.',
  complexity: 'beginner',
  order: 30,
  tags: ['trigger', 'fork', 'dom', 'note'],
  workflow: {
    version: 1,
    name: 'Campaign headline',
    websiteUrl: '/demo-site.html',
    includeSubpages: false,
    nodes: [
      {
        id: 'headline-load',
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
        id: 'headline-day',
        type: 'workflow',
        position: {
          x: 400,
          y: 180,
        },
        data: {
          kind: 'fork',
          label: 'Campaign week (UTC)?',
          config: {
            conditionType: 'date-range',
            conditionStartDate: weekStart.toISOString().slice(0, 10),
            conditionEndDate: weekEnd.toISOString().slice(0, 10),
            conditionTimeZone: 'utc',
          },
        },
      },
      {
        id: 'headline-update',
        type: 'workflow',
        position: {
          x: 740,
          y: 80,
        },
        data: {
          kind: 'dom',
          label: 'Show campaign headline',
          config: {
            selector: '.hero h1',
            action: 'text',
            value: 'A new season of everyday favorites.',
          },
        },
      },
      {
        id: 'campaign-headline-setup-1',
        type: 'workflow',
        position: {
          x: 400,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Campaign week',
          config: {
            noteText:
              'Uses the current UTC week (Monday–Sunday), calculated when this preset module loads. Reload the app to refresh; applied or exported workflows keep their saved dates. You can edit either date.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'campaign-headline-setup-2',
        type: 'workflow',
        position: {
          x: 740,
          y: 460,
        },
        data: {
          kind: 'note',
          label: 'Setup: Headline target',
          config: {
            noteText:
              'Uses .hero h1. Text replacement removes its nested markup. The false output intentionally ends without changing the page.',
            noteColor: '#fff4b8',
          },
        },
      },
      {
        id: 'campaign-headline-overview',
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
              'Campaign headline\n\nReplace the hero headline during the current UTC week, Monday through Sunday; leave it unchanged otherwise.',
            noteColor: '#def0d8',
            noteMarks: [
              {
                start: 0,
                end: 17,
                bold: true,
              },
            ],
          },
        },
      },
    ],
    edges: [
      {
        id: 'headline-load-to-headline-day',
        source: 'headline-load',
        target: 'headline-day',
        type: 'smoothstep',
      },
      {
        id: 'headline-day-to-headline-update',
        source: 'headline-day',
        target: 'headline-update',
        type: 'smoothstep',
        sourceHandle: 'true',
        label: 'Campaign week',
      },
    ],
  },
} satisfies WorkflowPreset;
