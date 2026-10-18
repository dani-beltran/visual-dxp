import { MousePointer2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { dataTools } from '../../lib/data';
import { formatElementDescription } from '../../lib/elementDescription';
import { useBuilderI18n } from '../../lib/i18nContext';
import { type PageChange, pageChangeKey } from '../../lib/pageChanges';
import { type PageUrlContext, websiteUrl } from '../../lib/pageUrls';
import type { PickedElement } from '../../lib/picker';
import { PageChangesSummary } from './PageChangesSummary';

type AdvancedAction = Exclude<NonNullable<PageChange['action']>, 'text' | 'replace-image'>;
type AdvancedFields = {
  selector: string;
  action: AdvancedAction;
  attribute: string;
  value: string;
};

function advancedFields(selector: string, change?: PageChange): AdvancedFields {
  return {
    selector: change?.selector ?? selector,
    action: change && isAdvancedAction(change.action) ? change.action : 'add-class',
    attribute: change?.attribute ?? '',
    value: change?.value ?? '',
  };
}

function isAdvancedAction(action: PageChange['action']): action is AdvancedAction {
  return action !== undefined && action !== 'text' && action !== 'replace-image';
}

export function PageEditorPanel({
  selected,
  changes,
  onEdit,
  getChangeId = pageChangeKey,
  onRemove,
  onSelect,
  focusedChange,
  urlContext = {},
}: {
  selected: PickedElement | null;
  changes: PageChange[];
  onEdit: (change: PageChange, previous?: PageChange) => string | void;
  getChangeId?: (change: PageChange) => string;
  onRemove: (index: number) => void;
  onSelect: (change: PageChange) => void;
  focusedChange: PageChange | null;
  urlContext?: PageUrlContext;
}) {
  const { t } = useBuilderI18n();
  const prefix = useId();
  const [advanced, setAdvanced] = useState(() =>
    advancedFields(
      selected?.selector ?? '',
      focusedChange && isAdvancedAction(focusedChange.action) ? focusedChange : undefined,
    ),
  );
  const { selector: manualSelector, action, attribute, value } = advanced;
  // Session identity survives selector/action renames and Undo/Redo without entering saved data.
  const advancedId = useRef<string | null>(
    focusedChange && isAdvancedAction(focusedChange.action) ? getChangeId(focusedChange) : null,
  );
  const prior = useRef({ selector: selected?.selector, focusedChange, changes });
  useEffect(() => {
    const previous = prior.current;
    prior.current = { selector: selected?.selector, focusedChange, changes };
    if (previous.selector !== selected?.selector || previous.focusedChange !== focusedChange) {
      const change =
        focusedChange && isAdvancedAction(focusedChange.action)
          ? changes.find((item) => getChangeId(item) === getChangeId(focusedChange))
          : undefined;
      advancedId.current = change ? getChangeId(change) : null;
      setAdvanced(advancedFields(selected?.selector ?? '', change));
    } else if (previous.changes !== changes && advancedId.current !== null) {
      const change = changes.find((item) => getChangeId(item) === advancedId.current);
      setAdvanced(
        advancedFields(
          selected?.selector ?? '',
          change && isAdvancedAction(change.action) ? change : undefined,
        ),
      );
    }
  }, [selected?.selector, focusedChange, changes, getChangeId]);
  const updateAdvanced = (patch: Partial<AdvancedFields>) => {
    const next = { ...advanced, ...patch };
    setAdvanced(next);
    const selector = next.selector.trim();
    const attribute = next.attribute.trim();
    if (!selector || (next.action === 'attribute' && !attribute)) return;
    const change: PageChange = {
      selector,
      action: next.action,
      value: next.value,
      ...(next.action === 'attribute' ? { attribute } : {}),
    };
    try {
      dataTools.validateElementValue(change);
      if (!dataTools.hasVariables(selector)) document.querySelector(selector);
      if (next.action === 'attribute' && !dataTools.hasVariables(attribute))
        document.createElement('div').setAttribute(attribute, '');
    } catch {
      // Keep incomplete selectors, attribute names and templates editable until valid.
      return;
    }
    const previous = changes.find((item) => getChangeId(item) === advancedId.current);
    const result = onEdit(
      change,
      previous && isAdvancedAction(previous.action) ? previous : undefined,
    );
    advancedId.current = typeof result === 'string' ? result : getChangeId(change);
  };
  const fieldValue = (action: PageChange['action'], fallback: string, attribute?: string) =>
    [...changes]
      .reverse()
      .find(
        (change) =>
          change.selector === selected?.selector &&
          (change.action ?? 'text') === action &&
          change.attribute === attribute &&
          (action !== 'text' ||
            JSON.stringify(change.textPath) === JSON.stringify(selected?.textPath) ||
            change.textPath === undefined),
      )?.value ?? fallback;
  const edit = (patch: Omit<PageChange, 'selector'>) => {
    if (selected) onEdit({ ...patch, selector: selected.selector });
  };
  const destination = websiteUrl(fieldValue('attribute', selected?.href ?? '', 'href'), urlContext);
  let invalidLink = false;
  if (selected?.href !== undefined && !dataTools.hasVariables(destination)) {
    try {
      const url = new URL(destination, 'https://preview.invalid');
      invalidLink =
        !['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ||
        !!url.username ||
        !!url.password;
    } catch {
      invalidLink = true;
    }
  }
  return (
    <aside className="dxp-page-editor-panel" aria-label={t('pageEditor.selectedElement')}>
      {selected ? (
        <>
          <div className="dxp-page-editor-selection">
            <span>{t('pageEditor.selectedElement')}</span>
            <strong>
              {formatElementDescription(
                selected.description ?? { kind: 'element', name: selected.tagName },
                t,
              )}
            </strong>
          </div>
          {selected.editableText && (
            <label htmlFor={`${prefix}-text`}>
              {selected.href !== undefined
                ? t('pageEditor.linkText')
                : t('nodeInspector.changeText')}
              <textarea
                id={`${prefix}-text`}
                aria-label={
                  selected.href !== undefined
                    ? t('pageEditor.linkText')
                    : t('nodeInspector.changeText')
                }
                value={fieldValue('text', selected.text)}
                onChange={(event) =>
                  edit({ action: 'text', value: event.target.value, textPath: selected.textPath })
                }
              />
              {selected.href === undefined && <small>{t('pageEditor.inlineHint')}</small>}
            </label>
          )}
          {selected.src !== undefined && (
            <>
              <label htmlFor={`${prefix}-image`}>
                {t('nodeInspector.imageUrl')}
                <input
                  id={`${prefix}-image`}
                  value={websiteUrl(fieldValue('replace-image', selected.src), urlContext)}
                  onChange={(event) => edit({ action: 'replace-image', value: event.target.value })}
                />
              </label>
              <label htmlFor={`${prefix}-alt`}>
                {t('nodeInspector.imageAlt')}
                <input
                  id={`${prefix}-alt`}
                  value={fieldValue('attribute', selected.alt ?? '', 'alt')}
                  onChange={(event) =>
                    edit({ action: 'attribute', attribute: 'alt', value: event.target.value })
                  }
                />
              </label>
            </>
          )}
          {selected.href !== undefined && (
            <>
              <label htmlFor={`${prefix}-href`}>
                {t('pageEditor.destination')}
                <input
                  id={`${prefix}-href`}
                  value={destination}
                  aria-invalid={invalidLink}
                  onChange={(event) =>
                    edit({ action: 'attribute', attribute: 'href', value: event.target.value })
                  }
                />
                {invalidLink && <small role="alert">{t('pageEditor.invalidLink')}</small>}
              </label>
              <label className="dxp-page-editor-checkbox">
                <input
                  type="checkbox"
                  checked={
                    fieldValue('attribute', selected.linkTarget ?? '', 'target') === '_blank'
                  }
                  onChange={(event) =>
                    edit({
                      action: 'attribute',
                      attribute: 'target',
                      value: event.target.checked ? '_blank' : '_self',
                    })
                  }
                />
                {t('pageEditor.newTab')}
              </label>
            </>
          )}
        </>
      ) : (
        <div className="dxp-page-editor-empty">
          <span className="dxp-page-editor-empty-icon" aria-hidden="true">
            <MousePointer2 size={32} strokeWidth={1.5} />
          </span>
          <p>{t('pageEditor.selectElement')}</p>
        </div>
      )}
      {selected && (
        <details
          className="dxp-page-editor-advanced"
          open={!!focusedChange && isAdvancedAction(focusedChange.action)}
        >
          <summary>{t('pageEditor.advanced')}</summary>
          <label htmlFor={`${prefix}-selector`}>
            {t('elementPicker.cssSelector')}
            <input
              id={`${prefix}-selector`}
              value={manualSelector}
              onChange={(event) => updateAdvanced({ selector: event.target.value })}
            />
          </label>
          <label htmlFor={`${prefix}-action`}>
            {t('nodeInspector.action')}
            <select
              id={`${prefix}-action`}
              value={action}
              onChange={(event) => updateAdvanced({ action: event.target.value as AdvancedAction })}
            >
              <option value="html">{t('nodeInspector.replaceHtml')}</option>
              <option value="add-class">{t('nodeInspector.addCssClass')}</option>
              <option value="remove-class">{t('nodeInspector.removeCssClass')}</option>
              <option value="hide">{t('nodeInspector.hideElement')}</option>
              <option value="show">{t('nodeInspector.showElement')}</option>
              <option value="attribute">{t('nodeInspector.setAttribute')}</option>
            </select>
          </label>
          {action === 'attribute' && (
            <label htmlFor={`${prefix}-attribute`}>
              {t('nodeInspector.attributeName')}
              <input
                id={`${prefix}-attribute`}
                value={attribute}
                onChange={(event) => updateAdvanced({ attribute: event.target.value })}
              />
            </label>
          )}
          {!['hide', 'show'].includes(action ?? '') && (
            <label htmlFor={`${prefix}-value`}>
              {t('pageEditor.value')}
              <textarea
                id={`${prefix}-value`}
                value={value}
                onChange={(event) => updateAdvanced({ value: event.target.value })}
              />
            </label>
          )}
        </details>
      )}
      <PageChangesSummary
        changes={changes}
        onRemove={onRemove}
        onSelect={onSelect}
        selectedChange={focusedChange}
      />
    </aside>
  );
}
