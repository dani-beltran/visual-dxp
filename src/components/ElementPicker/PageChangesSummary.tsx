import { Trash2 } from 'lucide-react';
import { type ElementDescription, formatElementDescription } from '../../lib/elementDescription';
import { useBuilderI18n } from '../../lib/i18nContext';
import { type PageChange, pageChangeKey, pageChangeLabel } from '../../lib/pageChanges';
import './PageEditor.css';

export function PageChangesSummary({
  changes,
  onSelect,
  onRemove,
  selectedChange,
}: {
  changes: PageChange[];
  onSelect?: (change: PageChange) => void;
  onRemove?: (index: number) => void;
  selectedChange?: PageChange | null;
}) {
  const { t } = useBuilderI18n();
  const selectedIndex = selectedChange
    ? changes.includes(selectedChange)
      ? changes.indexOf(selectedChange)
      : changes.findIndex((change) => pageChangeKey(change) === pageChangeKey(selectedChange))
    : -1;
  return (
    <section className="dxp-page-changes" aria-label={t('pageEditor.pageChanges')}>
      <h3>
        {t('pageEditor.pageChanges')} <span>{changes.length}</span>
      </h3>
      {!changes.length && <p className="dxp-inspector-hint">{t('pageEditor.empty')}</p>}
      {Array.from(new Set(changes.map((change) => change.selector))).map((selector) => {
        const group = changes.filter((change) => change.selector === selector);
        const first = group[0];
        const kind: ElementDescription['kind'] =
          first.action === 'replace-image' || first.attribute === 'alt'
            ? 'image'
            : ['href', 'target'].includes(first.attribute ?? '')
              ? 'link'
              : (first.action ?? 'text') === 'text'
                ? 'text'
                : 'element';
        const description = group.find((change) => change.element)?.element ?? { kind };
        return (
          <div className="dxp-page-change-group" key={selector}>
            <strong className="dxp-page-element-name">
              {formatElementDescription(description, t)}
            </strong>
            {changes.map(
              (change, index) =>
                change.selector === selector && (
                  <div
                    className={`dxp-page-change-row${index === selectedIndex ? ' dxp-page-change-row-selected' : ''}`}
                    // biome-ignore lint/suspicious/noArrayIndexKey: Imported lists may repeat an operation; position distinguishes these entries.
                    key={`${pageChangeKey(change)}-${index}`}
                  >
                    {onSelect ? (
                      <button
                        type="button"
                        className="dxp-page-change-label"
                        aria-pressed={index === selectedIndex}
                        onClick={() => onSelect(change)}
                      >
                        {pageChangeLabel(change, t)}
                      </button>
                    ) : (
                      <span className="dxp-page-change-label">{pageChangeLabel(change, t)}</span>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        className="dxp-picker-icon-button"
                        aria-label={t('pageEditor.remove')}
                        onClick={() => onRemove(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ),
            )}
          </div>
        );
      })}
    </section>
  );
}
