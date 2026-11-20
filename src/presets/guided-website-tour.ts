import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createGuidedWebsiteTourPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'guided-website-tour',
    name: messages['guided-website-tour.name'],
    description: messages['guided-website-tour.description'],
    complexity: 'intermediate',
    order: 75,
    tags: ['trigger', 'fork', 'cookie', 'tour', 'note'],
    workflow: {
      version: 1,
      name: messages['guided-website-tour.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'tour-trigger',
          type: 'workflow',
          position: {
            x: 60,
            y: 180,
          },
          data: {
            kind: 'trigger',
            label: messages['guided-website-tour.workflow.nodes.tour-trigger.data.label'],
            config: {
              event: 'page-load',
            },
          },
        },
        {
          id: 'tour-check',
          type: 'workflow',
          position: {
            x: 400,
            y: 180,
          },
          data: {
            kind: 'fork',
            label: messages['guided-website-tour.workflow.nodes.tour-check.data.label'],
            config: {
              conditionType: 'cookie',
              conditionKey: 'dxp_guided_tour',
              conditionValue: 'seen',
            },
          },
        },
        {
          id: 'guided-tour',
          type: 'workflow',
          position: {
            x: 740,
            y: 300,
          },
          data: {
            kind: 'tour',
            label: messages['guided-website-tour.workflow.nodes.guided-tour.data.label'],
            config: {
              tourSteps: [
                {
                  contentType: 'html',
                  content: messages['guided-website-tour.workflow.steps.welcome.content'],
                  position: 'center',
                  width: 380,
                  popoverAnimation: 'fade',
                },
                {
                  contentType: 'html',
                  content: messages['guided-website-tour.workflow.steps.menu.content'],
                  position: 'anchor',
                  selector: 'nav[aria-label="Main navigation"]',
                  width: 280,
                  popoverAnimation: 'fade',
                },
                {
                  contentType: 'html',
                  content: messages['guided-website-tour.workflow.steps.collection.content'],
                  position: 'anchor',
                  selector: '#shop-now',
                  width: 280,
                  popoverAnimation: 'fade',
                },
                {
                  // Below the fold on the demo website: the tour scrolls down to this form.
                  contentType: 'html',
                  content: messages['guided-website-tour.workflow.steps.newsletter.content'],
                  position: 'anchor',
                  selector: '#newsletter form',
                  width: 280,
                  popoverAnimation: 'fade',
                },
                {
                  contentType: 'html',
                  content: messages['guided-website-tour.workflow.steps.finish.content'],
                  position: 'bottom-right',
                  width: 340,
                  popoverAnimation: 'fade',
                },
              ],
              tourPreviousLabel: messages['guided-website-tour.workflow.buttons.previous'],
              tourNextLabel: messages['guided-website-tour.workflow.buttons.next'],
              tourDoneLabel: messages['guided-website-tour.workflow.buttons.done'],
            },
          },
        },
        {
          // Runs only after the visitor finishes or closes the tour; leaving mid-tour does not count.
          id: 'tour-cookie',
          type: 'workflow',
          position: {
            x: 1080,
            y: 300,
          },
          data: {
            kind: 'cookie',
            label: messages['guided-website-tour.workflow.nodes.tour-cookie.data.label'],
            config: {
              cookieName: 'dxp_guided_tour',
              cookieValue: 'seen',
              cookieDays: 365,
            },
          },
        },
        {
          id: 'guided-website-tour-setup-1',
          type: 'workflow',
          position: {
            x: 60,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages['guided-website-tour.workflow.nodes.guided-website-tour-setup-1.data.label'],
            config: {
              noteText:
                messages[
                  'guided-website-tour.workflow.nodes.guided-website-tour-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'guided-website-tour-setup-2',
          type: 'workflow',
          position: {
            x: 1080,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages['guided-website-tour.workflow.nodes.guided-website-tour-setup-2.data.label'],
            config: {
              noteText:
                messages[
                  'guided-website-tour.workflow.nodes.guided-website-tour-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'guided-website-tour-setup-3',
          type: 'workflow',
          position: {
            x: 740,
            y: 600,
          },
          data: {
            kind: 'note',
            label:
              messages['guided-website-tour.workflow.nodes.guided-website-tour-setup-3.data.label'],
            config: {
              noteText:
                messages[
                  'guided-website-tour.workflow.nodes.guided-website-tour-setup-3.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'guided-website-tour-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'guided-website-tour.workflow.nodes.guided-website-tour-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'guided-website-tour.workflow.nodes.guided-website-tour-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'tour-trigger-to-tour-check',
          source: 'tour-trigger',
          target: 'tour-check',
          type: 'smoothstep',
        },
        {
          id: 'tour-check-to-guided-tour',
          source: 'tour-check',
          target: 'guided-tour',
          type: 'smoothstep',
          sourceHandle: 'false',
          label: messages['guided-website-tour.workflow.edges.tour-check-to-guided-tour.label'],
        },
        {
          id: 'guided-tour-to-tour-cookie',
          source: 'guided-tour',
          target: 'tour-cookie',
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const guidedWebsiteTourPreset = createGuidedWebsiteTourPreset();
