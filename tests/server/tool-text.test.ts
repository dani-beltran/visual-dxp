import { expect, it } from 'vitest';
import {
  hasToolText,
  isTextualWorkflowFinish,
  toolTextEmitter,
} from '../../src/server/ai/toolText';

it('withholds tool markers at every possible stream split', () => {
  const marker = '<tool_call>\n<function=finish_workflow>\n</function>\n</tool_call>';
  for (let split = 0; split <= marker.length; split++) {
    let text = '';
    const emit = toolTextEmitter((chunk) => {
      text += chunk;
    });
    emit('Done. ');
    emit(marker.slice(0, split));
    emit(marker.slice(split));
    emit('', true);
    expect(text).toBe('Done. ');
  }
  expect(isTextualWorkflowFinish(marker)).toBe(true);
  expect(isTextualWorkflowFinish(marker.replace('finish_workflow', 'remove_node'))).toBe(false);
  expect(
    isTextualWorkflowFinish(
      marker.replace('</function>', '<parameter=id>start</parameter></function>'),
    ),
  ).toBe(false);
  expect(hasToolText(marker)).toBe(true);
});

it('streams ordinary text and preserves non-tool less-than characters', () => {
  let text = '';
  const emit = toolTextEmitter((chunk) => {
    text += chunk;
  });
  emit('Use <');
  expect(text).toBe('Use ');
  emit('strong> for bold, or x < 2.');
  emit('', true);
  expect(text).toBe('Use <strong> for bold, or x < 2.');
});
