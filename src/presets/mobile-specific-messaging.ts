import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createMobileSpecificMessagingPreset(
  messages: PresetMessages = englishPresetMessages,
) {
  return {
    id: 'mobile-specific-messaging',
    name: messages['mobile-specific-messaging.name'],
    description: messages['mobile-specific-messaging.description'],
    complexity: 'intermediate',
    order: 50,
    tags: ['trigger', 'fork', 'dom', 'note'],
    workflow: {
      version: 1,
      name: messages['mobile-specific-messaging.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'device-load',
          type: 'workflow',
          position: {
            x: 60,
            y: 230,
          },
          data: {
            kind: 'trigger',
            label: messages['mobile-specific-messaging.workflow.nodes.device-load.data.label'],
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'device-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 230,
          },
          data: {
            kind: 'fork',
            label: messages['mobile-specific-messaging.workflow.nodes.device-check.data.label'],
            config: {
              conditionType: 'device',
              conditionValue: 'mobile',
            },
          },
        },
        {
          id: 'device-mobile',
          type: 'workflow',
          position: {
            x: 740,
            y: 60,
          },
          data: {
            kind: 'dom',
            label: messages['mobile-specific-messaging.workflow.nodes.device-mobile.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'mobile-specific-messaging.workflow.nodes.device-mobile.data.config.value'
                ],
            },
          },
        },
        {
          id: 'device-desktop',
          type: 'workflow',
          position: {
            x: 740,
            y: 400,
          },
          data: {
            kind: 'dom',
            label: messages['mobile-specific-messaging.workflow.nodes.device-desktop.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'mobile-specific-messaging.workflow.nodes.device-desktop.data.config.value'
                ],
            },
          },
        },
        {
          id: 'mobile-specific-messaging-setup-1',
          type: 'workflow',
          position: {
            x: 400,
            y: 680,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'mobile-specific-messaging-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'device-load-to-device-check',
          source: 'device-load',
          target: 'device-check',
          type: 'smoothstep',
        },
        {
          id: 'device-check-to-device-mobile',
          source: 'device-check',
          target: 'device-mobile',
          type: 'smoothstep',
          sourceHandle: 'true',
          label:
            messages[
              'mobile-specific-messaging.workflow.edges.device-check-to-device-mobile.label'
            ],
        },
        {
          id: 'device-check-to-device-desktop',
          source: 'device-check',
          target: 'device-desktop',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages[
              'mobile-specific-messaging.workflow.edges.device-check-to-device-desktop.label'
            ],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const mobileSpecificMessagingPreset = createMobileSpecificMessagingPreset();
