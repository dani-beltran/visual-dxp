// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { spanishMessages } from '../src/app/locales/es';
import { AnalyticsSettings } from '../src/components/AnalyticsSettings/AnalyticsSettings';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
import { createNode } from '../src/lib/catalog';
import { BuilderI18nProvider } from '../src/lib/i18nContext';
import type { AnalyticsSettings as Settings, StepConfig } from '../src/lib/types';

let host: HTMLDivElement, root: Root, current: StepConfig;
let shared: Settings;
const pick = vi.fn();
const openAnalytics = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  pick.mockClear();
  openAnalytics.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(
  spanish = false,
  savedConfig: StepConfig = {},
  kind: 'experiment' | 'track-event' = 'experiment',
) {
  function Inspector() {
    const [node, setNode] = useState(() => {
      const initial = createNode(kind);
      initial.data.config = { ...initial.data.config, ...savedConfig };
      return initial;
    });
    const [analytics, setAnalytics] = useState<Settings>({ provider: 'none' });
    shared = analytics;
    current = node.data.config;
    return (
      <BuilderI18nProvider i18n={spanish ? { locale: 'es', messages: spanishMessages } : undefined}>
        <AnalyticsSettings
          workflow={{
            version: 1,
            name: 'Test',
            websiteUrl: '',
            nodes: [node],
            edges: [],
            analytics,
          }}
          onChange={setAnalytics}
        />
        <NodeInspector
          node={node}
          analytics={analytics}
          onOpenAnalytics={openAnalytics}
          analyticsTabId="analytics-tab"
          onChange={(patch) => setNode({ ...node, data: { ...node.data, ...patch } })}
          onClose={vi.fn()}
          onPickElement={pick}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onPreviewContent={vi.fn()}
        />
      </BuilderI18nProvider>
    );
  }
  await act(async () => root.render(<Inspector />));
}
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
    throw new Error(`Missing ${label}`);
  return input;
}
async function change(label: string, value: string) {
  const input = field(label),
    select = input instanceof HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      select
        ? HTMLSelectElement.prototype
        : input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, value);
    input.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }));
  });
}
async function choose(value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
  if (!input) throw new Error(`Missing ${value}`);
  await act(async () => input.click());
}

it('defaults to no tracking and makes PostHog visibly Premium and unselectable', async () => {
  await render();
  expect(host.querySelector<HTMLInputElement>('input[value="none"]')?.checked).toBe(true);
  expect(host.textContent).not.toContain('GA4 measurement ID');
  const posthog = host.querySelector<HTMLInputElement>('input[value="posthog"]');
  expect(posthog?.disabled).toBe(true);
  expect(posthog?.closest('label')?.textContent).toContain('PostHogPremium');
  await choose('posthog');
  expect(current.experimentAnalytics).toBeUndefined();
  expect(host.querySelectorAll('svg[viewBox="0 0 24 24"]')).not.toHaveLength(0);
  expect(host.querySelector('img[src^="http"]')).toBeNull();
});

it('replaces all Experiment analytics controls with an info box and settings link', async () => {
  await render();
  const inspector = host.querySelector('[aria-label="Experiment configuration"]');
  expect(inspector).not.toBeNull();
  expect(inspector?.querySelector('.dxp-experiment-analytics')).toBeNull();
  expect(inspector?.querySelector('input[type="checkbox"]')).toBeNull();
  expect(inspector?.textContent).not.toContain('CTA element');
  expect(inspector?.textContent).not.toContain('CTA interaction');
  expect(inspector?.textContent).not.toContain('Track this experiment');
  const link = inspector?.querySelector<HTMLAnchorElement>('.dxp-inspector-note a');
  expect(link?.getAttribute('href')).toBe('#analytics-tab');
  expect(link?.closest('.dxp-inspector-note')?.textContent).toContain('tracked automatically');
  await act(async () => link?.click());
  expect(openAnalytics).toHaveBeenCalledOnce();
  await choose('ga4');
  expect(field('Experiment ID')).toHaveProperty('required', false);
  await change('Experiment ID', 'homepage-cta-v1');
  expect(current.experimentKey).toBe('homepage-cta-v1');
  expect(current.experimentAnalytics).toBeUndefined();
  await change('GA4 measurement ID (optional)', 'G-TEST123');
  await change('Event delivery', 'gtm');
  expect(shared.delivery).toBe('gtm');
  expect(current.experimentDelivery).toBeUndefined();
});

