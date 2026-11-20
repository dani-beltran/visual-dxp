import '../../styles/base.css';
import '../../styles/shared.css';
import { LoaderCircle, Redo2, Undo2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { validateWorkflow } from '../../lib/export';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { StepConfig, Workflow, WorkflowNode } from '../../lib/types';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { IsolatedPreview } from '../IsolatedPreview/IsolatedPreview';
import {
  EditorDiscardDialog,
  WebsitePreviewHeader,
  WebsitePreviewToolbar,
} from '../WebsiteEditor/WebsiteEditor';
import './PopoverPreview.css';

/** The draft and picking state handed to a node's settings panel. */
export interface PopoverDraftEditor {
  config: StepConfig;
  update: (patch: Partial<StepConfig>) => void;
  picking: boolean;
  setPicking: (picking: boolean) => void;
  canPick: boolean;
  ready: boolean;
}

export interface PopoverEditorDialogProps {
  node: WorkflowNode;
  websiteUrl: string;
  onClose: () => void;
  onSave: (config: StepConfig) => void;
  guidance?: ReactNode;
  icon: ReactNode;
  text: {
    title: string;
    description: string;
    unsavedChanges: string;
    previewHint: string;
    cancelTitle: string;
    previewTitle: string;
  };
  renderPanel: (editor: PopoverDraftEditor) => ReactNode;
  /** Store an element picked on the website in the draft. */
  pickPatch: (config: StepConfig, selector: string) => Partial<StepConfig>;
  /** Tour nodes only: the zero-based step the website preview opens at. */
  previewStep?: number;
}

/**
 * Fullscreen editor for nodes that display popovers. It previews the draft on the website
 * and only Save writes the draft to the workflow.
 */
export function PopoverEditorDialog({
  node,
  websiteUrl,
  onClose,
  onSave,
  guidance,
  icon,
  text,
  renderPanel,
  pickPatch,
  previewStep,
}: PopoverEditorDialogProps) {
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
        // Canvas grouping belongs to the full workflow, not this isolated preview.
        {
          id: node.id,
          type: node.type,
          position: { x: 0, y: 0 },
          data: { ...node.data, config },
        },
      ],
      edges: [{ id: 'preview-edge', source: `${node.id}-preview-trigger`, target: node.id }],
    }),
    [node, config, websiteUrl],
  );
  // A stable object keeps the preview from restarting on unrelated renders.
  const tourStartSteps = useMemo(
    () => (previewStep === undefined ? undefined : { [node.id]: previewStep }),
    [node.id, previewStep],
  );
  const validationError = validateWorkflow(workflow, t).find(
    (issue) => issue.nodeId === node.id,
  )?.message;
  const error = validationError || websiteError || runtimeError;
  const update = (patch: Partial<StepConfig>) => {
    setRuntimeError('');
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
      aria-label={text.title}
    >
      <WebsitePreviewHeader
        icon={icon}
        title={text.title}
        description={text.description}
        closeLabel={t('common.cancel')}
        onClose={requestClose}
      />
      <WebsitePreviewToolbar
        className="dxp-popover-preview-bar"
        url={websiteUrl}
        device={device}
        onDeviceChange={setDevice}
        onReload={() => {
          setPicking(false);
          setReady(false);
          setCanPick(false);
          setWebsiteError('');
          setRuntimeError('');
          setReload((value) => value + 1);
        }}
        actions={
          <>
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
          </>
        }
      />
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
            tourStartSteps={tourStartSteps}
            running={ready && !validationError && !picking}
            revision={0}
            title={text.previewTitle}
            onReady={setReady}
            picking={picking}
            onPickingReady={setCanPick}
            onPickElement={(selector) => {
              update(pickPatch(config, selector));
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
        {renderPanel({ config, update, picking, setPicking, canPick, ready })}
      </div>
      <footer className="dxp-website-editor-footer">
        <span>{dirty ? text.unsavedChanges : text.previewHint}</span>
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
          title={text.cancelTitle}
          onKeepEditing={() => setDiscard(false)}
          onDiscard={onClose}
        />
      )}
    </section>
  );
}
