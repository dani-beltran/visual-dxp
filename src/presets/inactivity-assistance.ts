import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createInactivityAssistancePreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'inactivity-assistance',
    name: messages['inactivity-assistance.name'],
    description: messages['inactivity-assistance.description'],
    complexity: 'intermediate',
    order: 90,
    tags: ['trigger', 'fork', 'delay', 'popover', 'note'],
    workflow: {
      version: 1,
      name: messages['inactivity-assistance.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'idle-trigger',
          type: 'workflow',
          position: {
            x: 60,
            y: 230,
          },
          data: {
            kind: 'trigger',
            label: messages['inactivity-assistance.workflow.nodes.idle-trigger.data.label'],
            config: {
              event: 'inactivity',
              duration: 30000,
            },
          },
        },
        {
          id: 'idle-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 230,
          },
          data: {
            kind: 'fork',
            label: messages['inactivity-assistance.workflow.nodes.idle-check.data.label'],
            config: {
              conditionType: 'selector',
              condition: '#newsletter form',
            },
          },
        },
        {
          id: 'idle-delay',
          type: 'workflow',
          position: {
            x: 740,
            y: 60,
          },
          data: {
            kind: 'delay',
            label: messages['inactivity-assistance.workflow.nodes.idle-delay.data.label'],
            config: {
              duration: 1000,
            },
          },
        },
        {
          id: 'idle-help',
          type: 'workflow',
          position: {
            x: 1080,
            y: 60,
          },
          data: {
            kind: 'popover',
            label: messages['inactivity-assistance.workflow.nodes.idle-help.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['inactivity-assistance.workflow.nodes.idle-help.data.config.content'],
              position: 'anchor',
              width: 240,
              selector: '#newsletter form',
            },
          },
        },
        {
          id: 'idle-fallback',
          type: 'workflow',
          position: {
            x: 740,
            y: 400,
          },
          data: {
            kind: 'popover',
            label: messages['inactivity-assistance.workflow.nodes.idle-fallback.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['inactivity-assistance.workflow.nodes.idle-fallback.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'inactivity-assistance-setup-1',
          type: 'workflow',
          position: {
            x: 400,
            y: 700,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'inactivity-assistance-setup-2',
          type: 'workflow',
          position: {
            x: 740,
            y: 700,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.label'
              ],
            config: {
              noteText:
                messages[
                  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'inactivity-assistance-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
              noteMarks: [
                {
                  start: 0,
                  end: messages['inactivity-assistance.name'].length,
                  bold: true,
                },
              ],
            },
          },
        },
      ],
      edges: [
        {
          id: 'idle-trigger-to-idle-check',
          source: 'idle-trigger',
          target: 'idle-check',
          type: 'smoothstep',
        },
        {
          id: 'idle-check-to-idle-delay',
          source: 'idle-check',
          target: 'idle-delay',
          type: 'smoothstep',
          sourceHandle: 'true',
          label: messages['inactivity-assistance.workflow.edges.idle-check-to-idle-delay.label'],
        },
        {
          id: 'idle-delay-to-idle-help',
          source: 'idle-delay',
          target: 'idle-help',
          type: 'smoothstep',
        },
        {
          id: 'idle-check-to-idle-fallback',
          source: 'idle-check',
          target: 'idle-fallback',
          type: 'smoothstep',
          sourceHandle: 'false',
          label: messages['inactivity-assistance.workflow.edges.idle-check-to-idle-fallback.label'],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const inactivityAssistancePreset = createInactivityAssistancePreset();
