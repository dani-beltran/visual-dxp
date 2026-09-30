// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BuilderI18nProvider,
  type BuilderMessages,
  createActivityStore,
  createBuilderTranslator,
  englishMessages,
  formatActivity,
  VisualDXPBuilder,
  type VisualDXPBuilderApi,
  type Workflow,
} from '../src';
import { ActivityPanel } from '../src/components/ActivityPanel';
import { activityAction } from '../src/lib/activity';
import { catalog, getCatalog, stepSummary } from '../src/lib/catalog';
import { dataTools } from '../src/lib/data';
import { validateWorkflow } from '../src/lib/export';
import { formatBuilderError } from '../src/lib/i18n';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const spanish = {
  'common.cancel': 'Cancelar',
  'nodes.delay.label': 'Espera',
  'nodes.delay.description': 'Hace una pausa antes de continuar.',
  'canvas.zoomIn': 'Acercar',
  'canvas.nodeCount': ({ count }) => `${count} ${count === 1 ? 'nodo' : 'nodos'}`,
  'activity.nodeAdded': ({ label }) => `Se añadió «${label}»`,
  'flow.node.a11yDescription.keyboardDisabled': 'Selecciona un nodo con Intro.',
} satisfies Partial<BuilderMessages>;
const workflow: Workflow = {
  version: 1,
  name: 'Authored name',
  websiteUrl: '/demo-site.html',
  nodes: [],
  edges: [],
};

function button(label: string) {
  const target = [...host.querySelectorAll('button')].find(
    (el) => el.getAttribute('aria-label') === label || el.textContent?.trim() === label,
  );
  if (!target) throw new Error(`Missing button ${label}`);
  return target;
}

