import '../../styles/base.css';
import '../../styles/shared.css';
import '../../styles/inspector.css';
import { ArrowRight, Trash2, X } from 'lucide-react';
import { useId } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { WorkflowEdge } from '../../lib/types';
import './EdgeInspector.css';

export function EdgeInspector({
  edge,
  sourceLabel,
  targetLabel,
  onChange,
  onBlur,
  onClose,
  onDelete,
}: {
  edge: WorkflowEdge;
  sourceLabel: string;
  targetLabel: string;
  onChange: (label: string) => void;
  onBlur: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useBuilderI18n();
  const id = useId();

  return (
    <aside className="dxp-inspector" aria-label={t('edgeInspector.connectionConfiguration')}>
      <header className="dxp-inspector-header">
        <div className="dxp-inspector-eyebrow">{t('edgeInspector.connectionDetails')}</div>
        <button
          type="button"
          className="dxp-inspector-icon-button"
          title={t('edgeInspector.closeConnectionDetails')}
          aria-label={t('edgeInspector.closeConnectionDetails')}
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <div className="dxp-inspector-content">
        <div className="dxp-inspector-intro">
          <div className="dxp-inspector-node-icon dxp-inspector-node-icon-green">
            <ArrowRight size={21} strokeWidth={1.8} />
          </div>
          <div>
            <h2>{t('edgeInspector.connection')}</h2>
            <span>{t('edgeInspector.betweenWorkflowSteps')}</span>
          </div>
        </div>
        <p className="dxp-inspector-description dxp-inspector-connection-summary">
          {sourceLabel} → {targetLabel}
        </p>
        <div className="dxp-inspector-field">
          <label htmlFor={`${id}-name`}>{t('edgeInspector.connectionName')}</label>
          <input
            id={`${id}-name`}
            value={typeof edge.label === 'string' ? edge.label : ''}
            placeholder={t('edgeInspector.eGContinueToWelcome')}
            aria-describedby={`${id}-hint`}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
          <p id={`${id}-hint`} className="dxp-inspector-hint">
            {t('edgeInspector.shownOnTheConnectionLeaveEmptyToHideTheName')}
          </p>
        </div>
      </div>
      <footer className="dxp-inspector-footer">
        <button type="button" className="dxp-inspector-delete" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" /> {t('edgeInspector.deleteConnection')}
        </button>
      </footer>
    </aside>
  );
}
