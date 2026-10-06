import '../../styles/base.css';
import '../../styles/shared.css';
import { useId, useState } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { WorkflowPreset } from '../../lib/types';
import { getPresetMessages, localizeCommonDXPPreset } from '../../presets';
import './PresetsPanel.css';

export function PresetsPanel({
  presets,
  onApply,
}: {
  presets: readonly WorkflowPreset[];
  onApply: (preset: WorkflowPreset) => string | undefined;
}) {
  const { t, locale } = useBuilderI18n();
  const messages = getPresetMessages(locale);
  const id = useId();
  const [error, setError] = useState('');
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable preset region supports keyboard scrolling.
    <section className="dxp-presets" aria-labelledby={`${id}-heading`} tabIndex={0}>
      <div className="dxp-presets-content">
        <header className="dxp-presets-header">
          <h2 id={`${id}-heading`}>{t('presetsPanel.workflowPresets')}</h2>
          <p>
            {t('presetsPanel.applyingAPresetReplacesAllCurrentNodesAndConnectionsYourWorkflowName')}
          </p>
        </header>
        {error && (
          <p className="dxp-error" role="alert">
            {error}
          </p>
        )}
        <div className="dxp-presets-grid">
          {[...presets]
            .map((preset) => localizeCommonDXPPreset(preset, locale))
            .sort((a, b) => a.order - b.order)
            .map((preset, index) => (
              <article
                className="dxp-preset-card"
                key={preset.id}
                aria-labelledby={`${id}-${index}`}
              >
                <div className="dxp-preset-meta">
                  <span className="dxp-preset-complexity">
                    {messages[`complexity.${preset.complexity}`]}
                  </span>
                  <span>
                    {t('canvas.nodeCount', {
                      count: Array.isArray(preset.workflow?.nodes)
                        ? preset.workflow.nodes.length
                        : 0,
                    })}
                  </span>
                </div>
                <h3 id={`${id}-${index}`}>{preset.name}</h3>
                <p>{preset.description}</p>
                {!!preset.setupInstructions?.length && (
                  <div className="dxp-preset-setup">
                    <h4>{t('presetsPanel.setupInstructions')}</h4>
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
                  aria-label={t('presetsPanel.applyPresetName', { name: String(preset.name) })}
                  onClick={() => setError(onApply(preset) ?? '')}
                >
                  {t('presetsPanel.applyPreset')}
                </button>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
