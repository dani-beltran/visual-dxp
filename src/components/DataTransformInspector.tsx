import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { type DataTransformation, dataTransformTools, type JsonValue } from '../lib/dataTransform';
import { useBuilderI18n } from '../lib/i18nContext';
import type { StepConfig } from '../lib/types';
import { Select } from './Select';

function FallbackInput({
  value,
  onChange,
}: {
  value: JsonValue;
  onChange: (value: JsonValue) => void;
}) {
  const { t } = useBuilderI18n();
  const id = useId();
  const [mode, setMode] = useState(typeof value === 'string' ? 'text' : 'json');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(mode === 'text' ? String(value ?? '') : JSON.stringify(value, null, 2));
    setError('');
  }, [value, mode]);
  return (
    <>
      <label htmlFor={`${id}-mode`}>{t('transform.fallbackType')}</label>
      <Select
        id={`${id}-mode`}
        value={mode}
        onChange={(event) => {
          const next = event.target.value;
          setMode(next);
          if (next === 'text') onChange(typeof value === 'string' ? value : JSON.stringify(value));
        }}
      >
        <option value="text">{t('transform.text')}</option>
        <option value="json">{t('transform.json')}</option>
      </Select>
      <label htmlFor={`${id}-value`}>{t('transform.fallbackValue')}</label>
      <textarea
        id={`${id}-value`}
        rows={2}
        value={draft}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          setDraft(event.target.value);
          if (mode === 'text') {
            onChange(event.target.value);
            return;
          }
          try {
            const parsed = JSON.parse(event.target.value);
            if (!dataTransformTools.jsonValue(parsed)) throw new Error();
            setError('');
            onChange(parsed);
          } catch {
            setError(t('transform.invalidFallback'));
          }
        }}
      />
      {error && (
        <p className="dxp-inspector-hint" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function DataTransformInspector({
  config,
  onChange,
}: {
  config: StepConfig;
  onChange: (patch: Partial<StepConfig>) => void;
}) {
  const { t } = useBuilderI18n();
  const id = useId();
  const transformations = config.transformations ?? [];
  const operationKeys = useRef(new WeakMap<DataTransformation, string>());
  const operationKey = (item: DataTransformation) => {
    let key = operationKeys.current.get(item);
    if (!key) {
      key = crypto.randomUUID();
      operationKeys.current.set(item, key);
    }
    return key;
  };
  let error = '';
  try {
    dataTransformTools.validate(config);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const update = (index: number, transformation: DataTransformation) => {
    operationKeys.current.set(transformation, operationKey(transformations[index]));
    onChange({
      transformations: transformations.map((item, i) => (i === index ? transformation : item)),
    });
  };
  const move = (index: number, direction: number) => {
    const next = [...transformations];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange({ transformations: next });
  };
  return (
    <section className="dxp-data-transform" aria-label={t('nodes.transform.label')}>
      <div className="dxp-inspector-field">
        <label htmlFor={`${id}-path`}>{t('transform.dataPath')}</label>
        <input
          id={`${id}-path`}
          value={config.dataPath ?? ''}
          placeholder="user.items[0].name"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange({ dataPath: event.target.value })}
        />
        <p id={`${id}-hint`} className="dxp-inspector-hint">
          {t('transform.pathHint')}
        </p>
      </div>
      <h3 className="dxp-inspector-section-label">{t('transform.transformations')}</h3>
      <p className="dxp-inspector-hint">{t('transform.orderHint')}</p>
      {transformations.map((transformation, index) => (
        <div
          className="dxp-transform-operation dxp-inspector-field"
          key={operationKey(transformation)}
        >
          <label htmlFor={`${id}-${index}-type`}>
            {t('transform.operation', { number: index + 1 })}
          </label>
          <Select
            id={`${id}-${index}-type`}
            value={transformation.type}
            onChange={(event) => {
              const type = event.target.value as DataTransformation['type'];
              update(
                index,
                type === 'prefix' || type === 'suffix' || type === 'fallback'
                  ? { type, value: '' }
                  : type === 'replace'
                    ? { type, find: '', replacement: '' }
                    : { type },
              );
            }}
          >
            {dataTransformTools.types.map((type) => (
              <option key={type} value={type}>
                {t(`transform.${type}`)}
              </option>
            ))}
          </Select>
          {(transformation.type === 'prefix' || transformation.type === 'suffix') && (
            <>
              <label htmlFor={`${id}-${index}-text`}>{t('transform.textToAdd')}</label>
              <input
                id={`${id}-${index}-text`}
                value={transformation.value}
                onChange={(event) =>
                  update(index, { ...transformation, value: event.target.value })
                }
              />
            </>
          )}
          {transformation.type === 'replace' && (
            <>
              <label htmlFor={`${id}-${index}-find`}>{t('transform.find')}</label>
              <input
                id={`${id}-${index}-find`}
                value={transformation.find}
                onChange={(event) => update(index, { ...transformation, find: event.target.value })}
              />
              <label htmlFor={`${id}-${index}-replacement`}>{t('transform.replacement')}</label>
              <input
                id={`${id}-${index}-replacement`}
                value={transformation.replacement}
                onChange={(event) =>
                  update(index, { ...transformation, replacement: event.target.value })
                }
              />
              <p className="dxp-inspector-hint">{t('transform.replaceHint')}</p>
            </>
          )}
          {transformation.type === 'fallback' && (
            <FallbackInput
              value={transformation.value}
              onChange={(value) => update(index, { ...transformation, value })}
            />
          )}
          <div className="dxp-transform-actions">
            <button
              type="button"
              className="dxp-inspector-icon-button"
              disabled={index === 0}
              aria-label={t('transform.moveUp', { number: index + 1 })}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              className="dxp-inspector-icon-button"
              disabled={index === transformations.length - 1}
              aria-label={t('transform.moveDown', { number: index + 1 })}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              className="dxp-inspector-icon-button"
              aria-label={t('transform.remove', { number: index + 1 })}
              onClick={() =>
                onChange({ transformations: transformations.filter((_, i) => i !== index) })
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="dxp-inspector-pick"
        disabled={transformations.length >= 100}
        onClick={() => onChange({ transformations: [...transformations, { type: 'trim' }] })}
      >
        <Plus size={14} /> {t('transform.add')}
      </button>
      {error && (
        <p role="alert" className="dxp-inspector-hint">
          {error}
        </p>
      )}
    </section>
  );
}
