// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PresetsPanel } from '../src/components/PresetsPanel';
import { validateWorkflow } from '../src/lib/export';
import { BuilderI18nProvider } from '../src/lib/i18nContext';
import {
  blankPreset,
  commonDXPPresets,
  englishPresetMessages,
  getCommonDXPPresets,
  localizeCommonDXPPreset,
  spanishPresetMessages,
} from '../src/presets';

it('provides complete Spanish copy and falls back to the original English presets', () => {
  expect(Object.keys(spanishPresetMessages)).toEqual(Object.keys(englishPresetMessages));
  expect(getCommonDXPPresets('es-MX')).toBe(getCommonDXPPresets('es'));
  expect(getCommonDXPPresets('ES-es')).toBe(getCommonDXPPresets('es'));
  expect(getCommonDXPPresets('fr')).toBe(commonDXPPresets);
  expect(getCommonDXPPresets()).toBe(commonDXPPresets);
});

it.each(commonDXPPresets)('localizes $id while preserving executable configuration', (english) => {
  const spanish = getCommonDXPPresets('es').find((preset) => preset.id === english.id);
  expect(spanish).toBeDefined();
  if (!spanish) throw new Error('Missing Spanish preset');
  expect(JSON.parse(JSON.stringify(spanish))).toEqual(spanish);
  if (english === blankPreset) {
    expect(getCommonDXPPresets('es')[0]).toBe(spanish);
    expect(spanish.workflow.nodes).toEqual([]);
    expect(spanish.workflow.edges).toEqual([]);
    expect(validateWorkflow(spanish.workflow).length).toBeGreaterThan(0);
  } else {
    expect(validateWorkflow(spanish.workflow)).toEqual([]);
  }
  expect(spanish.name).not.toBe(english.name);
  expect(spanish.description).not.toBe(english.description);
  expect(spanish.workflow.name).toBe(spanish.name);
  for (const [index, node] of spanish.workflow.nodes.entries()) {
    const original = english.workflow.nodes[index];
    expect(node.data.label).not.toBe(original.data.label);
    const config = { ...node.data.config };
    const originalConfig = { ...original.data.config };
    for (const key of ['content', 'noteText', 'noteMarks'] as const) {
      delete config[key];
      delete originalConfig[key];
    }
    if (config.action === 'text') {
      expect(config.value).not.toBe(originalConfig.value);
      delete config.value;
      delete originalConfig.value;
    }
    expect({ ...node, data: { ...node.data, label: '', config } }).toEqual({
      ...original,
      data: { ...original.data, label: '', config: originalConfig },
    });
    if (node.id.endsWith('-overview')) {
      expect(node.data.config.noteText).toBe(`${spanish.name}\n\n${spanish.description}`);
      expect(node.data.config.noteMarks).toEqual([
        { start: 0, end: spanish.name.length, bold: true },
      ]);
    }
  }
  expect(spanish.workflow.edges.map((edge) => ({ ...edge, label: undefined }))).toEqual(
    english.workflow.edges.map((edge) => ({ ...edge, label: undefined })),
  );
  const customized = { ...english, name: 'Host content' };
  expect(localizeCommonDXPPreset(customized, 'es')).toBe(customized);
});

it('updates bundled cards with the editor locale and applies the displayed translation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const onApply = vi.fn(() => undefined);
  const render = (locale: string) =>
    act(() =>
      root.render(
        <BuilderI18nProvider i18n={{ locale }}>
          <PresetsPanel presets={commonDXPPresets} onApply={onApply} />
        </BuilderI18nProvider>,
      ),
    );
  try {
    await render('en');
    expect(host.querySelector('h3')?.textContent).toBe('Blank');
    await render('es-ES');
    expect(host.querySelector('h3')?.textContent).toBe('En blanco');
    await act(() => host.querySelector('button')?.click());
    expect(onApply).toHaveBeenCalledWith(getCommonDXPPresets('es')[0]);
    await render('en');
    expect(host.querySelector('h3')?.textContent).toBe('Blank');
    expect(onApply).toHaveBeenCalledTimes(1);
  } finally {
    await act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
