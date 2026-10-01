import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createReturningVisitorExperiencePreset(
  messages: PresetMessages = englishPresetMessages,
) {
  return {
    id: 'returning-visitor-experience',
    name: messages['returning-visitor-experience.name'],
    description: messages['returning-visitor-experience.description'],
    complexity: 'intermediate',
    order: 80,
    tags: ['trigger', 'fork', 'dom', 'popover', 'cookie', 'note'],
    workflow: {
      version: 1,
      name: messages['returning-visitor-experience.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'visitor-load',
          type: 'workflow',
          position: {
            x: 60,
            y: 230,
          },
          data: {
            kind: 'trigger',
            label: messages['returning-visitor-experience.workflow.nodes.visitor-load.data.label'],
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'visitor-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 230,
          },
          data: {
            kind: 'fork',
            label: messages['returning-visitor-experience.workflow.nodes.visitor-check.data.label'],
            config: {
              conditionType: 'cookie',
              conditionKey: 'dxp_visitor_welcome',
              conditionValue: 'shown',
            },
          },
        },
        {
          id: 'visitor-returning',
          type: 'workflow',
          position: {
            x: 740,
            y: 60,
          },
          data: {
            kind: 'dom',
            label:
              messages['returning-visitor-experience.workflow.nodes.visitor-returning.data.label'],
            config: {
              selector: '.hero .description',
              action: 'text',
              value:
                messages[
                  'returning-visitor-experience.workflow.nodes.visitor-returning.data.config.value'
                ],
            },
          },
        },
        {
          id: 'visitor-welcome',
          type: 'workflow',
          position: {
            x: 740,
            y: 400,
          },
          data: {
            kind: 'popover',
            label:
              messages['returning-visitor-experience.workflow.nodes.visitor-welcome.data.label'],
            config: {
              contentType: 'html',
              content:
                messages[
                  'returning-visitor-experience.workflow.nodes.visitor-welcome.data.config.content'
                ],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'visitor-cookie',
          type: 'workflow',
          position: {
            x: 1080,
            y: 400,
          },
          data: {
            kind: 'cookie',
            label:
              messages['returning-visitor-experience.workflow.nodes.visitor-cookie.data.label'],
            config: {
              cookieName: 'dxp_visitor_welcome',
              cookieValue: 'shown',
              cookieDays: 30,
            },
          },
        },
        {
          id: 'returning-visitor-experience-setup-1',
          type: 'workflow',
          position: {
            x: 740,
            y: 700,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'returning-visitor-experience-setup-2',
          type: 'workflow',
          position: {
            x: 1080,
            y: 700,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.label'
              ],
            config: {
              noteText:
                messages[
                  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'returning-visitor-experience-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'visitor-load-to-visitor-check',
          source: 'visitor-load',
          target: 'visitor-check',
          type: 'smoothstep',
        },
        {
          id: 'visitor-check-to-visitor-returning',
          source: 'visitor-check',
          target: 'visitor-returning',
          type: 'smoothstep',
          sourceHandle: 'true',
          label:
            messages[
              'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-returning.label'
            ],
        },
        {
          id: 'visitor-check-to-visitor-welcome',
          source: 'visitor-check',
          target: 'visitor-welcome',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages[
              'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-welcome.label'
            ],
        },
        {
          id: 'visitor-welcome-to-visitor-cookie',
          source: 'visitor-welcome',
          target: 'visitor-cookie',
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const returningVisitorExperiencePreset = createReturningVisitorExperiencePreset();
