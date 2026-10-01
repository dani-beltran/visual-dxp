import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createBoundedCtaAttentionPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'bounded-cta-attention',
    name: messages['bounded-cta-attention.name'],
    description: messages['bounded-cta-attention.description'],
    complexity: 'advanced',
    order: 110,
    tags: ['trigger', 'loop', 'dom', 'delay', 'popover', 'note'],
    workflow: {
      version: 1,
      name: messages['bounded-cta-attention.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'attention-click',
          type: 'workflow',
          position: {
            x: 60,
            y: 240,
          },
          data: {
            kind: 'trigger',
            label: messages['bounded-cta-attention.workflow.nodes.attention-click.data.label'],
            config: {
              event: 'click',
              selector: '#shop-now',
            },
          },
        },
        {
          id: 'attention-loop',
          type: 'workflow',
          position: {
            x: 400,
            y: 240,
          },
          data: {
            kind: 'loop',
            label: messages['bounded-cta-attention.workflow.nodes.attention-loop.data.label'],
            config: {
              iterations: 2,
            },
          },
        },
        {
          id: 'attention-add',
          type: 'workflow',
          position: {
            x: 740,
            y: 60,
          },
          data: {
            kind: 'dom',
            label: messages['bounded-cta-attention.workflow.nodes.attention-add.data.label'],
            config: {
              selector: '#collection > div:nth-of-type(2)',
              action: 'add-class',
              value: 'dxp-cta-attention',
            },
          },
        },
        {
          id: 'attention-on',
          type: 'workflow',
          position: {
            x: 1080,
            y: 60,
          },
          data: {
            kind: 'delay',
            label: messages['bounded-cta-attention.workflow.nodes.attention-on.data.label'],
            config: {
              duration: 600,
            },
          },
        },
        {
          id: 'attention-remove',
          type: 'workflow',
          position: {
            x: 1420,
            y: 60,
          },
          data: {
            kind: 'dom',
            label: messages['bounded-cta-attention.workflow.nodes.attention-remove.data.label'],
            config: {
              selector: '#collection > div:nth-of-type(2)',
              action: 'remove-class',
              value: 'dxp-cta-attention',
            },
          },
        },
        {
          id: 'attention-off',
          type: 'workflow',
          position: {
            x: 1760,
            y: 60,
          },
          data: {
            kind: 'delay',
            label: messages['bounded-cta-attention.workflow.nodes.attention-off.data.label'],
            config: {
              duration: 600,
            },
          },
        },
        {
          id: 'attention-done',
          type: 'workflow',
          position: {
            x: 740,
            y: 500,
          },
          data: {
            kind: 'popover',
            label: messages['bounded-cta-attention.workflow.nodes.attention-done.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['bounded-cta-attention.workflow.nodes.attention-done.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'bounded-cta-attention-setup-1',
          type: 'workflow',
          position: {
            x: 1080,
            y: 360,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'bounded-cta-attention-setup-2',
          type: 'workflow',
          position: {
            x: 400,
            y: 800,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.label'
              ],
            config: {
              noteText:
                messages[
                  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'bounded-cta-attention-setup-3',
          type: 'workflow',
          position: {
            x: 740,
            y: 800,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.label'
              ],
            config: {
              noteText:
                messages[
                  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'bounded-cta-attention-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'attention-click-to-attention-loop',
          source: 'attention-click',
          target: 'attention-loop',
          type: 'smoothstep',
        },
        {
          id: 'attention-loop-to-attention-add',
          source: 'attention-loop',
          target: 'attention-add',
          type: 'smoothstep',
          sourceHandle: 'body',
          label:
            messages['bounded-cta-attention.workflow.edges.attention-loop-to-attention-add.label'],
        },
        {
          id: 'attention-add-to-attention-on',
          source: 'attention-add',
          target: 'attention-on',
          type: 'smoothstep',
        },
        {
          id: 'attention-on-to-attention-remove',
          source: 'attention-on',
          target: 'attention-remove',
          type: 'smoothstep',
        },
        {
          id: 'attention-remove-to-attention-off',
          source: 'attention-remove',
          target: 'attention-off',
          type: 'smoothstep',
        },
        {
          id: 'attention-loop-to-attention-done',
          source: 'attention-loop',
          target: 'attention-done',
          type: 'smoothstep',
          sourceHandle: 'done',
          label:
            messages['bounded-cta-attention.workflow.edges.attention-loop-to-attention-done.label'],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const boundedCtaAttentionPreset = createBoundedCtaAttentionPreset();
