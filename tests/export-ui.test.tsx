// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder';
import { createActivityStore } from '../src/lib/activity';
import { defaultWorkflow } from '../src/lib/catalog';
import type { Workflow } from '../src/lib/types';

let host: HTMLDivElement;
let root: Root;
const persistenceKey = 'url-targeting-test';
const writeText = vi.fn();
const createObjectURL = vi.fn();
let download: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  writeText.mockReset().mockResolvedValue(undefined);
  createObjectURL.mockReset().mockReturnValue('blob:export');
  vi.stubGlobal('navigator', { clipboard: { writeText }, userAgent: navigator.userAgent });
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    },
  );
  download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.removeItem(persistenceKey);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function element<T extends HTMLElement>(selector: string): T {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
function button(name: string) {
  const found = [...host.querySelectorAll('button')].find(
    (entry) => entry.textContent?.trim() === name || entry.getAttribute('aria-label') === name,
  );
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function editUrl(value: string) {
  await act(async () => {
    const input = element<HTMLInputElement>(
      '[aria-label="Target website"] input:not([type="checkbox"])',
    );
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing input value setter');
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function importWorkflow(workflow: Workflow) {
  await act(async () => {
    const input = element<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ text: async () => JSON.stringify(workflow) }],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function renderApp(websiteUrl = '/demo-site.html') {
  const onExport = vi.fn();
  const onChange = vi.fn<(workflow: Workflow) => void>();
  const store = createActivityStore();
  await act(async () =>
    root.render(
      <App
        initialWorkflow={{ ...defaultWorkflow, websiteUrl }}
        onExport={onExport}
        onChange={onChange}
        activityStore={store}
      />,
    ),
  );
  return { onExport, onChange, store };
}
function expectNoExport(
  onExport: ReturnType<typeof vi.fn>,
  store: ReturnType<typeof createActivityStore>,
) {
  expect(writeText).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(onExport).not.toHaveBeenCalled();
  expect(
    store
      .getSnapshot()
      .some(({ action }) => /Copied the workflow|Exported the workflow/.test(action)),
  ).toBe(false);
}

describe('host export flow', () => {
  it.each([
    '',
    '   ',
    'https://',
    '/demo-site.html?preview=1#intro',
    `${window.location.origin}/demo-site.html#preview`,
  ])('opens builder configuration and blocks export for %j', async (url) => {
    const { onExport, store } = await renderApp(url);
    await click('Export workflow');
    expect(host.querySelector('[aria-label="Export workflow"]')).toBeNull();
    expect(element('[aria-label="Target website"]').closest('.dxp-builder')).not.toBeNull();
    expect(host.textContent).toContain(
      'Configure your website URL before exporting. The demo website is for preview only.',
    );
    await click('Save website');
    expect(host.querySelector('[aria-label="Target website"]')).not.toBeNull();
    expectNoExport(onExport, store);
  });
  it.each(['Cancel', 'Close dialog', 'Escape', 'backdrop'])(
    'cancels configuration via %s without a deferred export',
    async (method) => {
      const { onExport, store } = await renderApp();
      await click('Export workflow');
      await editUrl('https://example.com/products');
      if (method === 'Escape')
        await act(async () =>
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
        );
      else if (method === 'backdrop') await act(async () => element('.dxp-modal-backdrop').click());
      else await click(method);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      await click('Change target website');
      expect(element<HTMLInputElement>('[aria-label="Target website"] input').value).toBe(
        '/demo-site.html',
      );
      await editUrl('https://example.com/products');
      await click('Save website');
      expect(host.querySelector('[aria-label="Export workflow"]')).toBeNull();
      expectNoExport(onExport, store);
    },
  );
  it.each(['JavaScript', 'Workflow JSON'])(
    'resumes export after saving and copies/downloads %s',
    async (tab) => {
      const { onExport, onChange, store } = await renderApp();
      await click('Export workflow');
      await editUrl('/products?campaign=summer#intro');
      await act(async () => element<HTMLInputElement>('input[type="checkbox"]').click());
      await click('Save website');
      expect(element('[aria-label="Export workflow"]').closest('.dxp-builder')).toBeNull();
      expect(onChange.mock.lastCall?.[0]).toMatchObject({
        websiteUrl: '/products?campaign=summer#intro',
        includeSubpages: true,
      });
      expectNoExport(onExport, store);
      await click(tab);
      await click('Copy');
      expect(writeText).toHaveBeenCalledOnce();
      const content = writeText.mock.lastCall?.[0] as string;
      expect(content).toContain('"includeSubpages": true');
      expect(content).toContain(`${window.location.origin}/products`);
      if (tab === 'Workflow JSON')
        expect(JSON.parse(content)).toMatchObject({
          websiteUrl: `${window.location.origin}/products`,
          includeSubpages: true,
        });
      await click(tab === 'JavaScript' ? 'Download .js' : 'Download .json');
      expect(download).toHaveBeenCalledOnce();
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(onExport).toHaveBeenCalledTimes(tab === 'JavaScript' ? 1 : 0);
      expect(
        store
          .getSnapshot()
          .filter(({ action }) => /Copied the workflow|Exported the workflow/.test(action)),
      ).toHaveLength(2);
    },
  );
  it.each([
    ['JavaScript', 'Copy'],
    ['JavaScript', 'Download .js'],
    ['Workflow JSON', 'Copy'],
    ['Workflow JSON', 'Download .json'],
  ])('rechecks %s %s after a workflow import invalidates the open dialog', async (tab, action) => {
    const { onExport, store } = await renderApp('https://example.com/');
    await click('Export workflow');
    await click(tab);
    await importWorkflow({ ...defaultWorkflow, websiteUrl: '/demo-site.html#invalidated' });
    await click(action);
    expect(host.querySelector('[aria-label="Export workflow"]')).toBeNull();
    expect(host.querySelector('[aria-label="Target website"]')).not.toBeNull();
    expectNoExport(onExport, store);
  });
  it('also rechecks JavaScript graph validation before Copy', async () => {
    const { onExport, store } = await renderApp('https://example.com/');
    await click('Export workflow');
    await importWorkflow({
      ...defaultWorkflow,
      websiteUrl: 'https://example.com/',
      nodes: [],
      edges: [],
    });
    await click('Copy');
    expectNoExport(onExport, store);
    expect(host.textContent).toContain('Add a trigger and a step');
  });
});

describe('builder targeting persistence', () => {
  it('defaults old workflows to false and saves, undoes, redoes, restores and imports scope', async () => {
    const old = { ...defaultWorkflow };
    delete old.includeSubpages;
    localStorage.setItem(persistenceKey, JSON.stringify(old));
    const onChange = vi.fn<(workflow: Workflow) => void>();
    const store = createActivityStore();
    const render = () =>
      act(async () =>
        root.render(
          <VisualDXPBuilder
            initialWorkflow={old}
            onChange={onChange}
            persistenceKey={persistenceKey}
            activityStore={store}
          />,
        ),
      );
    await render();
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(false);
    await click('Change target website');
    const checkbox = element<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox.checked).toBe(false);
    expect(checkbox.closest('label')?.textContent).toContain('Include subpages');
    expect(
      document.getElementById(checkbox.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('Also run this experience on pages beneath this URL.');
    await editUrl('https://example.com');
    expect(host.textContent).toContain('The homepage only.');
    await act(async () => checkbox.click());
    expect(host.textContent).toContain('The homepage and all subpages.');
    await editUrl('https://example.com/products');
    expect(host.textContent).toContain('/products-sale');
    await click('Save website');
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(true);
    const entries = store.getSnapshot();
    expect(entries.at(-1)?.action).toContain('including subpages');
    await act(async () => element<HTMLButtonElement>('button[title^="Undo"]').click());
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      websiteUrl: '/demo-site.html',
      includeSubpages: false,
    });
    expect(store.getSnapshot()).toEqual([]);
    await act(async () => element<HTMLButtonElement>('button[title^="Redo"]').click());
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(true);
    expect(store.getSnapshot()).toEqual(entries);
    await act(async () => vi.advanceTimersByTime(600));
    expect(JSON.parse(localStorage.getItem(persistenceKey) ?? 'null')).toMatchObject({
      websiteUrl: 'https://example.com/products',
      includeSubpages: true,
    });
    await act(async () => root.render(null));
    await render();
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(true);
    await importWorkflow({ ...defaultWorkflow, includeSubpages: false });
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(false);
    await importWorkflow({ ...defaultWorkflow, includeSubpages: true });
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(true);
    await importWorkflow(old);
    expect(onChange.mock.lastCall?.[0].includeSubpages).toBe(false);
  });
});
