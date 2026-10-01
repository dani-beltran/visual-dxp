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
  expect([...field('Condition type').querySelectorAll('option')]).toHaveLength(9);
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
  expect(stepSummary('fork', current)).toBe('Cookie audience = ""');
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

it('edits time-of-day ranges and keeps their time zone and times when switching types', async () => {
  await change('Condition type', 'time-of-day');
  expect(field('Condition type').textContent).toContain('Time of day');
  expect(field('Time based on').value).toBe('local');
  expect(field('Start time').type).toBe('time');
  expect(field('End time').type).toBe('time');
  expect(field('Start time').value).toBe('');
  expect(field('End time').value).toBe('');
  expect(stepSummary('fork', current)).toBe('Time …–… · Visitor local');
  expect(host.textContent).not.toContain('Start date');
  await change('Start time', '22:00');
  await change('End time', '06:00');
  await change('Time based on', 'utc');
  expect(current).toMatchObject({
    conditionType: 'time-of-day',
    conditionStartTime: '22:00',
    conditionEndTime: '06:00',
    conditionTimeZone: 'utc',
  });
  expect(stepSummary('fork', current)).toBe('Time 22:00–06:00 · UTC');
  expect(host.textContent).toContain('current time using UTC');
  expect(host.textContent).toContain('Both selected minutes are included');
  expect(host.textContent).toContain('earlier end time crosses midnight');
  expect(field('End time').hasAttribute('min')).toBe(false);
  await change('Condition type', 'date-range');
  expect(field('Date based on').value).toBe('utc');
  await change('Start date', '2026-09-01');
  await change('End date', '2026-09-30');
  await change('Condition type', 'time-of-day');
  expect(field('Time based on').value).toBe('utc');
  expect(field('Start time').value).toBe('22:00');
  expect(field('End time').value).toBe('06:00');
  expect(current.conditionStartDate).toBe('2026-09-01');
  expect(current.conditionEndDate).toBe('2026-09-30');
  await change('Time based on', 'local');
  await change('End time', '');
  expect(current.conditionTimeZone).toBe('local');
  expect(current.conditionEndTime).toBe('');
  expect(stepSummary('fork', current)).toBe('Time 22:00–… · Visitor local');
});

it('edits Data conditions, hides unary comparison inputs, and reports path/regex errors', async () => {
  await change('Condition type', 'data');
  expect(field('Incoming data path').value).toBe('');
  expect([...field('Operator').querySelectorAll('option')]).toHaveLength(20);
  await change('Incoming data path', 'items[2].tags');
  await change('Operator', 'contains');
  await change('Comparison value', '"42"');
  expect(current).toMatchObject({
    conditionType: 'data',
    conditionDataPath: 'items[2].tags',
    conditionOperator: 'contains',
    conditionValue: '"42"',
  });
  expect(host.textContent).toContain('Objects: exact key');
  expect(stepSummary('fork', current)).toContain('items[2].tags');
  for (const operator of [
    'exists',
    'not-exists',
    'is-null',
    'is-not-null',
    'is-empty',
    'is-not-empty',
    'is-true',
    'is-false',
  ]) {
    await change('Operator', operator);
    expect(() => field('Comparison value')).toThrow('Missing field');
  }
  await change('Operator', 'matches');
  await change('Comparison value', '[');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Invalid regular expression');
  await change('Comparison value', '^premium');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await change('Incoming data path', 'items[');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Invalid data path');
});

it('edits response selection in Outputs without a response format setting', async () => {
  function HttpInspector() {
    const [config, setConfig] = useState<StepConfig>({ url: 'https://example.com' });
    current = config;
    return (
      <NodeInspector
        node={{
          id: 'http',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'http', label: 'HTTP Request', config },
        }}
        onChange={(patch) => setConfig(patch.config!)}
        onClose={() => {}}
        onPickElement={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onPreviewContent={() => {}}
      />
    );
  }
  await act(async () => root.render(<HttpInspector />));
  expect(() => field('Response format')).toThrow('Missing field');
  const outputSection = field('Response data path').closest('section');
  expect(outputSection?.querySelector('h3')?.textContent).toContain('Outputs');
  expect(outputSection?.textContent).toContain('automatically parsed as JSON');
  expect(field('Response data path').value).toBe('');
  await change('Response data path', 'data.items[0].price');
  expect(current.responseDataPath).toBe('data.items[0].price');
  expect(host.textContent).toContain('null is passed as null');
  await change('Response data path', 'items[');
  expect(outputSection?.querySelector('[role="alert"]')?.textContent).toContain(
    'Invalid data path',
  );
  await change('Response data path', '');
  expect(current.responseDataPath).toBe('');
  expect(outputSection?.querySelector('[role="alert"]')).toBeNull();
});

it('switches element values between manual and incoming data while preserving manual input', async () => {
  function ElementInspector() {
    const [config, setConfig] = useState<StepConfig>({
      selector: '#result',
      action: 'text',
      value: 'Manual text',
    });
    current = config;
    return (
      <NodeInspector
        node={{
          id: 'element',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'dom', label: 'Update element', config },
        }}
        onChange={(patch) => setConfig(patch.config!)}
        onClose={() => {}}
        onPickElement={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onPreviewContent={() => {}}
      />
    );
  }
  await act(async () => root.render(<ElementInspector />));
  expect((field('Use incoming data') as HTMLInputElement).checked).toBe(false);
  expect(field('Use incoming data').getAttribute('role')).toBe('switch');
  expect(host.querySelector('textarea')?.value).toBe('Manual text');
  await act(async () => field('Use incoming data').click());
  expect(host.querySelector('textarea')).toBeNull();
  expect(host.textContent).toContain('blue input connection');
  await change('Incoming data path', 'user.name');
  expect(current).toMatchObject({
    valueSource: 'incoming-data',
    valueDataPath: 'user.name',
    value: 'Manual text',
  });
  expect(stepSummary('dom', current)).toContain('Incoming data: user.name');
  await change('Action', 'attribute');
  expect(field('Attribute name')).toBeTruthy();
  await change('Action', 'hide');
  expect(() => field('Use incoming data')).toThrow('Missing field');
  expect(() => field('Incoming data path')).toThrow('Missing field');
  expect(stepSummary('dom', current)).not.toContain('Incoming data');
  await change('Action', 'text');
  expect(field('Incoming data path').value).toBe('user.name');
  await change('Incoming data path', 'user[');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Invalid data path');
  await act(async () => field('Use incoming data').click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('textarea')?.value).toBe('Manual text');
});
