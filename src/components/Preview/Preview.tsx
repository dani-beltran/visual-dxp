import '../../styles/base.css';
import '../../styles/shared.css';
import {
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ConnectionPreview } from '../../lib/connections';
import { validateWorkflow } from '../../lib/export';
import { useBuilderI18n } from '../../lib/i18nContext';
import { usePreviewTransport } from '../../lib/previewTransport';
import type { PreviewExecutionEvent, RunLog, Workflow } from '../../lib/types';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { IsolatedPreview } from '../IsolatedPreview/IsolatedPreview';
import { WebsitePreviewHeader, WebsitePreviewToolbar } from '../WebsiteEditor/WebsiteEditor';
import './Preview.css';

function websiteSearch(url: string) {
  try {
    return new URL(url, 'https://preview.example').search.slice(1);
  } catch {
    return '';
  }
}

export function Preview({
  workflow,
  onClose,
  onLog,
  onConnectionPreview,
  onPreviewStart,
  guidance,
  onExecution,
}: {
  guidance?: ReactNode;
  onExecution?: (event: PreviewExecutionEvent) => void;
  workflow: Workflow;
  onConnectionPreview?: (edgeId: string, preview: ConnectionPreview) => void;
  onPreviewStart?: () => void;
  onClose: () => void;
  onLog: (log: RunLog) => void;
}) {
  const { t } = useBuilderI18n();
  const transport = usePreviewTransport();
  const searchParamsId = useId();
  const [searchParams, setSearchParams] = useState(() => websiteSearch(workflow.websiteUrl));
  useEffect(() => {
    setSearchParams(websiteSearch(workflow.websiteUrl));
  }, [workflow.websiteUrl]);
  const modalRef = useDialogFocus(true);
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [error, setError] = useState('');
  const activeRun = useRef('');
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
    onPreviewStart?.();
    setLogs([]);
    setError('');
    const issues = validateWorkflow(workflow, t);
    if (issues.length) {
      setError(issues.map((issue) => issue.message).join(' '));
      onExecution?.({ type: 'error', runId: activeRun.current });
      return;
    }
    setRevision((value) => value + 1);
    setRunning(true);
  }
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and the builder's Escape handler provide keyboard dismissal.
    // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
    <div className="dxp-modal-backdrop dxp-preview-backdrop-fullscreen" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
      <section
        ref={modalRef}
        className="dxp-modal dxp-preview"
        role="dialog"
        aria-modal="true"
        aria-label={t('preview.previewWorkflow')}
        onClick={(e) => e.stopPropagation()}
      >
        <WebsitePreviewHeader
          icon={<Play size={19} aria-hidden="true" />}
          title={t('preview.previewWorkflow')}
          description={t('preview.seeYourJourneyInAction')}
          closeLabel={t('preview.closePreview')}
          onClose={onClose}
        />
        <WebsitePreviewToolbar
          url={workflow.websiteUrl}
          device={device}
          onDeviceChange={setDevice}
          onReload={() => {
            stop();
            setReady(false);
            setLogs([]);
            setError('');
            setKey((x) => x + 1);
          }}
          actions={
            <>
              {running && (
                <button type="button" className="dxp-button" onClick={stop}>
                  <Square size={14} /> {t('preview.stopWorkflow')}
                </button>
              )}
              <button
                type="button"
                className="dxp-button dxp-button-primary"
                data-tutorial="run"
                onClick={run}
                disabled={!ready}
              >
                {running ? <RotateCcw size={14} /> : <Play size={14} />}{' '}
                {running ? t('preview.restartWorkflow') : t('preview.runWorkflow')}
              </button>
            </>
          }
        >
          <div className="dxp-preview-search">
            <label htmlFor={searchParamsId}>{t('preview.searchParams')}</label>
            <input
              id={searchParamsId}
              type="text"
              value={searchParams}
              placeholder="utm_campaign=summer-sale"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                stop();
                setLogs([]);
                setError('');
                setSearchParams(event.target.value);
              }}
            />
          </div>
        </WebsitePreviewToolbar>
        {guidance}
        <div className="dxp-preview-body">
          <div
            className={`dxp-preview-viewport${device === 'mobile' ? ' dxp-preview-viewport-mobile' : ''}`}
          >
            <IsolatedPreview
              key={`${workflow.websiteUrl}-${key}`}
              url={workflow.websiteUrl}
              searchParams={searchParams.trim()}
              workflow={workflow}
              running={running}
              revision={revision}
              title={t('preview.workflowPreviewWebsite')}
              onReady={(value) => {
                setReady(value);
                if (!value) setRunning(false);
              }}
              onExecution={(event) => {
                if (event.type === 'start') activeRun.current = event.runId;
                if (event.type === 'stop' && activeRun.current === event.runId)
                  activeRun.current = '';
                onExecution?.(event);
              }}
              onError={(message) => {
                setError(message);
                if (message) onExecution?.({ type: 'error', runId: activeRun.current });
              }}
              onClose={onClose}
              onConnectionPreview={onConnectionPreview}
              onLog={(log) => {
                if (!running) return;
                setLogs((previous) => [...previous, log]);
                onLog(log);
              }}
            />
          </div>
          <aside className="dxp-run-log" data-tutorial="log">
            <div className="dxp-run-log-content">
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
                {transport
                  ? t('websiteSetup.proxyLimitations')
                  : t(
                      'preview.externalWebsitesNeedThePreviewBridgeConfiguredForThisBuilderOriginPreviews',
                    )}
              </p>
            </div>
            <footer className="dxp-run-log-footer">
              <button type="button" className="dxp-button" onClick={onClose}>
                {t('preview.closePreview')}
              </button>
            </footer>
          </aside>
        </div>
      </section>
    </div>
  );
}
