// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
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
function field(label: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const id = [...host.querySelectorAll('label')].find(
    (item) => item.textContent === label,
  )?.htmlFor;
  const input = document.getElementById(id ?? '');
  if (
    !(
      input instanceof HTMLInputElement ||
      input instanceof HTMLSelectElement ||
      input instanceof HTMLTextAreaElement
    )
  )
    throw new Error(`Missing field: ${label}`);
  return input;
}
async function change(label: string, value: string) {
  const input = field(label);
  const select = input instanceof HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      select
        ? HTMLSelectElement.prototype
        : input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }));
  });
}
it('edits each condition type with the corresponding fields and preserves legacy selectors', async () => {
  expect(field('Condition type').value).toBe('selector');
  expect(field('Element exists').value).toBe('#legacy');
  expect([...field('Condition type').querySelectorAll('option')]).toHaveLength(10);
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
  await change('Date based on', 'offset');
  expect(current).toMatchObject({
    conditionTimeZone: 'offset',
    conditionTimeZoneOffset: 0,
    conditionStartDate: '2026-09-01',
    conditionEndDate: '2026-09-30',
  });
  expect(stepSummary('fork', current)).toBe('Within 2026-09-01 to 2026-09-30 · UTC+00:00');
  expect(host.textContent).toContain('Both dates are included, using UTC+00:00.');
  await change('Condition type', 'selector');
  expect(field('Element exists').value).toBe('#legacy');
  await change('Condition type', 'date-range');
  expect(field('Date based on').value).toBe('offset');
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
  await change('Time based on', 'offset');
  expect(current).toMatchObject({
    conditionType: 'time-of-day',
    conditionStartTime: '22:00',
    conditionEndTime: '06:00',
    conditionTimeZone: 'offset',
    conditionTimeZoneOffset: 0,
  });
  expect(stepSummary('fork', current)).toBe('Time 22:00–06:00 · UTC+00:00');
  expect(host.textContent).toContain('current time using UTC');
  expect(host.textContent).toContain('Both selected minutes are included');
  expect(host.textContent).toContain('earlier end time crosses midnight');
  expect(field('End time').hasAttribute('min')).toBe(false);
  await change('Condition type', 'date-range');
  expect(field('Date based on').value).toBe('offset');
  await change('Start date', '2026-09-01');
  await change('End date', '2026-09-30');
  await change('Condition type', 'time-of-day');
  expect(field('Time based on').value).toBe('offset');
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

it('edits condition behavior, leaves paths on connections, and reports regex errors', async () => {
  await change('Condition type', 'data');
  expect(() => field('Incoming data path')).toThrow('Missing field');
  expect([...field('Operator').querySelectorAll('option')]).toHaveLength(20);
  await change('Operator', 'contains');
  await change('Comparison value', '"42"');
  expect(current).toMatchObject({
    conditionType: 'data',
    conditionOperator: 'contains',
    conditionValue: '"42"',
  });
  expect(host.textContent).toContain('Objects: exact key');
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
});

it('edits HTTP request templates without response selection fields', async () => {
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
  expect(() => field('Response data path')).toThrow('Missing field');
  expect(host.textContent).toContain('Passes response data or an error object to the next node');
  expect(current).not.toHaveProperty('responseDataPath');
  expect(host.textContent).toContain('{{user.name}}');
  await change('Request URL', '/api/users/{{user.id}}');
  await change('Method', 'POST');
  await change('Request body', '{"name":"{{user.name}}"}');
  expect(current).toMatchObject({
    url: '/api/users/{{user.id}}',
    body: '{"name":"{{user.name}}"}',
  });
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await change('Request body', '{{missing');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('closing braces');
  await change('Method', 'GET');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await change('Request URL', '/api/{{user..id}}');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Invalid data path');
});

it('summarizes page customizations and opens the page editor', async () => {
  const open = vi.fn();
  await act(async () =>
    root.render(
      <NodeInspector
        node={{
          id: 'page',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'dom',
            label: 'Customize Page',
            config: {
              changes: [
                { selector: '#title', action: 'text', value: 'Hello {{name}}' },
                {
                  selector: '#photo',
                  action: 'replace-image',
                  value: 'https://example.com/new.jpg',
                  imageAlt: '',
                },
              ],
            },
          },
        }}
        onChange={() => {}}
        onClose={() => {}}
        onPickElement={open}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onPreviewContent={() => {}}
      />,
    ),
  );
  expect(host.textContent).toContain('Customize Page');
  expect(host.querySelectorAll('.dxp-page-change-group')).toHaveLength(2);
  expect(host.textContent).toContain('Hello {{name}}');
  expect(host.querySelector('textarea')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('.dxp-page-editor-open')!.click());
  expect(open).toHaveBeenCalledOnce();
});

it('selects multiple weekdays, removes days and preserves selections when switching types', async () => {
  await change('Condition type', 'weekdays');
  const checkbox = (name: string) =>
    host.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(7);
  expect(
    [...host.querySelectorAll('.dxp-inspector-weekday-options span')].map(
      (item) => item.textContent,
    ),
  ).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  for (const name of ['Saturday', 'Monday']) await act(async () => checkbox(name).click());
  expect(current.conditionWeekdays).toEqual([1, 6]);
  expect(stepSummary('fork', current)).toBe('Monday, Saturday · Visitor local');
  await change('Time based on', 'offset');
  await change('Condition type', 'selector');
  await change('Condition type', 'weekdays');
  expect(checkbox('Monday').checked).toBe(true);
  expect(checkbox('Saturday').checked).toBe(true);
  expect(field('Time based on').value).toBe('offset');
  await act(async () => checkbox('Saturday').click());
  for (const name of ['Tuesday', 'Wednesday']) await act(async () => checkbox(name).click());
  expect(current.conditionWeekdays).toEqual([1, 2, 3]);
  expect(stepSummary('fork', current)).toBe('Monday, Tuesday, Wednesday · UTC+00:00');
});

it('edits and preserves a fixed UTC offset across calendar condition types', async () => {
  await change('Condition type', 'weekdays');
  await change('Time based on', 'offset');
  const offset = field('UTC offset (hours)');
  expect(offset.type).toBe('number');
  expect(offset.getAttribute('min')).toBe('-12');
  expect(offset.getAttribute('max')).toBe('14');
  expect(offset.getAttribute('step')).toBe('1');
  expect(offset.value).toBe('0');
  expect(host.textContent).toContain('From −12 to +14.');
  expect(host.textContent).not.toContain('Fixed offsets do not change');
  await change('UTC offset (hours)', '5');
  expect(current.conditionTimeZoneOffset).toBe(5);
  expect(stepSummary('fork', current)).toContain('UTC+05:00');
  await change('Condition type', 'time-of-day');
  expect(field('UTC offset (hours)').value).toBe('5');
  expect(host.textContent).toContain('current time using UTC+05:00');
  await change('Condition type', 'date-range');
  expect(host.textContent).toContain('Both dates are included, using UTC+05:00');
  await change('UTC offset (hours)', '-12');
  expect(stepSummary('fork', current)).toContain('UTC−12:00');
  await change('Date based on', 'local');
  expect(() => field('UTC offset (hours)')).toThrow('Missing field');
  await change('Date based on', 'offset');
  expect(field('UTC offset (hours)').value).toBe('-12');
  await change('UTC offset (hours)', '');
  expect(current.conditionTimeZoneOffset).toBeUndefined();
});
