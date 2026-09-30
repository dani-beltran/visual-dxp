import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createCampaignUrlPersonalizationPreset(
  messages: PresetMessages = englishPresetMessages,
) {
  return {
    id: 'campaign-url-personalization',
    name: messages['campaign-url-personalization.name'],
    description: messages['campaign-url-personalization.description'],
    complexity: 'intermediate',
    order: 60,
    tags: ['trigger', 'fork', 'dom', 'note'],
    workflow: {
      version: 1,
      name: messages['campaign-url-personalization.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'campaign-load',
          type: 'workflow',
          position: {
            x: 60,
            y: 230,
          },
          data: {
            kind: 'trigger',
            label: messages['campaign-url-personalization.workflow.nodes.campaign-load.data.label'],
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'campaign-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 230,
          },
          data: {
            kind: 'fork',
            label:
              messages['campaign-url-personalization.workflow.nodes.campaign-check.data.label'],
            config: {
              conditionType: 'query-param',
              conditionKey: 'utm_campaign',
              conditionValue: 'everyday-edit',
            },
          },
        },
        {
          id: 'campaign-matched',
          type: 'workflow',
          position: {
            x: 740,
            y: 60,
          },
          data: {
            kind: 'dom',
            label:
              messages['campaign-url-personalization.workflow.nodes.campaign-matched.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'campaign-url-personalization.workflow.nodes.campaign-matched.data.config.value'
                ],
            },
          },
        },
        {
          id: 'campaign-default',
          type: 'workflow',
          position: {
            x: 740,
            y: 400,
          },
          data: {
            kind: 'dom',
            label:
              messages['campaign-url-personalization.workflow.nodes.campaign-default.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'campaign-url-personalization.workflow.nodes.campaign-default.data.config.value'
                ],
            },
          },
        },
        {
          id: 'campaign-url-personalization-setup-1',
          type: 'workflow',
          position: {
            x: 400,
            y: 680,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'campaign-url-personalization-setup-2',
          type: 'workflow',
          position: {
            x: 740,
            y: 680,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.label'
              ],
            config: {
              noteText:
                messages[
                  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'campaign-url-personalization-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
              noteMarks: [
                {
                  start: 0,
                  end: messages['campaign-url-personalization.name'].length,
                  bold: true,
                },
              ],
            },
          },
        },
      ],
      edges: [
        {
          id: 'campaign-load-to-campaign-check',
          source: 'campaign-load',
          target: 'campaign-check',
          type: 'smoothstep',
        },
        {
          id: 'campaign-check-to-campaign-matched',
          source: 'campaign-check',
          target: 'campaign-matched',
          type: 'smoothstep',
          sourceHandle: 'true',
          label:
            messages[
              'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-matched.label'
            ],
        },
        {
          id: 'campaign-check-to-campaign-default',
          source: 'campaign-check',
          target: 'campaign-default',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages[
              'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-default.label'
            ],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const campaignUrlPersonalizationPreset = createCampaignUrlPersonalizationPreset();
