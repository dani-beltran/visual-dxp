// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector';
import { NodeLibrary } from '../src/components/NodeLibrary';
import { createNode, stepSummary } from '../src/lib/catalog';
import { getNodeDataPorts } from '../src/lib/nodeData';
import type { StepConfig } from '../src/lib/types';

let root: Root;
let host: HTMLDivElement;
let current: StepConfig;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
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
    throw new Error(`Missing ${label}`);
  return input;
}
async function change(label: string, value: string) {
  const input = field(label);
  const select = input instanceof HTMLSelectElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      select ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!setter) throw new Error('Missing input setter');
    setter.call(input, value);
    input.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }));
  });
}

function Inspector() {
  const [node, setNode] = useState(() => createNode('cookie'));
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

it('adds the Set cookie action from the node library', async () => {
  const add = vi.fn();
  await act(async () => root.render(<NodeLibrary onAdd={add} />));
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="Add Set cookie"]');
  expect(button).not.toBeNull();
  await act(async () => button?.click());
  expect(add).toHaveBeenCalledWith('cookie');
});

it('edits cookie name, value, and session or persistent expiration', async () => {
  await act(async () => root.render(<Inspector />));
  expect(field('Cookie name').value).toBe('audience');
  expect(field('Cookie value').value).toBe('returning');
  expect(field('Expiration').value).toBe('session');
  expect(host.textContent).not.toContain('Expires after');
  await change('Cookie name', 'campaign');
  await change('Cookie value', 'summer sale');
  expect(current).toMatchObject({
    cookieName: 'campaign',
    cookieValue: 'summer sale',
    cookieDays: 0,
  });
  expect(stepSummary('cookie', current)).toBe('campaign = "summer sale" · Session');
  await change('Expiration', 'days');
  expect(field('Expires after').value).toBe('30');
  await change('Expires after', '7');
  expect(current.cookieDays).toBe(7);
  expect(stepSummary('cookie', current)).toBe('campaign = "summer sale" · 7 days');
  await change('Expiration', 'session');
  await change('Cookie value', '');
  expect(current).toMatchObject({ cookieName: 'campaign', cookieValue: '', cookieDays: 0 });
  expect(host.textContent).not.toContain('Expires after');
});

it('explains cookie templates and derives incoming data use from either field', async () => {
  await act(async () => root.render(<Inspector />));
  expect(host.textContent).toContain('in the cookie name or value');
  const incoming = () => host.querySelector('.dxp-inspector-incoming-data');
  expect(incoming()).toBeNull();
  expect(getNodeDataPorts({ kind: 'cookie', config: current }).acceptsData).toBe(false);
  await change('Cookie name', 'audience_{{user.id}}');
  expect(incoming()?.textContent).toContain('Uses incoming data');
  expect(getNodeDataPorts({ kind: 'cookie', config: current }).acceptsData).toBe(true);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await change('Cookie value', '{{$}}');
  await change('Cookie name', 'audience');
  expect(incoming()).not.toBeNull();
  expect(getNodeDataPorts({ kind: 'cookie', config: current }).acceptsData).toBe(true);
  await change('Cookie value', 'returning');
  expect(incoming()).toBeNull();
  expect(getNodeDataPorts({ kind: 'cookie', config: current }).acceptsData).toBe(false);
  await change('Cookie value', '{{user.name');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('matching braces');
  await change('Cookie value', '{{user.name}}');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await change('Cookie name', 'bad {{name}}');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('cookie name without spaces');
});
