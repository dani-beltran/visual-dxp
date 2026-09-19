import { Check, CircleAlert, ExternalLink, LoaderCircle, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);
  useEffect(() => () => runtime.current?.destroy(), []);
  function loaded() {
    runtime.current?.destroy();
    setRunning(false);
    setReady(false);
    try {
      if (!frame.current?.contentDocument?.body) throw new Error();
      setReady(true);
      setError('');
    } catch {
      setError(
        'Live preview requires a same-origin page. Export the JavaScript to run this workflow on your own website.',
      );
    }
  }
  async function run() {
    const issues = validateWorkflow(workflow);
    if (issues.length) {
      setError(issues.map((i) => i.message).join(' '));
      return;
    }
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    if (!doc || !win) return;
    runtime.current?.destroy();
    setLogs([]);
    setRunning(true);
    setError('');
    try {
      runtime.current = createRuntime(workflow, {
        document: doc,
        window: win,
        onLog: (log) => {
          setLogs((prev) => [...prev, log]);
          onLog(log);
        },
      });
      await runtime.current.run();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The workflow could not run.');
    } finally {
      setRunning(false);
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
              runtime.current?.destroy();
              setRunning(false);
              setReady(false);
              setLogs([]);
              setKey((x) => x + 1);
            }}
            title="Reload website"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="dxp-button dxp-button-primary"
            onClick={run}
            disabled={!ready || running}
          >
            {running ? <LoaderCircle className="dxp-spin" size={15} /> : <Play size={14} />}{' '}
            {running ? 'Running…' : 'Run workflow'}
          </button>
        </div>
        <div className="dxp-preview-body">
          <iframe
            key={key}
            ref={frame}
            src={workflow.websiteUrl}
            title="Workflow preview website"
            onLoad={loaded}
          />
          <aside className="dxp-run-log">
            <h3>
              Execution log <span>{logs.filter((x) => x.status === 'success').length}</span>
            </h3>
            {!logs.length && (
              <div className="dxp-log-empty">
                <Play size={25} />
                <p>Your journey, step by step.</p>
                <small>Run the workflow to see each action happen on the page.</small>
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
            {error && <p className="dxp-error">{error}</p>}
            <p className="dxp-log-note">
              <ExternalLink size={13} /> Manual runs start immediately. Exported scripts listen for
              your configured triggers.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
