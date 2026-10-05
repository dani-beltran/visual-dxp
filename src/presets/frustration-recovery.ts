import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createFrustrationRecoveryPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'frustration-recovery',
    name: messages['frustration-recovery.name'],
    description: messages['frustration-recovery.description'],
    complexity: 'advanced',
    order: 100,
    tags: ['trigger', 'fork', 'popover', 'http', 'cookie', 'note'],
    workflow: {
      version: 1,
      name: messages['frustration-recovery.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'recovery-trigger',
          type: 'workflow',
          position: {
            x: 60,
            y: 180,
          },
          data: {
            kind: 'trigger',
            label: messages['frustration-recovery.workflow.nodes.recovery-trigger.data.label'],
            config: {
              event: 'rage-click',
              rageClickCount: 3,
              rageClickWindow: 1000,
              rageClickRadius: 40,
            },
          },
        },
        {
          id: 'recovery-scroll-trigger',
          type: 'workflow',
          position: {
            x: 60,
            y: 360,
          },
          data: {
            kind: 'trigger',
            label:
              messages['frustration-recovery.workflow.nodes.recovery-scroll-trigger.data.label'],
            config: {
              event: 'scroll-thrashing',
              scrollDirectionChanges: 4,
              scrollThrashWindow: 2000,
              scrollMinDistance: 50,
            },
          },
        },
        {
          id: 'recovery-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 180,
          },
          data: {
            kind: 'fork',
            label: messages['frustration-recovery.workflow.nodes.recovery-check.data.label'],
            config: {
              conditionType: 'cookie',
              conditionKey: 'dxp_assistance_shown',
              conditionValue: 'shown',
            },
          },
        },
        {
          id: 'recovery-help',
          type: 'workflow',
          position: {
            x: 740,
            y: 300,
          },
          data: {
            kind: 'popover',
            label: messages['frustration-recovery.workflow.nodes.recovery-help.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['frustration-recovery.workflow.nodes.recovery-help.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'recovery-event',
          type: 'workflow',
          position: {
            x: 1080,
            y: 300,
          },
          data: {
            kind: 'http',
            label: messages['frustration-recovery.workflow.nodes.recovery-event.data.label'],
            config: {
              method: 'POST',
              url: 'https://events.example.invalid/dxp-events',
              headers: '{"Content-Type":"application/json"}',
              body: '{"event":"assistance_shown"}',
            },
          },
        },
        {
          id: 'recovery-cookie',
          type: 'workflow',
          position: {
            x: 1420,
            y: 300,
          },
          data: {
            kind: 'cookie',
            label: messages['frustration-recovery.workflow.nodes.recovery-cookie.data.label'],
            config: {
              cookieName: 'dxp_assistance_shown',
              cookieValue: 'shown',
              cookieDays: 0,
            },
          },
        },
        {
          id: 'frustration-recovery-setup-1',
          type: 'workflow',
          position: {
            x: 1080,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'frustration-recovery-setup-2',
          type: 'workflow',
          position: {
            x: 1420,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.label'
              ],
            config: {
              noteText:
                messages[
                  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'frustration-recovery-setup-3',
          type: 'workflow',
          position: {
            x: 60,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.label'
              ],
            config: {
              noteText:
                messages[
                  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'frustration-recovery-setup-4',
          type: 'workflow',
          position: {
            x: 400,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.label'
              ],
            config: {
              noteText:
                messages[
                  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'frustration-recovery-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'recovery-trigger-to-recovery-check',
          source: 'recovery-trigger',
          target: 'recovery-check',
          type: 'smoothstep',
        },
        {
          id: 'recovery-scroll-trigger-to-recovery-check',
          source: 'recovery-scroll-trigger',
          target: 'recovery-check',
          type: 'smoothstep',
        },
        {
          id: 'recovery-check-to-recovery-help',
          source: 'recovery-check',
          target: 'recovery-help',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages['frustration-recovery.workflow.edges.recovery-check-to-recovery-help.label'],
        },
        {
          id: 'recovery-help-to-recovery-event',
          source: 'recovery-help',
          target: 'recovery-event',
          type: 'smoothstep',
        },
        {
          id: 'recovery-event-to-recovery-cookie',
          source: 'recovery-event',
          target: 'recovery-cookie',
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const frustrationRecoveryPreset = createFrustrationRecoveryPreset();
