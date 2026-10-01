import {
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { validateWorkflow } from '../lib/export';
import { useBuilderI18n } from '../lib/i18nContext';
import type { RunLog, Workflow } from '../lib/types';
import { useDialogFocus } from '../lib/useDialogFocus';
import { IsolatedPreview } from './IsolatedPreview';
export function Preview({
  workflow,
  onClose,
  onLog,
}: {
  workflow: Workflow;
  onClose: () => void;
  onLog: (log: RunLog) => void;
}) {
  const { t } = useBuilderI18n();
  const modalRef = useDialogFocus(true);
  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);
  const [revision, setRevision] = useState(0);
  const stop = useCallback(() => setRunning(false), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Any workflow edit invalidates the active run.
  useEffect(() => {
    stop();
    setLogs([]);
    setError('');
  }, [workflow, stop]);
  function run() {
    setLogs([]);
    setError('');
    const issues = validateWorkflow(workflow, t);
    if (issues.length) {
      setError(issues.map((issue) => issue.message).join(' '));
      return;
    }
    setRevision((value) => value + 1);
    setRunning(true);
  }
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and the builder's Escape handler provide keyboard dismissal.
    // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
    <div
      className={`dxp-modal-backdrop${isFullscreen ? ' dxp-preview-backdrop-fullscreen' : ''}`}
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
      <section
        ref={modalRef}
        className="dxp-modal dxp-preview"
        role="dialog"
        aria-modal="true"
        aria-label={t('preview.previewWorkflow')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dxp-modal-header">
          <div>
            <span className="dxp-eyebrow">{t('preview.testYourExperience')}</span>
            <h2>{t('preview.seeYourJourneyInAction')}</h2>
          </div>
          <div className="dxp-preview-header-actions">
            <button
              type="button"
              className="dxp-icon-button"
              aria-label={t(isFullscreen ? 'common.exitFullscreen' : 'common.enterFullscreen')}
              title={t(isFullscreen ? 'common.exitFullscreen' : 'common.enterFullscreen')}
              onClick={() => setIsFullscreen((value) => !value)}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              type="button"
              className="dxp-icon-button"
              onClick={onClose}
              aria-label={t('preview.closePreview')}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="dxp-preview-bar">
          <span className="dxp-preview-url">
            <span className="dxp-status-dot" />
            {workflow.websiteUrl}
          </span>
          <button
            type="button"
            className="dxp-button"
            onClick={() => {
              stop();
              setReady(false);
              setLogs([]);
              setError('');
              setKey((x) => x + 1);
            }}
            title={t('preview.reloadWebsite')}
            aria-label={t('preview.reloadWebsite')}
          >
            <RotateCcw size={14} />
          </button>
          {running && (
            <button type="button" className="dxp-button" onClick={stop}>
              <Square size={14} /> {t('preview.stopWorkflow')}
            </button>
          )}
          <button
            type="button"
            className="dxp-button dxp-button-primary"
            onClick={run}
            disabled={!ready}
          >
            {running ? <RotateCcw size={14} /> : <Play size={14} />}{' '}
            {running ? t('preview.restartWorkflow') : t('preview.runWorkflow')}
          </button>
        </div>
        <div className="dxp-preview-body">
          <IsolatedPreview
            key={`${workflow.websiteUrl}-${key}`}
            url={workflow.websiteUrl}
            workflow={workflow}
            running={running}
            revision={revision}
            title={t('preview.workflowPreviewWebsite')}
            onReady={(value) => {
              setReady(value);
              if (!value) setRunning(false);
            }}
            onError={setError}
            onClose={onClose}
            onLog={(log) => {
              if (!running) return;
              setLogs((previous) => [...previous, log]);
              onLog(log);
            }}
          />
          <aside className="dxp-run-log">
            <h3>
              {t('preview.executionLog')}{' '}
              <span>{logs.filter((x) => x.status === 'success').length}</span>
            </h3>
            {!logs.length && (
              <div className="dxp-log-empty">
                <Play size={25} />
                <p>
                  {running
                    ? t('preview.listeningForYourTriggers')
                    : t('preview.yourJourneyStepByStep')}
                </p>
                <small>
                  {running
                    ? t('preview.interactWithTheWebsiteToTriggerYourWorkflow')
                    : t('preview.runTheWorkflowToSeeEachActionHappenOnThePage')}
                </small>
              </div>
            )}
            {logs.map((log, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Log entries only append during a run and render stateless rows; a new run clears the list.
              <div className={`dxp-log-item ${log.status}`} key={i}>
                {log.status === 'success' ? (
                  <Check size={14} />
                ) : log.status === 'error' ? (
                  <CircleAlert size={14} />
                ) : (
                  <LoaderCircle size={14} />
                )}
                <div>
                  <strong>{log.label}</strong>
                  <p>{log.message}</p>
                </div>
              </div>
            ))}
            {error && (
              <p className="dxp-error" role="alert">
                {error}
              </p>
            )}
            <p className="dxp-log-note">
              <ExternalLink size={13} />{' '}
              {t(
                'preview.externalWebsitesNeedThePreviewBridgeConfiguredForThisBuilderOriginPreviews',
              )}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
