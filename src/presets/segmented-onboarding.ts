import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createSegmentedOnboardingPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'segmented-onboarding',
    name: messages['segmented-onboarding.name'],
    description: messages['segmented-onboarding.description'],
    complexity: 'advanced',
    order: 120,
    tags: ['frame', 'trigger', 'fork', 'dom', 'note', 'delay', 'popover', 'http', 'cookie'],
    workflow: {
      version: 1,
      name: messages['segmented-onboarding.workflow.name'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-entry.data.label'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-guidance.data.label'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-record.data.label'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-load.data.label'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-seen.data.label'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-return.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages['segmented-onboarding.workflow.nodes.onboarding-return.data.config.value'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-entry-note.data.label'],
            config: {
              noteText:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.config.noteText'
                ],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-campaign.data.label'],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-campaign-copy.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-campaign-copy.data.config.value'
                ],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-default-copy.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-default-copy.data.config.value'
                ],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-campaign-delay.data.label'],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-default-delay.data.label'],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-campaign-help.data.label'],
            config: {
              contentType: 'html',
              content:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-campaign-help.data.config.content'
                ],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-default-help.data.label'],
            config: {
              contentType: 'html',
              content:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-default-help.data.config.content'
                ],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.label'],
            config: {
              noteText:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.config.noteText'
                ],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-event.data.label'],
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
            label: messages['segmented-onboarding.workflow.nodes.onboarding-cookie.data.label'],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-record-note.data.label'],
            config: {
              noteText:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.config.noteText'
                ],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-marker-note.data.label'],
            config: {
              noteText:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.config.noteText'
                ],
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
            label:
              messages['segmented-onboarding.workflow.nodes.onboarding-completion-note.data.label'],
            config: {
              noteText:
                messages[
                  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.config.noteText'
                ],
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
            label:
              messages[
                'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
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
          label:
            messages[
              'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-return.label'
            ],
        },
        {
          id: 'onboarding-seen-to-onboarding-campaign',
          source: 'onboarding-seen',
          target: 'onboarding-campaign',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages[
              'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-campaign.label'
            ],
        },
        {
          id: 'onboarding-campaign-to-onboarding-campaign-copy',
          source: 'onboarding-campaign',
          target: 'onboarding-campaign-copy',
          type: 'smoothstep',
          sourceHandle: 'true',
          label:
            messages[
              'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-campaign-copy.label'
            ],
        },
        {
          id: 'onboarding-campaign-to-onboarding-default-copy',
          source: 'onboarding-campaign',
          target: 'onboarding-default-copy',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages[
              'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-default-copy.label'
            ],
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
}

export const segmentedOnboardingPreset = createSegmentedOnboardingPreset();
