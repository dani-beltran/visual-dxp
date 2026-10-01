import { Globe2, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';
import type { StepConfig, Workflow, WorkflowNode } from '../lib/types';
import { useDialogFocus } from '../lib/useDialogFocus';
import { IsolatedPreview } from './IsolatedPreview';
import '../styles/popover-preview.css';

export function PopoverPreview({
  node,
  websiteUrl,
  onClose,
}: {
  node: WorkflowNode;
  websiteUrl: string;
  onClose: () => void;
}) {
  const { t } = useBuilderI18n();
  const positions: Record<NonNullable<StepConfig['position']>, string> = {
    center: t('popoverPreview.centerOfScreen'),
    'top-left': t('popoverPreview.topLeft'),
    'top-right': t('popoverPreview.topRight'),
    'bottom-left': t('popoverPreview.bottomLeft'),
    'bottom-right': t('popoverPreview.bottomRight'),
    anchor: t('popoverPreview.nextToAnElement'),
  };
  const dialogRef = useDialogFocus(true);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const config = node.data.config;
  const workflow = useMemo<Workflow>(
    () => ({
      version: 1,
      name: 'Popover preview',
      websiteUrl,
      nodes: [
        {
          id: 'preview-trigger',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'trigger',
            label: 'Preview',
            config: { event: 'page-load' },
          },
        },
        node,
      ],
      edges: [{ id: 'preview-edge', source: 'preview-trigger', target: node.id }],
    }),
    [node, websiteUrl],
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
      aria-label={t('popoverPreview.fullscreenPopoverPreview')}
    >
      <header className="dxp-popover-preview-header">
        <div className="dxp-popover-preview-heading">
          <span className="dxp-eyebrow">{t('popoverPreview.contentPreview')}</span>
          <h2>{node.data.label || t('popoverPreview.popover')}</h2>
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
          <RotateCcw size={14} /> {t('popoverPreview.restartPreview')}
        </button>
        <button
          type="button"
          className="dxp-icon-button"
          onClick={onClose}
          aria-label={t('popoverPreview.closePopoverPreview')}
          title={t('popoverPreview.closePreviewEsc')}
        >
          <X size={20} />
        </button>
      </header>
      <div className="dxp-popover-preview-bar">
        <span>
          <Globe2 size={14} />{' '}
          {websiteUrl === '/demo-site.html' ? t('popoverPreview.demoWebsite') : websiteUrl}
        </span>
        <span>
          {positions[config.position ?? 'bottom-right']} · {config.width ?? 360}{' '}
          {t('popoverPreview.px')}
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
            <LoaderCircle className="dxp-spin" size={18} /> {t('popoverPreview.loadingWebsite')}
          </div>
        )}
        <IsolatedPreview
          key={`${websiteUrl}-${reload}`}
          url={websiteUrl}
          workflow={workflow}
          running={ready}
          revision={0}
          title={t('popoverPreview.popoverPreviewWebsite')}
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
