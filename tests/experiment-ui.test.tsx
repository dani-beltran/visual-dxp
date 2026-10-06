// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
import { createNode, stepSummary } from '../src/lib/catalog';
import type { StepConfig } from '../src/lib/types';

it('edits the split, preserves saved assignments, and explains both outputs', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  let config: StepConfig = {};
  function Inspector() {
    const [node, setNode] = useState(() => {
      const initial = createNode('experiment');
      initial.data.config.experimentKey = 'checkout-v2';
      return initial;
    });
    config = node.data.config;
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
  async function change(label: string, value: string) {
    const id = [...host.querySelectorAll('label')].find(
      (item) => item.textContent === label,
    )?.htmlFor;
    const input = document.getElementById(id ?? '');
    if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${label}`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  try {
    await act(async () => root.render(<Inspector />));
    expect(host.textContent).toContain('A 50% · B 50%');
    await change('Traffic to A (%)', '30');
    expect(config.experimentSplit).toBe(30);
    expect(host.textContent).toContain('A 30% · B 70%');
    expect(stepSummary('experiment', config)).toBe('A 30% · B 70%');
    expect(host.textContent).not.toContain('Experiment key (optional)');
    expect(host.textContent).not.toContain('Assignments are saved in this browser');
    expect(config.experimentKey).toBe('checkout-v2');
    await change('Experiment ID', 'checkout-v3');
    expect(config.experimentKey).toBe('checkout-v3');
    await change('Traffic to A (%)', '120');
    expect(config.experimentSplit).toBe(30);
    expect(host.querySelector('.dxp-inspector-branches')?.textContent).toContain('Variant A');
    expect(host.querySelector('.dxp-inspector-branches')?.textContent).toContain('Variant B');
    expect(host.textContent).toContain('existing visitors keep their variant');
    expect(host.querySelector('.dxp-inspector-branches')?.textContent).toContain('Runs for A.');
    expect(host.querySelector('.dxp-inspector-branches')?.textContent).toContain('Runs for B.');
    expect(host.querySelector('.dxp-inspector-branches')?.textContent).not.toContain(
      'passes incoming data unchanged',
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
