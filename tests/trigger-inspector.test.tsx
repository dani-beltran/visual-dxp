// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
import { stepSummary } from '../src/lib/catalog';
import { triggerOptions } from '../src/lib/triggers';
import type { StepConfig, TriggerEvent, WorkflowNode } from '../src/lib/types';

let root: Root;
let host: HTMLDivElement;
let current: StepConfig;
const pickElement = vi.fn();
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  pickElement.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  function Inspector() {
    const [node, setNode] = useState<WorkflowNode>({
      id: 'start',
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: { kind: 'trigger', label: 'Trigger', config: { event: 'click', selector: '#legacy' } },
    });
    current = node.data.config;
    return (
      <NodeInspector
        node={node}
        onChange={(patch) => setNode({ ...node, data: { ...node.data, ...patch } })}
        onClose={() => {}}
        onPickElement={pickElement}
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

it('edits every behavioral trigger with defaults, relevant controls, and readable canvas summaries', async () => {
  expect(field('Target element').value).toBe('#legacy');
  expect(field('Start when').querySelectorAll('option')).toHaveLength(13);
  const summaries: Partial<Record<TriggerEvent, string>> = {
    'exit-intent': 'When a visitor intends to leave',
    'rage-click': '3 nearby clicks within 1s',
    inactivity: 'After 30s of inactivity',
    'scroll-thrashing': '4 scroll reversals within 2s',
    'scroll-depth': 'Scroll down to 75%',
  };
  for (const [event, summary] of Object.entries(summaries)) {
    await change('Start when', event);
    expect(current.event).toBe(event);
    expect(host.textContent).not.toContain('Target element');
    expect(host.textContent).not.toContain('Select on website');
    expect(stepSummary('trigger', current)).toBe(summary);
    for (const setting of triggerOptions[event as TriggerEvent].settings) {
      expect(field(setting.label).value).toBe(String(setting.defaultValue));
      await change(setting.label, String(setting.defaultValue + 1));
      expect(current[setting.key]).toBe(setting.defaultValue + 1);
    }
  }
  await change('Start when', 'click');
  expect(field('Target element').value).toBe('#legacy');
  await change('Start when', 'rage-click');
  expect(field('Click count').value).toBe('4');
  expect(stepSummary('trigger', current)).toBe('4 nearby clicks within 1.001s');
  await change('Start when', 'page-load');
  expect(host.textContent).toContain('once the page is ready');
  expect(stepSummary('trigger', {})).toBe('When a visitor lands on your site');
});

it.each([
  ['zoom-in', 'An element is zoomed into', 'Zoom in'],
  ['swipe', 'An element is swiped', 'Swipe'],
] as const)(
  'selects a %s target and preserves it when switching triggers',
  async (event, label, summary) => {
    const option = field('Start when').querySelector(`option[value="${event}"]`);
    expect(option?.textContent).toBe(label);
    await change('Start when', event);
    expect(current.event).toBe(event);
    expect(field('Target element').value).toBe('#legacy');
    expect(host.textContent).toContain(triggerOptions[event].hint);
    expect(triggerOptions[event].settings).toEqual([]);
    expect(host.querySelector('input[type="number"]')).toBeNull();

    const picker = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Select on website'),
    );
    expect(picker).toBeDefined();
    await act(async () => picker?.click());
    expect(pickElement).toHaveBeenCalledOnce();

    await change('Target element', '.product-image');
    expect(current.selector).toBe('.product-image');
    expect(stepSummary('trigger', current)).toBe(`${summary} · .product-image`);
    await change('Start when', 'inactivity');
    expect(host.textContent).not.toContain('Target element');
    await change('Start when', event);
    expect(field('Target element').value).toBe('.product-image');
    expect(stepSummary('trigger', current)).toBe(`${summary} · .product-image`);
    await change('Target element', '');
    expect(stepSummary('trigger', current)).toBe(`${summary} · Choose an element`);
  },
);

it('edits a custom event name without a target element and preserves it when switching triggers', async () => {
  const option = field('Start when').querySelector('option[value="custom-event"]');
  expect(option?.textContent).toBe('A custom event is dispatched');
  await change('Start when', 'custom-event');
  expect(current.event).toBe('custom-event');
  expect(host.textContent).toContain(triggerOptions['custom-event'].hint);
  expect(triggerOptions['custom-event'].settings).toEqual([]);
  expect(host.querySelector('input[type="number"]')).toBeNull();
  expect(host.textContent).not.toContain('Target element');
  expect(host.textContent).not.toContain('Select on website');

  const name = field('Custom event name');
  expect(name.value).toBe('');
  expect(name.getAttribute('placeholder')).toBe('e.g. cart:updated');
  // A blank name is reported by workflow validation rather than as an immediate alert.
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(stepSummary('trigger', current)).toBe('Custom event · Enter an event name');

  await change('Custom event name', 'Cart:Updated');
  expect(current.customEventName).toBe('Cart:Updated');
  expect(stepSummary('trigger', current)).toBe('Custom event · Cart:Updated');
  expect(host.querySelector('[role="alert"]')).toBeNull();

  // Surrounding whitespace shows no error. Typing keeps it so names can contain inner spaces.
  await act(async () => field('Custom event name').focus());
  await change('Custom event name', 'checkout ');
  expect(current.customEventName).toBe('checkout ');
  await change('Custom event name', 'checkout complete');
  expect(current.customEventName).toBe('checkout complete');
  await change('Custom event name', '  cart:updated \t');
  expect(current.customEventName).toBe('  cart:updated \t');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(field('Custom event name').hasAttribute('aria-invalid')).toBe(false);
  expect(stepSummary('trigger', current)).toBe('Custom event · cart:updated');
  // Leaving the field trims the saved name.
  await act(async () => field('Custom event name').blur());
  expect(current.customEventName).toBe('cart:updated');
  expect(field('Custom event name').value).toBe('cart:updated');
  expect(host.querySelector('[role="alert"]')).toBeNull();

  await change('Start when', 'click');
  expect(host.textContent).not.toContain('Custom event name');
  expect(field('Target element').value).toBe('#legacy');
  await change('Start when', 'custom-event');
  expect(field('Custom event name').value).toBe('cart:updated');
  expect(stepSummary('trigger', current)).toBe('Custom event · cart:updated');
});
