import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createEngagedReaderInvitationPreset(
  messages: PresetMessages = englishPresetMessages,
) {
  return {
    id: 'engaged-reader-invitation',
    name: messages['engaged-reader-invitation.name'],
    description: messages['engaged-reader-invitation.description'],
    complexity: 'beginner',
    order: 40,
    tags: ['trigger', 'popover', 'cookie', 'note'],
    workflow: {
      version: 1,
      name: messages['engaged-reader-invitation.workflow.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'reader-scroll',
          type: 'workflow',
          position: {
            x: 60,
            y: 180,
          },
          data: {
            kind: 'trigger',
            label: messages['engaged-reader-invitation.workflow.nodes.reader-scroll.data.label'],
            config: {
              event: 'scroll-depth',
              scrollThreshold: 70,
            },
          },
        },
        {
          id: 'reader-popover',
          type: 'workflow',
          position: {
            x: 400,
            y: 180,
          },
          data: {
            kind: 'popover',
            label: messages['engaged-reader-invitation.workflow.nodes.reader-popover.data.label'],
            config: {
              contentType: 'html',
              content:
                messages[
                  'engaged-reader-invitation.workflow.nodes.reader-popover.data.config.content'
                ],
              position: 'bottom-right',
              width: 340,
            },
          },
        },
        {
          id: 'reader-cookie',
          type: 'workflow',
          position: {
            x: 740,
            y: 180,
          },
          data: {
            kind: 'cookie',
            label: messages['engaged-reader-invitation.workflow.nodes.reader-cookie.data.label'],
            config: {
              cookieName: 'dxp_reader_invitation',
              cookieValue: 'shown',
              cookieDays: 7,
            },
          },
        },
        {
          id: 'engaged-reader-invitation-setup-1',
          type: 'workflow',
          position: {
            x: 400,
            y: 460,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.label'
              ],
            config: {
              noteText:
                messages[
                  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'engaged-reader-invitation-setup-2',
          type: 'workflow',
          position: {
            x: 740,
            y: 460,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.label'
              ],
            config: {
              noteText:
                messages[
                  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.config.noteText'
                ],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'engaged-reader-invitation-overview',
          type: 'workflow',
          position: {
            x: -280,
            y: 60,
          },
          data: {
            kind: 'note',
            label:
              messages[
                'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.label'
              ],
            config: {
              noteText:
                messages[
                  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.config.noteText'
                ],
              noteColor: '#def0d8',
              noteMarks: [
                {
                  start: 0,
                  end: messages['engaged-reader-invitation.name'].length,
                  bold: true,
                },
              ],
            },
          },
        },
      ],
      edges: [
        {
          id: 'reader-scroll-to-reader-popover',
          source: 'reader-scroll',
          target: 'reader-popover',
          type: 'smoothstep',
        },
        {
          id: 'reader-popover-to-reader-cookie',
          source: 'reader-popover',
          target: 'reader-cookie',
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const engagedReaderInvitationPreset = createEngagedReaderInvitationPreset();
