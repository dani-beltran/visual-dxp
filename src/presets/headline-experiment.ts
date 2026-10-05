import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createHeadlineExperimentPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'headline-experiment',
    name: messages['headline-experiment.name'],
    description: messages['headline-experiment.description'],
    complexity: 'intermediate',
    order: 80,
    tags: ['trigger', 'experiment', 'dom', 'note'],
    workflow: {
      version: 1,
      name: messages['headline-experiment.name'],
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
      nodes: [
        {
          id: 'headline-experiment-overview',
          type: 'workflow',
          position: { x: -280, y: 60 },
          data: {
            kind: 'note',
            label: messages['headline-experiment.overview'],
            config: {
              noteText: messages['headline-experiment.description'],
              noteColor: '#def0d8',
            },
          },
        },
        {
          id: 'experiment-load',
          type: 'workflow',
          position: { x: 60, y: 220 },
          data: {
            kind: 'trigger',
            label: messages['headline-experiment.load'],
            config: { event: 'page-load' },
          },
        },
        {
          id: 'headline-split',
          type: 'workflow',
          position: { x: 370, y: 220 },
          data: {
            kind: 'experiment',
            label: messages['headline-experiment.split'],
            config: {
              experimentSplit: 50,
              experimentKey: 'dxp_headline_experiment',
              experimentAnalytics: 'none',
            },
          },
        },
        {
          id: 'headline-a',
          type: 'workflow',
          position: { x: 840, y: 80 },
          data: {
            kind: 'dom',
            label: messages['headline-experiment.a'],
            config: {
              action: 'text',
              selector: '.hero h1',
              value: messages['headline-experiment.value-a'],
            },
          },
        },
        {
          id: 'headline-b',
          type: 'workflow',
          position: { x: 840, y: 370 },
          data: {
            kind: 'dom',
            label: messages['headline-experiment.b'],
            config: {
              action: 'text',
              selector: '.hero h1',
              value: messages['headline-experiment.value-b'],
            },
          },
        },
        {
          id: 'headline-experiment-setup',
          type: 'workflow',
          position: { x: 370, y: 550 },
          data: {
            kind: 'note',
            label: messages['headline-experiment.setup'],
            config: {
              noteText: messages['headline-experiment.instructions'],
              noteColor: '#fff4b8',
            },
          },
        },
        {
          id: 'headline-experiment-testing',
          type: 'workflow',
          position: { x: 840, y: 650 },
          data: {
            kind: 'note',
            label: messages['headline-experiment.testing'],
            config: {
              noteText: messages['headline-experiment.testing-instructions'],
              noteColor: '#fff4b8',
            },
          },
        },
      ],
      edges: [
        {
          id: 'load-split',
          source: 'experiment-load',
          target: 'headline-split',
          type: 'smoothstep',
        },
        {
          id: 'split-a',
          source: 'headline-split',
          target: 'headline-a',
          sourceHandle: 'a',
          label: messages['headline-experiment.edge-a'],
          type: 'smoothstep',
        },
        {
          id: 'split-b',
          source: 'headline-split',
          target: 'headline-b',
          sourceHandle: 'b',
          label: messages['headline-experiment.edge-b'],
          type: 'smoothstep',
        },
      ],
    },
  } satisfies WorkflowPreset;
}

export const headlineExperimentPreset = createHeadlineExperimentPreset();
