import { useId, useState } from 'react';
import type { WorkflowPreset } from '../lib/types';
import '../styles/presets.css';

export function PresetsPanel({
  presets,
  onApply,
}: {
  presets: readonly WorkflowPreset[];
  onApply: (preset: WorkflowPreset) => string | undefined;
}) {
  const id = useId();
  const [error, setError] = useState('');
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable preset region supports keyboard scrolling.
    <section className="dxp-presets" aria-labelledby={`${id}-heading`} tabIndex={0}>
      <div className="dxp-presets-content">
        <header className="dxp-presets-header">
          <h2 id={`${id}-heading`}>Workflow presets</h2>
          <p>
            Applying a preset replaces all current nodes and connections. Your workflow name, target
            website, and subpage settings stay the same. You can undo this change.
          </p>
        </header>
        {error && (
          <p className="dxp-error" role="alert">
            {error}
          </p>
        )}
        <div className="dxp-presets-grid">
          {[...presets]
            .sort((a, b) => a.order - b.order)
            .map((preset, index) => (
              <article
                className="dxp-preset-card"
                key={preset.id}
                aria-labelledby={`${id}-${index}`}
              >
                <div className="dxp-preset-meta">
                  <span className="dxp-preset-complexity">{preset.complexity}</span>
                  <span>
                    {Array.isArray(preset.workflow?.nodes) ? preset.workflow.nodes.length : 0} nodes
                  </span>
                </div>
                <h3 id={`${id}-${index}`}>{preset.name}</h3>
                <p>{preset.description}</p>
                {!!preset.setupInstructions?.length && (
                  <div className="dxp-preset-setup">
                    <h4>Setup instructions</h4>
                    <ol>
                      {preset.setupInstructions.map((instruction, step) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Instructions are static text within a preset, with no item state.
                        <li key={step}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <button
                  type="button"
                  className="dxp-button dxp-button-primary"
                  aria-label={`Apply preset: ${preset.name}`}
                  onClick={() => setError(onApply(preset) ?? '')}
                >
                  Apply preset
                </button>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
