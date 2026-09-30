import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createExitIntentOfferPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'exit-intent-offer',
    name: messages['exit-intent-offer.name'],
    description: messages['exit-intent-offer.description'],
    complexity: 'intermediate',
    order: 70,
    tags: ['trigger', 'fork', 'popover', 'cookie', 'note'],
    workflow: {
      version: 1,
      name: messages['exit-intent-offer.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'exit-trigger',
          type: 'workflow',
          position: {
            x: 60,
            y: 180,
          },
          data: {
            kind: 'trigger',
            label: messages['exit-intent-offer.workflow.nodes.exit-trigger.data.label'],
            config: {
              event: 'exit-intent',
            },
          },
        },
        {
          id: 'exit-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 180,
          },
          data: {
            kind: 'fork',
            label: messages['exit-intent-offer.workflow.nodes.exit-check.data.label'],
            config: {
              conditionType: 'cookie',
              conditionKey: 'dxp_exit_offer',
              conditionValue: 'shown',
            },
          },
        },
        {
          id: 'exit-popover',
          type: 'workflow',
          position: {
            x: 740,
            y: 300,
          },
          data: {
            kind: 'popover',
            label: messages['exit-intent-offer.workflow.nodes.exit-popover.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['exit-intent-offer.workflow.nodes.exit-popover.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'exit-cookie',
          type: 'workflow',
          position: {
            x: 1080,
            y: 300,
          },
          data: {
            kind: 'cookie',
            label: messages['exit-intent-offer.workflow.nodes.exit-cookie.data.label'],
            config: {
              cookieName: 'dxp_exit_offer',
              cookieValue: 'shown',
              cookieDays: 0,
            },
          },
        },
        {
          id: 'exit-intent-offer-setup-1',
          type: 'workflow',
          position: {
            x: 740,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages['exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.label'],
            config: {
              noteText:
                messages[
                  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'exit-intent-offer-setup-2',
          type: 'workflow',
          position: {
            x: 1080,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages['exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.label'],
            config: {
              noteText:
                messages[
                  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'exit-intent-offer-setup-3',
          type: 'workflow',
          position: {
            x: 60,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages['exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.label'],
            config: {
              noteText:
                messages[
                  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'exit-intent-offer-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages['exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.label'],
            config: {
              noteText:
                messages[
                  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
              noteMarks: [
                {
                  start: 0,
                  end: messages['exit-intent-offer.name'].length,
                  bold: true,
                },
              ],
            },
          },
        },
      ],
      edges: [
        {
          id: 'exit-trigger-to-exit-check',
          source: 'exit-trigger',
          target: 'exit-check',
          type: 'smoothstep',
        },
        {
          id: 'exit-check-to-exit-popover',
          source: 'exit-check',
          target: 'exit-popover',
          type: 'smoothstep',
          sourceHandle: 'false',
          label: messages['exit-intent-offer.workflow.edges.exit-check-to-exit-popover.label'],
        },
        {
          id: 'exit-popover-to-exit-cookie',
          source: 'exit-popover',
          target: 'exit-cookie',
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const exitIntentOfferPreset = createExitIntentOfferPreset();
