// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector';
import { stepSummary } from '../src/lib/catalog';
import type { StepConfig, WorkflowNode } from '../src/lib/types';

let root: Root;
let host: HTMLDivElement;
let current: StepConfig;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  function Inspector() {
    const [node, setNode] = useState<WorkflowNode>({
      id: 'branch',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind: 'fork', label: 'Condition', config: { condition: '#legacy' } },
    });
    current = node.data.config;
    return (
      <NodeInspector
        node={node}
        onChange={(patch) => setNode({ ...node, data: { ...node.data, ...patch } })}
        onClose={() => {}}
        onPickElement={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onPreviewContent={() => {}}
      />
    );
  }
  await act(async () => root.render(<Inspector />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function field(label: string): HTMLInputElement | HTMLSelectElement {
  const id = [...host.querySelectorAll('label')].find(
    (item) => item.textContent === label,
  )?.htmlFor;
  const input = document.getElementById(id ?? '');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement))
    throw new Error(`Missing field: ${label}`);
  return input;
}
async function change(label: string, value: string) {
  const input = field(label);
  const select = input instanceof HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      select ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }));
  });
}
it('edits each condition type with the corresponding fields and preserves legacy selectors', async () => {
  expect(field('Condition type').value).toBe('selector');
  expect(field('Element exists').value).toBe('#legacy');
  expect([...field('Condition type').querySelectorAll('option')]).toHaveLength(7);
  await change('Condition type', 'device');
  expect(field('Device is').value).toBe('desktop');
  await change('Device is', 'mobile');
  expect(current).toMatchObject({ conditionType: 'device', conditionValue: 'mobile' });
  expect(stepSummary('fork', current)).toBe('Device is mobile');
  expect(host.textContent).not.toContain('Element found');
  await change('Condition type', 'language');
  await change('Language is', 'es-ES');
  expect(current).toMatchObject({ conditionType: 'language', conditionValue: 'es-ES' });
  await change('Condition type', 'referrer');
  await change('Referrer domain equals', 'source.example');
  expect(current.conditionValue).toBe('source.example');
  expect(field('Referrer domain equals').type).toBe('text');
  expect(stepSummary('fork', current)).toBe('Referrer domain equals source.example');
  for (const [type, label] of [
    ['query-param', 'Parameter name'],
    ['cookie', 'Cookie or storage key'],
  ]) {
    await change('Condition type', type);
    await change(label, 'audience');
    await change('Value equals', 'newsletter');
    expect(current).toMatchObject({
      conditionType: type,
      conditionKey: 'audience',
      conditionValue: 'newsletter',
    });
    expect(stepSummary('fork', current)).toContain('audience = "newsletter"');
    await change('Value equals', '');
    expect(current.conditionValue).toBe('');
  }
  expect(host.textContent).toContain('Cookies');
  expect(host.textContent).toContain('True if any source contains the name and value');
  expect(host.textContent).toContain('localStorage and sessionStorage');
  expect(stepSummary('fork', current)).toContain('Cookie or browser storage');
  await change('Condition type', 'selector');
  expect(field('Element exists').value).toBe('#legacy');
  await change('Element exists', '#new');
  expect(current.condition).toBe('#new');
});

it('edits inclusive date ranges and keeps the dates when switching condition types', async () => {
  await change('Condition type', 'date-range');
  expect(field('Condition type').textContent).toContain('Within date range');
  expect(field('Date based on').value).toBe('local');
  expect(field('Start date').type).toBe('date');
  expect(field('End date').type).toBe('date');
  expect(field('Start date').value).toBe('');
  expect(field('End date').value).toBe('');
  expect(stepSummary('fork', current)).toBe('Within … to … · Visitor local');
  expect(host.textContent).not.toContain('Value equals');
  await change('Start date', '2026-09-01');
  await change('End date', '2026-09-30');
  expect(current).toMatchObject({
    conditionType: 'date-range',
    conditionStartDate: '2026-09-01',
    conditionEndDate: '2026-09-30',
  });
  expect(field('Start date').getAttribute('max')).toBe('2026-09-30');
  expect(field('End date').getAttribute('min')).toBe('2026-09-01');
  expect(stepSummary('fork', current)).toBe('Within 2026-09-01 to 2026-09-30 · Visitor local');
  expect(host.textContent).toContain('Both dates are included');
  expect(host.textContent).toContain('visitor’s local time zone');
  await change('Date based on', 'utc');
  expect(current).toMatchObject({
    conditionTimeZone: 'utc',
    conditionStartDate: '2026-09-01',
    conditionEndDate: '2026-09-30',
  });
  expect(stepSummary('fork', current)).toBe('Within 2026-09-01 to 2026-09-30 · UTC');
  expect(host.textContent).toContain('Both dates are included, using UTC.');
  await change('Condition type', 'selector');
  expect(field('Element exists').value).toBe('#legacy');
  await change('Condition type', 'date-range');
  expect(field('Date based on').value).toBe('utc');
  expect(field('Start date').value).toBe('2026-09-01');
  expect(field('End date').value).toBe('2026-09-30');
  await change('Date based on', 'local');
  expect(current.conditionTimeZone).toBe('local');
  await change('End date', '');
  expect(current.conditionEndDate).toBe('');
  expect(stepSummary('fork', current)).toBe('Within 2026-09-01 to … · Visitor local');
});
