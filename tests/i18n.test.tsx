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
import { App } from '../src/app';
import { spanishMessages } from '../src/app/locales/es';
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
    (el) =>
      el.getAttribute('aria-label') === label ||
      el.getAttribute('title') === label ||
      el.textContent?.trim() === label,
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

describe('demo language selector', () => {
  beforeEach(() => localStorage.removeItem('visual-dxp-language'));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('visual-dxp-language');
  });

  async function selectLanguage(value: string) {
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>('.dxp-language-selector select');
      if (!select) throw new Error('Missing language selector');
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  it('switches the shell, builder and export validation without resetting edits or undo history', async () => {
    const onChange = vi.fn();
    await act(async () =>
      root.render(
        <App
          initialWorkflow={{ ...workflow, websiteUrl: 'https://example.com' }}
          onChange={onChange}
        />,
      ),
    );
    await act(async () => button('Add Delay').click());
    const edited = onChange.mock.lastCall?.[0];
    expect(edited.nodes[0].data.label).toBe('Delay');
    onChange.mockClear();
    await selectLanguage('es');
    expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe('es-ES');
    expect(host.querySelector('.dxp-app')?.getAttribute('lang')).toBe('es-ES');
    expect(host.querySelector('[title="Acercar"]')).not.toBeNull();
    expect(host.querySelector('.dxp-inspector')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => button('Exportar flujo de trabajo').click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Antes de exportar');
    expect(host.querySelector('.dxp-validation')?.textContent).toContain(
      'Añade al menos un disparador.',
    );
    await act(async () => button('Cerrar diálogo').click());
    await selectLanguage('en');
    expect(host.querySelector('[title="Zoom in"]')).not.toBeNull();
    expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe('en');
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => button('Undo (⌘Z)').click());
    expect(onChange.mock.lastCall?.[0].nodes).toEqual([]);
  });

  it('fills the Spanish catalog while preserving initial host overrides', async () => {
    await act(async () =>
      root.render(
        <App
          initialWorkflow={workflow}
          i18n={{ locale: 'es-MX', messages: { 'canvas.zoomIn': 'Ampliar vista' } }}
        />,
      ),
    );
    expect(host.querySelector<HTMLSelectElement>('.dxp-language-selector select')?.value).toBe(
      'es',
    );
    expect(host.querySelector('[title="Ampliar vista"]')).not.toBeNull();
    expect(button('Añadir Espera')).toBeDefined();
    await selectLanguage('en');
    expect(host.querySelector('[title="Zoom in"]')).not.toBeNull();
    expect(button('Add Delay')).toBeDefined();
  });

  it('covers every builder key and formats Spanish counts and dynamic values', () => {
    expect(Object.keys(spanishMessages).sort()).toEqual(Object.keys(englishMessages).sort());
    const t = createBuilderTranslator(spanishMessages);
    expect(t('canvas.connectionCount', { count: 1 })).toBe('1 conexión');
    expect(t('canvas.connectionCount', { count: 2 })).toBe('2 conexiones');
    expect(t('activity.nodeAdded', { label: 'Custom content' })).toBe('Se añadió «Custom content»');
    expect(t('summary.delay', { seconds: 1 })).toBe('Esperar 1 segundo');
    expect(t('summary.delay', { seconds: 2 })).toBe('Esperar 2 segundos');
  });

  it('persists and restores both language choices across app mounts', async () => {
    await act(async () => root.render(<App initialWorkflow={workflow} />));
    for (const language of ['es', 'en']) {
      await selectLanguage(language);
      expect(localStorage.getItem('visual-dxp-language')).toBe(language);
      await act(async () => root.render(null));
      await act(async () => root.render(<App initialWorkflow={workflow} />));
      expect(host.querySelector<HTMLSelectElement>('.dxp-language-selector select')?.value).toBe(
        language,
      );
      expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe(
        language === 'es' ? 'es-ES' : 'en',
      );
    }
  });

  it('ignores unsupported stored languages and still switches when storage is blocked', async () => {
    localStorage.setItem('visual-dxp-language', 'unsupported');
    await act(async () =>
      root.render(<App initialWorkflow={workflow} i18n={{ locale: 'es-MX' }} />),
    );
    expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe('es-MX');
    await act(async () => root.render(null));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    await act(async () => root.render(<App initialWorkflow={workflow} />));
    expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe('en');
    await selectLanguage('es');
    expect(host.querySelector('.dxp-builder')?.getAttribute('lang')).toBe('es-ES');
  });
});
