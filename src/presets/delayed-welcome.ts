import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createDelayedWelcomePreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'delayed-welcome',
    name: messages['delayed-welcome.name'],
    description: messages['delayed-welcome.description'],
    complexity: 'beginner',
    order: 20,
    tags: ['trigger', 'delay', 'popover', 'note'],
    workflow: {
      version: 1,
      name: messages['delayed-welcome.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'welcome-load',
          type: 'workflow',
          position: {
            x: 60,
            y: 180,
          },
          data: {
            kind: 'trigger',
            label: messages['delayed-welcome.workflow.nodes.welcome-load.data.label'],
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'welcome-delay',
          type: 'workflow',
          position: {
            x: 400,
            y: 180,
          },
          data: {
            kind: 'delay',
            label: messages['delayed-welcome.workflow.nodes.welcome-delay.data.label'],
            config: {
              duration: 2000,
            },
          },
        },
        {
          id: 'welcome-popover',
          type: 'workflow',
          position: {
            x: 740,
            y: 180,
          },
          data: {
            kind: 'popover',
            label: messages['delayed-welcome.workflow.nodes.welcome-popover.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['delayed-welcome.workflow.nodes.welcome-popover.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'delayed-welcome-setup-1',
          type: 'workflow',
          position: {
            x: 740,
            y: 460,
          },
          data: {
            kind: 'note',
            label: messages['delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.label'],
            config: {
              noteText:
                messages[
                  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'delayed-welcome-setup-2',
          type: 'workflow',
          position: {
            x: 400,
            y: 460,
          },
          data: {
            kind: 'note',
            label: messages['delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.label'],
            config: {
              noteText:
                messages[
                  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'delayed-welcome-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label: messages['delayed-welcome.workflow.nodes.delayed-welcome-overview.data.label'],
            config: {
              noteText:
                messages[
                  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
              noteMarks: [
                {
                  start: 0,
                  end: messages['delayed-welcome.name'].length,
                  bold: true,
                },
              ],
            },
          },
        },
      ],
      edges: [
        {
          id: 'welcome-load-to-welcome-delay',
          source: 'welcome-load',
          target: 'welcome-delay',
          type: 'smoothstep',
        },
        {
          id: 'welcome-delay-to-welcome-popover',
          source: 'welcome-delay',
          target: 'welcome-popover',
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const delayedWelcomePreset = createDelayedWelcomePreset();