it('shows the Guide only when Google Analytics is selected', async () => {
  await render();
  expect(host.querySelector('.dxp-analytics-documentation')).toBeNull();
  await choose('ga4');
  const guide = host.querySelector('.dxp-analytics-documentation');
  expect(guide?.querySelector('h3')?.textContent).toBe('Guide');
  expect(guide?.querySelectorAll('h4')).toHaveLength(7);
  expect(host.querySelector('.dxp-analytics-guide')).toBeNull();
  expect(guide?.textContent).toContain('Custom Event');
  expect(guide?.textContent).toContain('Custom definitions');
  expect(guide?.textContent).toContain('DebugView');
  expect(guide?.textContent).not.toMatch(/legacy|deprecated|experiment_view|experiment_cta/i);
  expect(guide?.textContent).toContain('do not inherit variant_id');
  expect(guide?.querySelectorAll('tbody tr')).toHaveLength(4);
  expect(guide?.querySelectorAll('a')).toHaveLength(6);
  expect(host.querySelectorAll('.dxp-analytics-documentation')).toHaveLength(1);
  expect(guide?.querySelectorAll('details > summary')).toHaveLength(7);
  expect(guide?.querySelectorAll('details[open]')).toHaveLength(0);
  await choose('none');
  expect(host.querySelector('.dxp-analytics-documentation')).toBeNull();
});

it('translates the Experiment info box and settings link into Spanish', async () => {
  await render(true);
  const link = host.querySelector<HTMLAnchorElement>('.dxp-inspector-note a');
  expect(link?.closest('.dxp-inspector-note')?.textContent).toContain(
    'Este experimento se registra automáticamente',
  );
  expect(link?.textContent).toBe('Abrir ajustes de analítica');
  await choose('ga4');
  expect(host.querySelector('.dxp-analytics-documentation h3')?.textContent).toBe('Guía');
  expect(host.querySelector('.dxp-analytics-documentation')?.textContent).toContain(
    'Definiciones personalizadas',
  );
});

it('edits custom milestone nodes and validates event names without exposing incoming values', async () => {
  await render(false, {}, 'track-event');
  expect(field('Event name').value).toBe('milestone_reached');
  expect(host.textContent).toContain(
    'Enable Google Analytics in the Analytics tab to send custom events.',
  );
  await change('Event name', 'page_view');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('reserved');
  await change('Event name', 'offer_accepted');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(current.analyticsEventName).toBe('offer_accepted');
  await change('Payload (JSON)', '{"value":{{price}}}');
  expect(current.analyticsPayload).toBe('{"value":{{price}}}');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await change('Payload (JSON)', '[]');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('valid JSON object');
  await change('Payload (JSON)', '');
  expect(host.querySelector('[aria-label="Track event configuration"]')?.textContent).not.toMatch(
    /incoming[- ](?:data|values)/i,
  );
  await choose('ga4');
  await change('Workflow ID', 'lead_capture');
  await change('Reporting version', '2');
  expect(shared).toMatchObject({ workflowId: 'lead_capture', workflowVersion: '2' });
  expect(host.textContent).toContain('dxp_workflow_started');
  expect(host.textContent).not.toContain(
    'Enable Google Analytics in the Analytics tab to send custom events.',
  );
});

it('localizes the custom event inspector and its validation', async () => {
  await render(true, {}, 'track-event');
  await change('Nombre del evento', 'bad name');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Usa un nombre');
});
