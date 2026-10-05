// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { spanishMessages } from '../src/app/locales/es';
import { NodeInspector } from '../src/components/NodeInspector';
import { createNode } from '../src/lib/catalog';
import { validateWorkflow } from '../src/lib/export';
import { createBuilderTranslator } from '../src/lib/i18n';
import { BuilderI18nProvider } from '../src/lib/i18nContext';
import type { StepConfig } from '../src/lib/types';

let host: HTMLDivElement, root: Root, current: StepConfig;
const pick = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  pick.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(spanish = false, savedConfig: StepConfig = {}) {
  function Inspector() {
    const [node, setNode] = useState(() => {
      const initial = createNode('experiment');
      initial.data.config = { ...initial.data.config, ...savedConfig };
      return initial;
    });
    current = node.data.config;
    return (
      <BuilderI18nProvider i18n={spanish ? { locale: 'es', messages: spanishMessages } : undefined}>
        <NodeInspector
          node={node}
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
  const input = field(label),
    select = input instanceof HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      select ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
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

it('edits independent GA4 fields, reuses the picker, and explains mapping, privacy, and delivery', async () => {
  await render(false, { experimentKey: 'assignment-only' });
  await choose('ga4');
  expect(field('Experiment ID')).toHaveProperty('required', true);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Experiment ID');
  await change('Experiment ID', 'homepage-cta-v1');
  await change('CTA element', '.checkout');
  expect(current.experimentId).toBe('homepage-cta-v1');
  expect(current.experimentKey).toBe('assignment-only');
  expect(current.experimentSelector).toBe('.checkout');
  expect(current.selector).toBeUndefined();
  expect(field('CTA interaction').value).toBe('click');
  await change('CTA interaction', 'change');
  expect(current.experimentInteraction).toBe('change');
  const picker = [...host.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Select on website'),
  );
  await act(async () => picker?.click());
  expect(pick).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('Variant A → a; Variant B → b');
  expect(host.textContent).toContain('not the GA measurement ID');
  expect(host.textContent).toContain('previews simulate events');
  await change('GA4 measurement ID (optional)', 'G-TEST123');
  await change('Event delivery', 'gtm');
  expect(current.experimentDelivery).toBe('gtm');
  expect(host.textContent).toContain('GTM custom event triggers');
  expect(host.textContent).not.toContain('GA4 measurement ID (optional)');
  await choose('none');
  expect(current.experimentId).toBe('homepage-cta-v1');
  await choose('ga4');
  expect(field('CTA element').value).toBe('.checkout');
  expect(current.experimentMeasurementId).toBe('G-TEST123');
});

it('includes the collapsible reporting guide and the exact official documentation links', async () => {
  await render();
  await choose('ga4');
  const guide = host.querySelector('details');
  expect(guide?.open).toBe(false);
  expect(guide?.querySelector('summary')?.textContent).toBe('Set up reporting in Google Analytics');
  expect(guide?.textContent).toContain(
    'event-scoped custom dimensions for experiment_id, variant_id, and cta_type',
  );
  expect(guide?.textContent).toContain('You do not manually register each value');
  expect(guide?.textContent).toContain('experiment_view → experiment_cta');
  expect(guide?.textContent).toContain('DebugView');
  expect(guide?.textContent).toContain('automatically determine statistical significance');
  expect([...guide!.querySelectorAll('a')].map((link) => link.href)).toEqual([
    'https://developers.google.com/analytics/devguides/collection/ga4/integration',
    'https://support.google.com/analytics/answer/9327974?hl=en',
  ]);
  expect(guide?.textContent).toContain('In-house and custom experiments');
});

it('translates all analytics controls, guide, and validation into Spanish', async () => {
  await render(true);
  expect(host.textContent).toContain('Sin seguimiento');
  await choose('ga4');
  expect(field('ID del experimento')).toHaveProperty('required', true);
  expect(host.textContent).not.toContain('Clave del experimento (opcional)');
  expect(host.textContent).not.toContain('Las asignaciones se guardan en este navegador');
  expect(host.querySelector('.dxp-inspector-branches')?.textContent).toContain(
    'Se ejecuta para A.',
  );
  expect(host.querySelector('.dxp-inspector-branches')?.textContent).not.toContain(
    'transmite los datos entrantes sin cambios',
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    'Introduce un ID del experimento para analítica.',
  );
  await change('ID del experimento', 'inicio-v1');
  await change('Elemento CTA', '.cta');
  expect(field('Interacción del CTA').textContent).toContain('Valor del campo confirmado');
  expect(host.textContent).toContain('Variante A → a; Variante B → b');
  expect(host.querySelector('summary')?.textContent).toBe(
    'Configurar informes en Google Analytics',
  );
  const node = createNode('experiment');
  node.data.config = { experimentAnalytics: 'ga4' };
  expect(
    validateWorkflow(
      { version: 1, name: 'Test', websiteUrl: '/demo-site.html', nodes: [node], edges: [] },
      createBuilderTranslator(spanishMessages),
    ).some((issue) => issue.message === 'Introduce un ID del experimento para analítica.'),
  ).toBe(true);
});