describe('host-owned builder localization', () => {
  it('supports typed functions, partial catalogs, English fallback and explicit empty translations', () => {
    const t = createBuilderTranslator({ ...spanish, 'common.redo': '' });
    expect(t('common.cancel')).toBe('Cancelar');
    expect(t('common.undo')).toBe('Undo');
    expect(t('common.redo')).toBe('');
    expect(t('canvas.nodeCount', { count: 1 })).toBe('1 nodo');
    expect(t('canvas.nodeCount', { count: 2 })).toBe('2 nodos');
    expect(englishMessages['common.cancel']).toBe('Cancel');
    function assertMessageTypes() {
      // @ts-expect-error Counts must be numbers.
      t('canvas.nodeCount', { count: 'two' });
      // @ts-expect-error Parameterized messages require their values.
      t('canvas.nodeCount');
      // @ts-expect-error Unknown translation keys are rejected.
      t('unknown.message');
    }
    void assertMessageTypes;
  });

  it('switches language without replacing authored data, selected nodes or undo history', async () => {
    const store = createActivityStore();
    const onChange = vi.fn();
    let api: VisualDXPBuilderApi | null = null;
    const onReady = (value: VisualDXPBuilderApi | null) => {
      api = value;
    };
    const render = async (translated: boolean) =>
      act(async () =>
        root.render(
          <VisualDXPBuilder
            initialWorkflow={workflow}
            onReady={onReady}
            onChange={onChange}
            activityStore={store}
            i18n={translated ? { locale: 'es-ES', messages: spanish } : { locale: 'en' }}
          />,
        ),
      );
    await render(true);
    expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe('es-ES');
    expect(host.querySelector('[title="Acercar"]')).not.toBeNull();
    expect(host.textContent).toContain('Selecciona un nodo con Intro.');
    await act(async () => button('Add Espera').click());
    const getApi = () => api as unknown as VisualDXPBuilderApi;
    expect(getApi().getWorkflow().nodes[0].data.label).toBe('Espera');
    expect(host.querySelector('.dxp-inspector')).not.toBeNull();
    await act(async () => {
      getApi().renameWorkflow('User content');
      getApi().flushActivity();
    });
    const before = getApi().getWorkflow();
    onChange.mockClear();
    await render(false);
    expect(getApi().getWorkflow()).toEqual(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(host.querySelector('.dxp-inspector')).not.toBeNull();
    expect(host.querySelector('[title="Zoom in"]')).not.toBeNull();
    expect(getApi().getWorkflow().nodes[0].data.label).toBe('Espera');
    await act(async () => host.querySelector<HTMLButtonElement>('[title="Undo (⌘Z)"]')!.click());
    expect(getApi().getWorkflow().name).toBe('Authored name');
    expect(getApi().getWorkflow().nodes[0].data.label).toBe('Espera');
    expect(store.getSnapshot()[0].message).toEqual({
      key: 'activity.nodeAdded',
      params: { label: 'Espera' },
    });
  });

  it('isolates simultaneous builders and applies language and text direction per root', async () => {
    await act(async () =>
      root.render(
        <>
          <VisualDXPBuilder
            initialWorkflow={workflow}
            i18n={{ locale: 'es-ES', direction: 'rtl', messages: spanish }}
          />
          <VisualDXPBuilder initialWorkflow={workflow} />
        </>,
      ),
    );
    const builders = host.querySelectorAll('.dxp-builder');
    expect(builders[0].getAttribute('dir')).toBe('rtl');
    expect(builders[1].getAttribute('dir')).toBe('ltr');
    expect(builders[0].querySelector('[title="Acercar"]')).not.toBeNull();
    expect(builders[1].querySelector('[title="Zoom in"]')).not.toBeNull();
    expect(builders[1].querySelector('[title="Acercar"]')).toBeNull();
  });

  it('renders persisted activity in the viewer language and formats dates with the supplied locale', async () => {
    const entry = {
      id: '1',
      username: 'Ada',
      timestamp: '2020-03-14T12:00:00.000Z',
      ...activityAction('activity.nodeAdded', { label: 'Custom text' }),
    };
    const store = createActivityStore([JSON.parse(JSON.stringify(entry))]);
    const render = async (locale: string, messages?: Partial<BuilderMessages>) =>
      act(async () =>
        root.render(
          <BuilderI18nProvider i18n={{ locale, messages }}>
            <ActivityPanel entries={store.getSnapshot()} />
          </BuilderI18nProvider>,
        ),
      );
    await render('es-ES', spanish);
    expect(host.textContent).toContain('Se añadió «Custom text»');
    expect(host.textContent).toContain(
      new Date(entry.timestamp).toLocaleDateString('es-ES', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    );
    await render('en');
    expect(host.textContent).toContain('Added “Custom text”');
    expect(formatActivity(entry, createBuilderTranslator(spanish))).toBe('Se añadió «Custom text»');
    expect(store.getSnapshot()[0]).toEqual(entry);
    expect(Object.isFrozen(store.getSnapshot()[0].message?.params)).toBe(true);
  });

  it('localizes shared metadata, summaries and validation without changing execution identifiers', () => {
    const t = createBuilderTranslator({
      ...spanish,
      'summary.delay': ({ seconds }) => `Espera ${seconds} segundos`,
      'validation.addATriggerAndAStepToGetStarted': 'Añade un inicio y un paso.',
      'validation.circularConnectionsAreNotSupportedUseARepeatStepWith': 'No se permiten ciclos.',
      'errors.data.dataPathMustBeText': 'La ruta debe ser texto.',
    });
    expect(getCatalog(t).find((item) => item.kind === 'delay')?.label).toBe('Espera');
    expect(catalog.find((item) => item.kind === 'delay')?.label).toBe('Delay');
    expect(stepSummary('delay', { duration: 2500 }, t)).toBe('Espera 2.5 segundos');
    expect(validateWorkflow(workflow, t)[0].message).toBe('Añade un inicio y un paso.');
    const cyclic: Workflow = {
      ...workflow,
      nodes: [
        {
          id: 'a',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'delay', label: 'Custom', config: {} },
        },
      ],
      edges: [{ id: 'e', source: 'a', target: 'a' }],
    };
    expect(
      validateWorkflow(cyclic, t).find((issue) => issue.code === 'workflow.cycle')?.message,
    ).toBe('No se permiten ciclos.');
    try {
      dataTools.parsePath(42 as unknown as string);
    } catch (error) {
      expect(formatBuilderError(error, t)).toBe('La ruta debe ser texto.');
    }
  });
});
