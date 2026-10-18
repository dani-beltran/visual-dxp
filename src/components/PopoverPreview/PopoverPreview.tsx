import '../../styles/base.css';
import '../../styles/shared.css';
import { LoaderCircle, PanelTop, Redo2, RefreshCw, Undo2, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { validateWorkflow } from '../../lib/export';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { StepConfig, Workflow, WorkflowNode } from '../../lib/types';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { IsolatedPreview } from '../IsolatedPreview/IsolatedPreview';
import { EditorDiscardDialog, PreviewDeviceToggle } from '../WebsiteEditor/WebsiteEditor';
import { PopoverEditorPanel } from './PopoverEditorPanel';
import './PopoverPreview.css';

/** Fullscreen popover editor. Only Save writes the local draft to the workflow. */
export function PopoverPreview({
  node,
  websiteUrl,
  onClose,
  onSave,
  guidance,
}: {
  guidance?: ReactNode;
  node: WorkflowNode;
  websiteUrl: string;
  onClose: () => void;
  onSave: (config: StepConfig) => void;
}) {
  const { t } = useBuilderI18n();
  const [config, setConfig] = useState<StepConfig>(() => structuredClone(node.data.config));
  const [history, setHistory] = useState<{ past: StepConfig[]; future: StepConfig[] }>({
    past: [],
    future: [],
  });
  const undo = useCallback(() => {
    if (!history.past.length) return;
    setConfig(history.past[history.past.length - 1]);
    setHistory({ past: history.past.slice(0, -1), future: [config, ...history.future] });
    setRuntimeError('');
    setPicking(false);
  }, [history, config]);
  const redo = useCallback(() => {
    if (!history.future.length) return;
    setConfig(history.future[0]);
    setHistory({ past: [...history.past, config], future: history.future.slice(1) });
    setRuntimeError('');
    setPicking(false);
  }, [history, config]);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [picking, setPicking] = useState(false);
  const [canPick, setCanPick] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dialogRef = useDialogFocus(!discard);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [websiteError, setWebsiteError] = useState('');
  const [runtimeError, setRuntimeError] = useState('');
  const dirty = JSON.stringify(config) !== JSON.stringify(node.data.config);
  const requestClose = useCallback(() => {
    setPicking(false);
    if (dirty) setDiscard(true);
    else onClose();
  }, [dirty, onClose]);
  const workflow = useMemo<Workflow>(
    () => ({
      version: 1,
      name: 'Popover preview',
      websiteUrl,
      nodes: [
        {
          id: `${node.id}-preview-trigger`,
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 'Preview', config: { event: 'page-load' } },
        },
        { ...node, data: { ...node.data, config } },
      ],
      edges: [{ id: 'preview-edge', source: `${node.id}-preview-trigger`, target: node.id }],
    }),
    [node, config, websiteUrl],
  );
  const validationError = validateWorkflow(workflow, t).find(
    (issue) => issue.nodeId === node.id,
  )?.message;
  const error = validationError || websiteError || runtimeError;
  const update = (patch: Partial<StepConfig>) => {
    setRuntimeError('');
    if (patch.position && patch.position !== 'anchor') setPicking(false);
    const next = { ...config, ...patch };
    if (JSON.stringify(next) === JSON.stringify(config)) return;
    setHistory({ past: [...history.past, config], future: [] });
    setConfig(next);
  };

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (key === 'z' || (event.ctrlKey && key === 'y'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (discard || picking) return;
        if (event.shiftKey || key === 'y') redo();
        else undo();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (discard) setDiscard(false);
        else if (picking) setPicking(false);
        else requestClose();
      }
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [requestClose, picking, discard, undo, redo]);

  return (
    <section
      ref={dialogRef}
      className="dxp-popover-preview"
      role="dialog"
      aria-modal="true"
      aria-label={t('popoverEditor.editPopover')}
    >
      <header className="dxp-popover-preview-header">
        <div className="dxp-popover-preview-heading">
          <div className="dxp-editor-title-icon">
            <PanelTop size={19} aria-hidden="true" />
          </div>
          <div className="dxp-editor-heading">
            <h2>{t('popoverEditor.editPopover')}</h2>
            <p>{t('popoverEditor.description')}</p>
          </div>
        </div>
        <button
          type="button"
          className="dxp-icon-button"
          onClick={requestClose}
          aria-label={t('common.cancel')}
        >
          <X size={20} />
        </button>
      </header>
      <div className="dxp-popover-preview-bar">
        <span>
          <span className="dxp-status-dot" aria-hidden="true" />
          {websiteUrl === '/demo-site.html' ? t('popoverPreview.demoWebsite') : websiteUrl}
        </span>
        <div className="dxp-popover-preview-devices">
          <PreviewDeviceToggle device={device} onChange={setDevice} />
          <button
            type="button"
            className="dxp-button"
            title={t('preview.reloadWebsite')}
            aria-label={t('preview.reloadWebsite')}
            onClick={() => {
              setPicking(false);
              setReady(false);
              setCanPick(false);
              setWebsiteError('');
              setRuntimeError('');
              setReload((value) => value + 1);
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
        <span className="dxp-toolbar-divider" aria-hidden="true" />
        <div className="dxp-popover-editor-history">
          <button
            type="button"
            className="dxp-button"
            disabled={!history.past.length}
            title={t('builder.undoZ')}
            aria-keyshortcuts="Meta+Z Control+Z"
            onClick={undo}
          >
            <Undo2 size={14} /> {t('common.undo')}
          </button>
          <button
            type="button"
            className="dxp-button"
            disabled={!history.future.length}
            title={t('builder.redoZ')}
            aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
            onClick={redo}
          >
            <Redo2 size={14} /> {t('common.redo')}
          </button>
        </div>
      </div>
      {error && (
        <p className="dxp-popover-preview-error" role="alert">
          {error}
        </p>
      )}
      {guidance}
      <div className="dxp-website-editor-layout">
        <div
          className={`dxp-editor-viewport dxp-popover-preview-website${device === 'mobile' ? ' dxp-popover-preview-mobile' : ''}`}
        >
          {!ready && !websiteError && (
            <div className="dxp-popover-preview-loading" role="status">
              <LoaderCircle className="dxp-spin" size={18} /> {t('popoverPreview.loadingWebsite')}
            </div>
          )}
          <IsolatedPreview
            key={`${websiteUrl}-${reload}`}
            url={websiteUrl}
            workflow={workflow}
            running={ready && !validationError && !picking}
            revision={0}
            title={t('popoverPreview.popoverPreviewWebsite')}
            onReady={setReady}
            picking={picking}
            onPickingReady={setCanPick}
            onPickElement={(selector) => {
              update({ selector });
              setPicking(false);
            }}
            onPickCancel={() => setPicking(false)}
            onError={setWebsiteError}
            onLog={(log) => {
              if (log.status === 'error') setRuntimeError(log.message);
            }}
            onClose={() => {
              if (picking) setPicking(false);
              else requestClose();
            }}
          />
        </div>
        <PopoverEditorPanel
          config={config}
          onChange={update}
          picking={picking}
          canPick={canPick}
          ready={ready}
          onPickAnchor={() => setPicking((value) => !value)}
        />
      </div>
      <footer className="dxp-website-editor-footer">
        <span>{t(dirty ? 'popoverEditor.unsavedChanges' : 'popoverEditor.previewHint')}</span>
        <button type="button" className="dxp-button" onClick={requestClose}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="dxp-button dxp-button-primary"
          disabled={!!validationError}
          onClick={() => onSave(config)}
        >
          {t('pageEditor.saveChanges')}
        </button>
      </footer>
      {discard && (
        <EditorDiscardDialog
          title={t('popoverEditor.cancelTitle')}
          onKeepEditing={() => setDiscard(false)}
          onDiscard={onClose}
        />
      )}
    </section>
  );
}
