import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

/**
 * A popover form produces data that fans out to two paths: an HTTP request that sends the
 * answers, and a Data Transform → Incoming data condition that picks the reply popover.
 * The condition path is listed first so the reply appears without waiting for the request.
 * The "seen" cookie is written just before the survey appears: a form popover only
 * continues after submission, so a later cookie would miss visitors who ignore it.
 */
export function createSatisfactionSurveyPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'satisfaction-survey',
    name: messages['satisfaction-survey.name'],
    description: messages['satisfaction-survey.description'],
    complexity: 'advanced',
    order: 105,
    tags: ['trigger', 'fork', 'delay', 'cookie', 'popover', 'transform', 'http', 'note'],
    workflow: {
      version: 1,
      name: messages['satisfaction-survey.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'survey-trigger',
          type: 'workflow',
          position: { x: 60, y: 180 },
          data: {
            kind: 'trigger',
            label: messages['satisfaction-survey.workflow.nodes.survey-trigger.data.label'],
            config: { event: 'page-load' },
          },
        },
        {
          id: 'survey-seen-check',
          type: 'workflow',
          position: { x: 400, y: 180 },
          data: {
            kind: 'fork',
            label: messages['satisfaction-survey.workflow.nodes.survey-seen-check.data.label'],
            config: {
              conditionType: 'cookie',
              conditionKey: 'dxp_survey_seen',
              conditionValue: 'seen',
            },
          },
        },
        {
          id: 'survey-delay',
          type: 'workflow',
          position: { x: 740, y: 180 },
          data: {
            kind: 'delay',
            label: messages['satisfaction-survey.workflow.nodes.survey-delay.data.label'],
            config: { duration: 3000 },
          },
        },
        {
          id: 'survey-seen-cookie',
          type: 'workflow',
          position: { x: 1080, y: 180 },
          data: {
            kind: 'cookie',
            label: messages['satisfaction-survey.workflow.nodes.survey-seen-cookie.data.label'],
            config: { cookieName: 'dxp_survey_seen', cookieValue: 'seen', cookieDays: 365 },
          },
        },
        {
          id: 'survey-popover',
          type: 'workflow',
          position: { x: 1420, y: 180 },
          data: {
            kind: 'popover',
            label: messages['satisfaction-survey.workflow.nodes.survey-popover.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['satisfaction-survey.workflow.nodes.survey-popover.data.config.content'],
              position: 'center',
              width: 400,
            },
          },
        },
        {
          id: 'survey-select',
          type: 'workflow',
          position: { x: 1760, y: 180 },
          data: {
            kind: 'transform',
            label: messages['satisfaction-survey.workflow.nodes.survey-select.data.label'],
            // A missing answer becomes empty text, so it takes the condition's false branch.
            config: {
              dataPath: 'satisfaction',
              transformations: [{ type: 'fallback', value: '' }],
            },
          },
        },
        {
          id: 'survey-check',
          type: 'workflow',
          position: { x: 2100, y: 180 },
          data: {
            kind: 'fork',
            label: messages['satisfaction-survey.workflow.nodes.survey-check.data.label'],
            config: {
              conditionType: 'data',
              conditionOperator: 'equal',
              conditionValue: 'positive',
            },
          },
        },
        {
          id: 'survey-thanks',
          type: 'workflow',
          position: { x: 2440, y: 40 },
          data: {
            kind: 'popover',
            label: messages['satisfaction-survey.workflow.nodes.survey-thanks.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['satisfaction-survey.workflow.nodes.survey-thanks.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'survey-support',
          type: 'workflow',
          position: { x: 2440, y: 320 },
          data: {
            kind: 'popover',
            label: messages['satisfaction-survey.workflow.nodes.survey-support.data.label'],
            config: {
              contentType: 'html',
              content:
                messages['satisfaction-survey.workflow.nodes.survey-support.data.config.content'],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'survey-send',
          type: 'workflow',
          position: { x: 1760, y: 420 },
          data: {
            kind: 'http',
            label: messages['satisfaction-survey.workflow.nodes.survey-send.data.label'],
            config: {
              method: 'POST',
              url: 'https://feedback.example.invalid/satisfaction',
              headers: '{"Content-Type":"application/json"}',
              body: '{"satisfaction": {{satisfaction}}, "comment": {{comment}}}',
            },
          },
        },
        {
          id: 'satisfaction-survey-setup-1',
          type: 'workflow',
          position: { x: 400, y: 680 },
          data: {
            kind: 'note',
            label:
              messages['satisfaction-survey.workflow.nodes.satisfaction-survey-setup-1.data.label'],
            config: {
              noteText:
                messages[
                  'satisfaction-survey.workflow.nodes.satisfaction-survey-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'satisfaction-survey-setup-2',
          type: 'workflow',
          position: { x: 1420, y: 680 },
          data: {
            kind: 'note',
            label:
              messages['satisfaction-survey.workflow.nodes.satisfaction-survey-setup-2.data.label'],
            config: {
              noteText:
                messages[
                  'satisfaction-survey.workflow.nodes.satisfaction-survey-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'satisfaction-survey-setup-3',
          type: 'workflow',
          position: { x: 1760, y: 680 },
          data: {
            kind: 'note',
            label:
              messages['satisfaction-survey.workflow.nodes.satisfaction-survey-setup-3.data.label'],
            config: {
              noteText:
                messages[
                  'satisfaction-survey.workflow.nodes.satisfaction-survey-setup-3.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'satisfaction-survey-setup-4',
          type: 'workflow',
          position: { x: 2100, y: 680 },
          data: {
            kind: 'note',
            label:
              messages['satisfaction-survey.workflow.nodes.satisfaction-survey-setup-4.data.label'],
            config: {
              noteText:
                messages[
                  'satisfaction-survey.workflow.nodes.satisfaction-survey-setup-4.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'satisfaction-survey-overview',
          type: 'workflow',
          position: { x: -280, y: 60 },
          data: {
            kind: 'note',
            label:
              messages[
                'satisfaction-survey.workflow.nodes.satisfaction-survey-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'satisfaction-survey.workflow.nodes.satisfaction-survey-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'survey-trigger-to-survey-seen-check',
          source: 'survey-trigger',
          target: 'survey-seen-check',
          type: 'smoothstep',
        },
        // Visitors who already saw the survey match the cookie and end here.
        {
          id: 'survey-seen-check-to-survey-delay',
          source: 'survey-seen-check',
          target: 'survey-delay',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages['satisfaction-survey.workflow.edges.survey-seen-check-to-survey-delay.label'],
        },
        {
          id: 'survey-delay-to-survey-seen-cookie',
          source: 'survey-delay',
          target: 'survey-seen-cookie',
          type: 'smoothstep',
        },
        {
          id: 'survey-seen-cookie-to-survey-popover',
          source: 'survey-seen-cookie',
          target: 'survey-popover',
          type: 'smoothstep',
        },
        // Listed before the request: connections from one step run in this order.
        {
          id: 'survey-popover-to-survey-select',
          source: 'survey-popover',
          target: 'survey-select',
          type: 'smoothstep',
          label:
            messages['satisfaction-survey.workflow.edges.survey-popover-to-survey-select.label'],
        },
        {
          id: 'survey-popover-to-survey-send',
          source: 'survey-popover',
          target: 'survey-send',
          type: 'smoothstep',
          label: messages['satisfaction-survey.workflow.edges.survey-popover-to-survey-send.label'],
        },
        {
          id: 'survey-select-to-survey-check',
          source: 'survey-select',
          target: 'survey-check',
          type: 'smoothstep',
        },
        {
          id: 'survey-check-to-survey-thanks',
          source: 'survey-check',
          target: 'survey-thanks',
          type: 'smoothstep',
          sourceHandle: 'true',
          label: messages['satisfaction-survey.workflow.edges.survey-check-to-survey-thanks.label'],
        },
        {
          id: 'survey-check-to-survey-support',
          source: 'survey-check',
          target: 'survey-support',
          type: 'smoothstep',
          sourceHandle: 'false',
          label:
            messages['satisfaction-survey.workflow.edges.survey-check-to-survey-support.label'],
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const satisfactionSurveyPreset = createSatisfactionSurveyPreset();
