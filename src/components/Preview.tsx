import {
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Play,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validateWorkflow } from '../lib/export';
import { createRuntime } from '../lib/runtime';
import type { RunLog, Workflow } from '../lib/types';
import { useDialogFocus } from '../lib/useDialogFocus';
export function Preview({
  workflow,
  onClose,
  onLog,
}: {
  workflow: Workflow;
  onClose: () => void;
  onLog: (log: RunLog) => void;
}) {
  const modalRef = useDialogFocus(true);
  const frame = useRef<HTMLIFrameElement>(null);
  const runtime = useRef<ReturnType<typeof createRuntime> | null>(null);
  const session = useRef(0);
  const callbacks = useRef({ onClose, onLog });
  callbacks.current = { onClose, onLog };
  const [page, setPage] = useState<{ document: Document; url: string; key: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);
  const ready = page?.url === workflow.websiteUrl && page.key === key;
  const stop = useCallback(() => {
    session.current += 1;
    runtime.current?.destroy();
    runtime.current = null;
    setRunning(false);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Editing the workflow invalidates the active test and its logs.
  useEffect(() => {
    stop();
    setLogs([]);
    setError('');
    return () => {
      session.current += 1;
      runtime.current?.destroy();
      runtime.current = null;
    };
  }, [workflow, stop]);

  useEffect(() => {
    const win = page?.document.defaultView;
    if (!win) return;
    const leaving = () => {
      stop();
      setPage(null);
    };
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      callbacks.current.onClose();
    };
    win.addEventListener('pagehide', leaving);
    win.addEventListener('keydown', close);
    return () => {
      try {
        win.removeEventListener('pagehide', leaving);
        win.removeEventListener('keydown', close);
      } catch {
        // The website may have navigated to another origin before effect cleanup.
      }
    };
  }, [page, stop]);

  function loaded() {
    stop();
    setPage(null);
    try {
      const doc = frame.current?.contentDocument;
      if (!doc?.body || !doc.defaultView) throw new Error();
      setPage({ document: doc, url: workflow.websiteUrl, key });
      setError('');
    } catch {
      setError(
        'Live preview requires a same-origin page. Export the JavaScript to run this workflow on your own website.',
      );
    }
  }
  function run() {
    stop();
    setLogs([]);
    setError('');
    const issues = validateWorkflow(workflow);
    if (issues.length) {
      setError(issues.map((i) => i.message).join(' '));
      return;
    }
    try {
      const doc = frame.current?.contentDocument;
      const win = doc?.defaultView;
      if (!ready || !doc?.body || !win || doc !== page?.document)
        throw new Error('Wait for the website to load, then run the workflow again.');
      const currentSession = session.current;
      runtime.current = createRuntime(workflow, {
        document: doc,
        window: win,
        onLog: (log) => {
          if (session.current !== currentSession) return;
          setLogs((prev) => [...prev, log]);
          if (log.status === 'error') setError(log.message);
          callbacks.current.onLog(log);
        },
      });
      // Match the exported script: page-load runs now; other triggers listen to the website.
      runtime.current.start();
      setRunning(true);
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : 'The workflow could not run.');
    }
  }
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and the builder's Escape handler provide keyboard dismissal.
    // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
    <div className="dxp-modal-backdrop" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
      <section
        ref={modalRef}
        className="dxp-modal dxp-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Preview workflow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dxp-modal-header">
          <div>
            <span className="dxp-eyebrow">TEST YOUR EXPERIENCE</span>
            <h2>See your journey in action</h2>
          </div>
          <button
            type="button"
            className="dxp-icon-button"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
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
              setPage(null);
              setLogs([]);
              setError('');
              setKey((x) => x + 1);
            }}
            title="Reload website"
            aria-label="Reload website"
          >
            <RotateCcw size={14} />
          </button>
          {running && (
            <button type="button" className="dxp-button" onClick={stop}>
              <Square size={14} /> Stop workflow
            </button>
          )}
          <button
            type="button"
            className="dxp-button dxp-button-primary"
            onClick={run}
            disabled={!ready}
          >
            {running ? <RotateCcw size={14} /> : <Play size={14} />}{' '}
            {running ? 'Restart workflow' : 'Run workflow'}
          </button>
        </div>
        <div className="dxp-preview-body">
          <iframe
            key={`${workflow.websiteUrl}-${key}`}
            ref={frame}
            src={workflow.websiteUrl}
            title="Workflow preview website"
            onLoad={loaded}
            onError={() => {
              stop();
              setPage(null);
              setError('The website could not be loaded. Reload the website to try again.');
            }}
          />
          <aside className="dxp-run-log">
            <h3>
              Execution log <span>{logs.filter((x) => x.status === 'success').length}</span>
            </h3>
            {!logs.length && (
              <div className="dxp-log-empty">
                <Play size={25} />
                <p>{running ? 'Listening for your triggers.' : 'Your journey, step by step.'}</p>
                <small>
                  {running
                    ? 'Interact with the website to trigger your workflow.'
                    : 'Run the workflow to see each action happen on the page.'}
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
              <ExternalLink size={13} /> Page-load triggers run when you start. Other triggers
              respond to this website, just like the exported script. Reload to reset page changes.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
