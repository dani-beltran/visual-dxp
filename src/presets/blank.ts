import type { WorkflowPreset } from '../lib/types';
import { englishPresetMessages, type PresetMessages } from './locale/en';

export function createBlankPreset(messages: PresetMessages = englishPresetMessages) {
  return {
    id: 'blank',
    name: messages['blank.name'],
    description: messages['blank.description'],
    complexity: 'beginner',
    order: 0,
    workflow: {
      version: 1,
      name: messages['blank.name'],
      websiteUrl: '',
      nodes: [],
      edges: [],
    },
  } satisfies WorkflowPreset;
}

export const blankPreset = createBlankPreset();
