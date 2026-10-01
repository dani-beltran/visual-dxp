import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createContextualSupportPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'contextual-support',
    name: messages['contextual-support.name'],
    description: messages['contextual-support.description'],
    complexity: 'intermediate',
    order: 95,
    tags: ['trigger', 'fork', 'popover', 'note'],
    workflow: {
      version: 1,
      name: messages['contextual-support.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'support-hover',
          type: 'workflow',
          position: {
            x: 60,
            y: 230,
          },
          data: {
            kind: 'trigger',
            label: messages['contextual-support.workflow.nodes.support-hover.data.label'],
            config: {
              event: 'mouseover',
              selector: '#support-help',
            },
          },
        },
        {
          id: 'support-hours',
          type: 'workflow',
          position: {
            x: 400,
            y: 230,
          },
          data: {
            kind: 'fork',
            label: messages['contextual-support.workflow.nodes.support-hours.data.label'],
            config: {
              conditionType: 'time-of-day',
              conditionStartTime: '09:00',
              conditionEndTime: '16:59',
              conditionTimeZone: 'utc',
            },
          },
        },
        {
          id: 'support-online',
          type: 'workflow',
          position: {
            x: 740,
            y: 60,
          },
          data: {
            kind: 'popover',
            label: messages['contextual-support.workflow.nodes.support-online.data.label'],
            config: {
              contentType: 'iframe',
              url: 'https://support.example.invalid/help',
              position: 'bottom-right',
              width: 400,
            },
          },
        },
        {
          id: 'support-offline',
          type: 'workflow',
          position: {
            x: 740,
            y: 400,
          },
          data: {
            kind: 'popover',
            label: messages['contextual-support.workflow.nodes.support-offline.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['contextual-support.workflow.nodes.support-offline.data.config.content'],
              position: 'bottom-right',
              width: 400,
            },
          },
        },
        {
          id: 'support-trigger-note',
          type: 'workflow',
          position: {
            x: 60,
            y: 680,
          },
          data: {
            kind: 'note',
            label: messages['contextual-support.workflow.nodes.support-trigger-note.data.label'],
            config: {
              noteText:
                messages[
                  'contextual-support.workflow.nodes.support-trigger-note.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'support-hours-note',
          type: 'workflow',
          position: {
            x: 400,
            y: 680,
          },
          data: {
            kind: 'note',
            label: messages['contextual-support.workflow.nodes.support-hours-note.data.label'],
            config: {
              noteText:
                messages[
                  'contextual-support.workflow.nodes.support-hours-note.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'support-embed-note',
          type: 'workflow',
          position: {
            x: 740,
            y: 680,
          },
          data: {
            kind: 'note',
            label: messages['contextual-support.workflow.nodes.support-embed-note.data.label'],
            config: {
              noteText:
                messages[
                  'contextual-support.workflow.nodes.support-embed-note.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'contextual-support-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages['contextual-support.workflow.nodes.contextual-support-overview.data.label'],
            config: {
              noteText:
                messages[
                  'contextual-support.workflow.nodes.contextual-support-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'support-hover-to-support-hours',
          source: 'support-hover',
          target: 'support-hours',
          type: 'smoothstep',
        },
        {
          id: 'support-hours-to-support-online',
          source: 'support-hours',
          target: 'support-online',
          type: 'smoothstep',
          sourceHandle: 'true',
          label:
            messages['contextual-support.workflow.edges.support-hours-to-support-online.label'],
        },
        {
          id: 'support-hours-to-support-offline',
          source: 'support-hours',
          target: 'support-offline',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages['contextual-support.workflow.edges.support-hours-to-support-offline.label'],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const contextualSupportPreset = createContextualSupportPreset();
