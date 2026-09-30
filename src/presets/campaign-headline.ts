import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

// Resolve the current Monday–Sunday week once when this module loads.
// Store date strings in the preset so applied/exported workflows remain serializable.
const weekStart = new Date();
weekStart.setUTCHours(0, 0, 0, 0);
weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

export function createCampaignHeadlinePreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'campaign-headline',
    name: messages['campaign-headline.name'],
    description: messages['campaign-headline.description'],
    complexity: 'beginner',
    order: 30,
    tags: ['trigger', 'fork', 'dom', 'note'],
    workflow: {
      version: 1,
      name: messages['campaign-headline.workflow.name'],
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
            label: messages['campaign-headline.workflow.nodes.headline-load.data.label'],
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
            label: messages['campaign-headline.workflow.nodes.headline-day.data.label'],
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
            label: messages['campaign-headline.workflow.nodes.headline-update.data.label'],
            config: {
              selector: '.hero h1',
              action: 'text',
              value: messages['campaign-headline.workflow.nodes.headline-update.data.config.value'],
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
            label:
              messages['campaign-headline.workflow.nodes.campaign-headline-setup-1.data.label'],
            config: {
              noteText:
                messages[
                  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.config.noteText'
                ],
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
            label:
              messages['campaign-headline.workflow.nodes.campaign-headline-setup-2.data.label'],
            config: {
              noteText:
                messages[
                  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.config.noteText'
                ],
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
            label:
              messages['campaign-headline.workflow.nodes.campaign-headline-overview.data.label'],
            config: {
              noteText:
                messages[
                  'campaign-headline.workflow.nodes.campaign-headline-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
              noteMarks: [
                {
                  start: 0,
                  end: messages['campaign-headline.name'].length,
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
          label: messages['campaign-headline.workflow.edges.headline-day-to-headline-update.label'],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const campaignHeadlinePreset = createCampaignHeadlinePreset();
