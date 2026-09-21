import { ArrowRight, Trash2, X } from 'lucide-react';
import { useId } from 'react';
import type { WorkflowEdge } from '../lib/types';
import '../styles/inspector.css';

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
  const id = useId();

  return (
    <aside className="dxp-inspector" aria-label="Connection configuration">
      <header className="dxp-inspector-header">
        <div className="dxp-inspector-eyebrow">CONNECTION DETAILS</div>
        <button
          type="button"
          className="dxp-inspector-icon-button"
          title="Close connection details"
          aria-label="Close connection details"
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
            <h2>Connection</h2>
            <span>Between workflow steps</span>
          </div>
        </div>
        <p className="dxp-inspector-description dxp-inspector-connection-summary">
          {sourceLabel} → {targetLabel}
        </p>
        <div className="dxp-inspector-field">
          <label htmlFor={`${id}-name`}>Connection name</label>
          <input
            id={`${id}-name`}
            value={typeof edge.label === 'string' ? edge.label : ''}
            placeholder="e.g. Continue to welcome"
            aria-describedby={`${id}-hint`}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
          <p id={`${id}-hint`} className="dxp-inspector-hint">
            Shown on the connection. Leave empty to hide the name.
          </p>
        </div>
      </div>
      <footer className="dxp-inspector-footer">
        <button type="button" className="dxp-inspector-delete" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" /> Delete connection
        </button>
      </footer>
    </aside>
  );
}
