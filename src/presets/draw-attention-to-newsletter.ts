import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createDrawAttentionToNewsletterPreset(
  messages: PresetMessages = englishPresetMessages,
) {
  return {
    id: 'click-to-open-help',
    name: messages['click-to-open-help.name'],
    description: messages['click-to-open-help.description'],
    complexity: 'beginner',
    order: 10,
    tags: ['trigger', 'fork', 'popover', 'note'],
    workflow: {
      version: 1,
      name: messages['click-to-open-help.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'help-load',
          type: 'workflow',
          position: {
            x: 60,
            y: 180,
          },
          data: {
            kind: 'trigger',
            label: messages['click-to-open-help.workflow.nodes.help-load.data.label'],
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'help-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 180,
          },
          data: {
            kind: 'fork',
            label: messages['click-to-open-help.workflow.nodes.help-check.data.label'],
            config: {
              conditionType: 'selector',
              condition: '#newsletter form',
            },
          },
        },
        {
          id: 'help-popover',
          type: 'workflow',
          position: {
            x: 740,
            y: 180,
          },
          data: {
            kind: 'popover',
            label: messages['click-to-open-help.workflow.nodes.help-popover.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['click-to-open-help.workflow.nodes.help-popover.data.config.content'],
              position: 'anchor',
              width: 240,
              selector: '#newsletter form',
            },
          },
        },
        {
          id: 'click-to-open-help-setup-1',
          type: 'workflow',
          position: {
            x: 400,
            y: 460,
          },
          data: {
            kind: 'note',
            label:
              messages['click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.label'],
            config: {
              noteText:
                messages[
                  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'click-to-open-help-setup-2',
          type: 'workflow',
          position: {
            x: 740,
            y: 460,
          },
          data: {
            kind: 'note',
            label:
              messages['click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.label'],
            config: {
              noteText:
                messages[
                  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'click-to-open-help-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages['click-to-open-help.workflow.nodes.click-to-open-help-overview.data.label'],
            config: {
              noteText:
                messages[
                  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'help-load-to-help-check',
          source: 'help-load',
          target: 'help-check',
          type: 'smoothstep',
        },
        {
          id: 'help-check-to-help-popover',
          source: 'help-check',
          target: 'help-popover',
          sourceHandle: 'true',
          label: messages['click-to-open-help.workflow.edges.help-check-to-help-popover.label'],
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const drawAttentionToNewsletterPreset = createDrawAttentionToNewsletterPreset();
