import '../../styles/base.css';
import '../../styles/shared.css';
import '../../styles/inspector.css';
import { Layers2, Trash2, X } from 'lucide-react';
import { useBuilderI18n } from '../../lib/i18nContext';
import './MultiNodeInspector.css';

export function MultiNodeInspector({
  count,
  onClose,
  onDelete,
}: {
  count: number;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useBuilderI18n();
  return (
    <aside className="dxp-inspector" aria-label={t('nodeInspector.multipleNodes')}>
      <header className="dxp-inspector-header">
        <div className="dxp-inspector-eyebrow">{t('nodeInspector.multipleNodes')}</div>
        <button
          type="button"
          className="dxp-inspector-icon-button"
          aria-label={t('nodeInspector.closeSelectionDetails')}
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </header>
      <div className="dxp-inspector-content">
        <div className="dxp-inspector-intro">
          <div className="dxp-inspector-node-icon dxp-inspector-node-icon-green">
            <Layers2 size={21} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h2 aria-live="polite">{t('nodeInspector.selectedNodeCount', { count })}</h2>
        </div>
      </div>
      <footer className="dxp-inspector-footer">
        <button type="button" className="dxp-inspector-delete" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" /> {t('nodeInspector.deleteNodes')}
        </button>
      </footer>
    </aside>
  );
}
