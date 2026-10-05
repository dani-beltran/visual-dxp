import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createWelcomeJourneyPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'welcome-journey',
    name: messages['welcome-journey.name'],
    description: messages['welcome-journey.description'],
    complexity: 'intermediate',
    order: 65,
    tags: ['trigger', 'delay', 'fork', 'popover', 'cookie', 'dom', 'note'],
    workflow: {
      version: 1,
      name: messages['welcome-journey.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'welcome-journey-overview',
          type: 'workflow',
          position: { x: -280, y: 60 },
          data: {
            kind: 'note',
            label: messages['welcome-journey.overview'],
            config: {
              noteText: messages['welcome-journey.description'],
              noteColor: '#def0d8',
            },
          },
        },
        {
          id: 'welcome-journey-setup',
          type: 'workflow',
          position: { x: 350, y: 550 },
          data: {
            kind: 'note',
            label: messages['welcome-journey.setup'],
            config: {
              noteText: messages['welcome-journey.instructions'],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'welcome',
          type: 'workflow',
          position: { x: 60, y: 220 },
          data: {
            kind: 'trigger',
            label: messages['welcome-journey.welcome'],
            config: { event: 'page-load' },
          },
        },
        {
          id: 'pause',
          type: 'workflow',
          position: { x: 820, y: 85 },
          data: {
            kind: 'delay',
            label: messages['welcome-journey.pause'],
            config: { duration: 1500 },
          },
        },
        {
          id: 'check',
          type: 'workflow',
          position: { x: 350, y: 220 },
          data: {
            kind: 'fork',
            label: messages['welcome-journey.check'],
            config: {
              conditionType: 'cookie',
              conditionKey: 'dxp_welcome_gift',
              conditionValue: 'shown',
            },
          },
        },
        {
          id: 'offer',
          type: 'workflow',
          position: { x: 1130, y: 85 },
          data: {
            kind: 'popover',
            label: messages['welcome-journey.offer'],
            config: {
              contentType: 'html',
              content: messages['welcome-journey.content'],
              position: 'bottom-right',
              width: 360,
            },
          },
        },
        {
          id: 'gift-cookie',
          type: 'workflow',
          position: { x: 1420, y: 85 },
          data: {
            kind: 'cookie',
            label: messages['welcome-journey.cookie'],
            config: {
              cookieName: 'dxp_welcome_gift',
              cookieValue: 'shown',
              cookieDays: 30,
            },
          },
        },
        {
          id: 'update',
          type: 'workflow',
          position: { x: 760, y: 370 },
          data: {
            kind: 'dom',
            label: messages['welcome-journey.update'],
            config: {
              action: 'text',
              selector: '#newsletter h2',
              value: messages['welcome-journey.value'],
            },
          },
        },
      ],
      edges: [
        { id: 'welcome-check', source: 'welcome', target: 'check', type: 'smoothstep' },
        { id: 'offer-gift-cookie', source: 'offer', target: 'gift-cookie', type: 'smoothstep' },
        { id: 'pause-offer', source: 'pause', target: 'offer', type: 'smoothstep' },
        {
          id: 'check-pause',
          source: 'check',
          target: 'pause',
          sourceHandle: 'false',
          label: messages['welcome-journey.false'],
          type: 'smoothstep',
        },
        {
          id: 'check-update',
          source: 'check',
          target: 'update',
          sourceHandle: 'true',
          label: messages['welcome-journey.true'],
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const welcomeJourneyPreset = createWelcomeJourneyPreset();
