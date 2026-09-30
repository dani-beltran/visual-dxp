import { Globe2, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StepConfig, Workflow, WorkflowNode } from '../lib/types';
import { useDialogFocus } from '../lib/useDialogFocus';
import { IsolatedPreview } from './IsolatedPreview';
import '../styles/popover-preview.css';

const positions: Record<NonNullable<StepConfig['position']>, string> = {
  center: 'Center of screen',
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  anchor: 'Next to an element',
};

export function PopoverPreview({ node, onClose }: { node: WorkflowNode; onClose: () => void }) {
  const dialogRef = useDialogFocus(true);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const config = node.data.config;
  const workflow = useMemo<Workflow>(
    () => ({
      version: 1,
      name: 'Popover preview',
      websiteUrl: '/demo-site.html',
      nodes: [
        {
          id: 'preview-trigger',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 'Preview', config: { event: 'page-load' } },
        },
        node,
      ],
      edges: [{ id: 'preview-edge', source: 'preview-trigger', target: node.id }],
    }),
    [node],
  );
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [onClose]);

  return (
    <section
      ref={dialogRef}
      className="dxp-popover-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen popover preview"
    >
      <header className="dxp-popover-preview-header">
        <div className="dxp-popover-preview-heading">
          <span className="dxp-eyebrow">CONTENT PREVIEW</span>
          <h2>{node.data.label || 'Popover'}</h2>
        </div>
        <button
          type="button"
          className="dxp-button"
          onClick={() => {
            setReady(false);
            setError('');
            setReload((value) => value + 1);
          }}
        >
          <RotateCcw size={14} /> Restart preview
        </button>
        <button
          type="button"
          className="dxp-icon-button"
          onClick={onClose}
          aria-label="Close popover preview"
          title="Close preview (Esc)"
        >
          <X size={20} />
        </button>
      </header>
      <div className="dxp-popover-preview-bar">
        <span>
          <Globe2 size={14} /> Demo website
        </span>
        <span>
          {positions[config.position ?? 'bottom-right']} · {config.width ?? 360} px
        </span>
      </div>
      {error && (
        <p className="dxp-popover-preview-error" role="alert">
          {error}
        </p>
      )}
      <div className="dxp-popover-preview-website">
        {!ready && !error && (
          <div className="dxp-popover-preview-loading" role="status">
            <LoaderCircle className="dxp-spin" size={18} /> Loading demo website…
          </div>
        )}
        <IsolatedPreview
          key={reload}
          url="/demo-site.html"
          workflow={workflow}
          running={ready}
          revision={0}
          title="Popover preview website"
          onReady={setReady}
          onError={setError}
          onLog={(log) => {
            if (log.status === 'error') setError(log.message);
          }}
          onClose={onClose}
        />
      </div>
    </section>
  );
}
