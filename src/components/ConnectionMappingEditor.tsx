import { useId } from 'react';
import {
  type ConnectionMapping,
  type ConnectionPreview,
  connectionTools,
  defaultTargetInput,
} from '../lib/connectionMapping';
import { type DataSelection, dataTools } from '../lib/data';
import { formatBuilderError } from '../lib/i18n';
import { useBuilderI18n } from '../lib/i18nContext';
import type { WorkflowEdge, WorkflowNode } from '../lib/types';
import { Select } from './Select';

export function ConnectionMappingEditor({
  edge,
  source,
  target,
  preview,
  onChange,
  onBlur,
}: {
  edge: WorkflowEdge;
  source?: WorkflowNode;
  target?: WorkflowNode;
  preview?: ConnectionPreview;
  onChange: (mapping: ConnectionMapping) => void;
  onBlur: () => void;
}) {
  const id = useId();
  const { t } = useBuilderI18n();
  const mapping = edge.data?.mapping ?? {
    sourcePath: '',
    targetInput: defaultTargetInput(target?.data),
  };
  let error = '';
  let selected: DataSelection | undefined;
  let incompatible = '';
  try {
    connectionTools.validate(mapping, target?.data, source?.data.kind);
    if (preview) {
      const resolved = connectionTools.resolve(mapping, preview);
      selected = resolved.selected;
      if (selected.exists && target) {
        const config = target.data.config;
        try {
          if (target.data.kind === 'dom' && dataTools.usesIncomingValue(config)) {
            dataTools.elementValue({ ...config, valueDataPath: '' }, selected);
            dataTools.interpolate(config.selector ?? '', selected, undefined, true);
            if (config.action === 'attribute')
              dataTools.interpolate(config.attribute ?? '', selected, undefined, true);
          }
          if (target.data.kind === 'fork' && config.conditionType === 'data')
            dataTools.evaluate({ ...config, conditionDataPath: '' }, selected);
        } catch (cause) {
          incompatible = formatBuilderError(cause, t);
        }
      }
    }
  } catch (cause) {
    error = formatBuilderError(cause, t);
  }
  const showValue = (value: DataSelection) =>
    !value.exists
      ? t('mapping.missing')
      : value.value === null
        ? t('mapping.null')
        : (JSON.stringify(value.value, null, 2) ?? t('mapping.missing'));
  return (
    <section className="dxp-connection-mapping" aria-label={t('mapping.title')}>
      <h3>
        {source?.data.label ?? edge.source} → {target?.data.label ?? edge.target}
      </h3>
      {mapping.responseDataPath !== undefined && (
        <div className="dxp-inspector-field">
          <label htmlFor={`${id}-response`}>{t('mapping.importedResponse')}</label>
          <input
            id={`${id}-response`}
            value={mapping.responseDataPath}
            spellCheck={false}
            onChange={(event) => onChange({ ...mapping, responseDataPath: event.target.value })}
            onBlur={onBlur}
          />
          <p className="dxp-inspector-hint">{t('mapping.importedHint')}</p>
        </div>
      )}
      <div className="dxp-inspector-field">
        <label htmlFor={`${id}-path`}>{t('mapping.sourcePath')}</label>
        <input
          id={`${id}-path`}
          value={mapping.sourcePath}
          placeholder="user.name"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange({ ...mapping, sourcePath: event.target.value })}
          onBlur={onBlur}
        />
        <p id={`${id}-hint`} className="dxp-inspector-hint">
          {t('mapping.pathHint')}
        </p>
      </div>
      <div className="dxp-inspector-field">
        <label htmlFor={`${id}-input`}>{t('mapping.destination')}</label>
        <Select
          id={`${id}-input`}
          value={mapping.targetInput}
          onChange={(event) =>
            onChange({
              ...mapping,
              targetInput: event.target.value as ConnectionMapping['targetInput'],
            })
          }
        >
          <option value="data">{t('mapping.inputData')}</option>
          {target?.data.kind === 'dom' && <option value="value">{t('mapping.inputValue')}</option>}
          {target?.data.kind === 'fork' && (
            <option value="condition">{t('mapping.inputCondition')}</option>
          )}
        </Select>
        <p className="dxp-inspector-hint">
          {t(
            target?.data.kind === 'http'
              ? 'mapping.httpInputHint'
              : mapping.targetInput === 'data'
                ? 'mapping.forwardHint'
                : 'mapping.consumeHint',
          )}
        </p>
        {((mapping.targetInput === 'value' &&
          !dataTools.usesIncomingValue(target?.data.config ?? {})) ||
          (mapping.targetInput === 'condition' &&
            target?.data.config.conditionType !== 'data')) && (
          <p className="dxp-inspector-hint">
            {t(mapping.targetInput === 'value' ? 'mapping.variablesInactive' : 'mapping.inactive')}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="dxp-inspector-hint">
          {error}
        </p>
      )}
      <div className="dxp-mapping-preview" aria-live="polite">
        <strong>{t('mapping.preview')}</strong>
        {!preview ? (
          <p>{t('mapping.unavailable')}</p>
        ) : (
          <>
            <details>
              <summary>{t('mapping.sourceOutput')}</summary>
              <pre>{showValue(preview.source)}</pre>
            </details>
            {selected && (
              <>
                <span>{t('mapping.mappedValue')}</span>
                <pre>{showValue(selected)}</pre>
              </>
            )}
            {incompatible && (
              <p role="alert">
                {t('mapping.incompatible')} {incompatible}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
