import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  FileJson,
  Layers2,
  MousePointer2,
  Play,
  Plus,
  Sparkles,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VisualDXPBuilder,
  type VisualDXPBuilderApi,
  type VisualDXPBuilderProps,
} from './components/VisualDXPBuilder';
import { createActivityStore } from './lib/activity';
import { defaultWorkflow } from './lib/catalog';
import { exportWorkflow, validateWorkflow } from './lib/export';
import type { Workflow } from './lib/types';
import { useDialogFocus } from './lib/useDialogFocus';
import './styles/app.css';

export interface AppProps extends Omit<VisualDXPBuilderProps, 'onReady'> {
  onExport?: (script: string, workflow: Workflow) => void;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function App({
  initialWorkflow = defaultWorkflow,
  onChange,
  onExport,
  className = '',
  style,
  activityStore,
  activityUser = 'You',
  ...builderProps
}: AppProps) {
  const [localActivityStore] = useState(() => createActivityStore());
  const store = activityStore ?? localActivityStore;
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [builder, setBuilder] = useState<VisualDXPBuilderApi | null>(null);
  const [modal, setModal] = useState<'export' | 'help' | null>(null);
  const [exportTab, setExportTab] = useState<'javascript' | 'json'>('javascript');
  const [toast, setToast] = useState('');
  const modalRef = useDialogFocus(!!modal);
  const notify = useCallback((message: string) => setToast(message), []);
  const handleChange = useCallback(
    (next: Workflow) => {
      setWorkflow(next);
      onChange?.(next);
    },
    [onChange],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  function recordActivity(action: string) {
    builder?.flushActivity();
    try {
      store.append({
        id: crypto.randomUUID(),
        username: activityUser.trim() || 'You',
        action,
        timestamp: new Date().toISOString(),
      });
    } catch {
      notify('The activity could not be saved.');
    }
  }
  const issues = useMemo(() => validateWorkflow(workflow), [workflow]);
  const script = useMemo(() => {
    try {
      return exportWorkflow(workflow);
    } catch {
      return '// Resolve the workflow issues below before exporting.';
    }
  }, [workflow]);
  const code = exportTab === 'javascript' ? script : JSON.stringify(workflow, null, 2);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      recordActivity(
        `Copied the workflow as ${exportTab === 'javascript' ? 'JavaScript' : 'JSON'}`,
      );
      notify('Copied to clipboard');
    } catch {
      notify('Clipboard is unavailable. Use Download instead.');
    }
  }
  function exportFile() {
    if (exportTab === 'javascript' && issues.length) return;
    const name = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workflow';
    download(
      `${name}.${exportTab === 'javascript' ? 'js' : 'json'}`,
      code,
      exportTab === 'javascript' ? 'text/javascript' : 'application/json',
    );
    recordActivity(
      `Exported the workflow as ${exportTab === 'javascript' ? 'JavaScript' : 'JSON'}`,
    );
    if (exportTab === 'javascript') onExport?.(script, workflow);
    notify('Your workflow is ready to go');
  }
  return (
    <div className={`dxp-app ${className}`} style={style}>
      <aside className="dxp-sidebar">
        <button
          type="button"
          className="dxp-brand"
          onClick={() => {
            builder?.fitView();
          }}
          aria-label="Visual DXP home"
        >
          <span className="dxp-brand-mark">
            <span />
            <span />
            <span />
          </span>
          Visual
          <span className="dxp-brand-tag">DXP</span>
        </button>
        <div className="dxp-workspace-label">
          <span className="dxp-workspace-icon">
            <Layers2 size={16} />
          </span>
          <div>
            <strong>Personal workspace</strong>
            <span>Your space to create</span>
          </div>
        </div>
        <div className="dxp-sidebar-section">
          <span className="dxp-eyebrow">BUILD SOMETHING GREAT</span>
          <div className="dxp-active-nav">
            <WorkflowIcon size={17} /> Experience builder <span>01</span>
          </div>
        </div>
        <div className="dxp-sidebar-bottom">
          <div className="dxp-tip">
            <span className="dxp-tip-icon">
              <Sparkles size={17} />
            </span>
            <strong>
              Small moments.
              <br />
              Better experiences.
            </strong>
            <p>Connect your ideas. Bring your website to life.</p>
            <button type="button" onClick={() => setModal('help')}>
              A quick introduction <ArrowUpRight size={14} />
            </button>
          </div>
          <button type="button" className="dxp-help-link" onClick={() => setModal('help')}>
            <CircleHelp size={16} /> Help & resources <ArrowUpRight size={13} />
          </button>
          <div className="dxp-profile">
            <span className="dxp-avatar">ME</span>
            <div>
              <strong>My workspace</strong>
              <small>Saved in this browser</small>
            </div>
            <span className="dxp-local-badge">LOCAL</span>
          </div>
        </div>
      </aside>
      <main className="dxp-main">
        <header className="dxp-header">
          <div className="dxp-breadcrumb">
            <Layers2 size={13} />
            <span>Workspace</span>
            <ChevronRight size={12} />
            <span>Experiences</span>
            <ChevronRight size={12} />
            <strong>{workflow.name}</strong>
            <div className="dxp-header-right">
              <span className="dxp-local-indicator" /> Local workspace{' '}
              <button
                type="button"
                className="dxp-icon-button"
                title="Help and keyboard shortcuts"
                onClick={() => setModal('help')}
              >
                <CircleHelp size={16} />
              </button>
            </div>
          </div>
          <div className="dxp-heading">
            <div>
              <div className="dxp-title-row">
                <input
                  aria-label="Workflow name"
                  value={workflow.name}
                  onChange={(e) => {
                    builder?.renameWorkflow(e.target.value);
                  }}
                  onBlur={() => builder?.flushActivity()}
                />
                <span className="dxp-draft-badge">DRAFT</span>
              </div>
              <p>A thoughtful first impression, on autopilot.</p>
            </div>
            <div className="dxp-header-actions">
              <button
                type="button"
                className="dxp-button"
                onClick={() => {
                  builder?.testWorkflow();
                }}
              >
                <Play size={14} /> Test workflow
              </button>
              <button
                type="button"
                className="dxp-button dxp-button-primary"
                onClick={() => setModal('export')}
              >
                <Code2 size={16} /> Export workflow <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </header>
        <VisualDXPBuilder
          {...builderProps}
          initialWorkflow={initialWorkflow}
          activityStore={store}
          activityUser={activityUser}
          onChange={handleChange}
          onReady={setBuilder}
        />
      </main>
      {toast && (
        <div className="dxp-toast" role="status">
          <Check size={16} />
          {toast}
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and Escape key dismiss this dialog for keyboard users.
        // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
        <div className="dxp-modal-backdrop" onClick={() => setModal(null)}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
          <section
            ref={modalRef}
            className={`dxp-modal ${modal === 'export' ? 'dxp-export-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'export' ? 'Export workflow' : 'About Visual DXP'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dxp-modal-header">
              <div>
                <span className="dxp-eyebrow">
                  {modal === 'export' ? 'FROM CANVAS TO CODE' : 'A LITTLE GUIDANCE'}
                </span>
                <h2>
                  {modal === 'export'
                    ? 'Your workflow. Ready for the web.'
                    : 'Make something worth experiencing.'}
                </h2>
              </div>
              <button
                type="button"
                className="dxp-icon-button"
                onClick={() => setModal(null)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
            {modal === 'export' ? (
              <>
                <p className="dxp-modal-description">
                  Add this standalone script to your website. Your triggers and actions take it from
                  there.
                </p>
                <div className="dxp-export-tabs">
                  <button
                    type="button"
                    className={exportTab === 'javascript' ? 'active' : ''}
                    onClick={() => setExportTab('javascript')}
                  >
                    <Code2 size={15} /> JavaScript
                  </button>
                  <button
                    type="button"
                    className={exportTab === 'json' ? 'active' : ''}
                    onClick={() => setExportTab('json')}
                  >
                    <FileJson size={15} /> Workflow JSON
                  </button>
                  <span />
                  <button type="button" onClick={copyCode}>
                    <Copy size={14} /> Copy
                  </button>
                </div>
                {issues.length > 0 && (
                  <div className="dxp-validation">
                    <strong>Before you export</strong>
                    {issues.map((issue, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: These stateless validation messages are rendered together without persistent row state.
                      <p key={i}>{issue.message}</p>
                    ))}
                  </div>
                )}
                <pre className="dxp-code">
                  <code>{code}</code>
                </pre>
                <div className="dxp-modal-footer">
                  <span>
                    <Check size={14} /> Standalone. No dependencies.
                  </span>
                  <button
                    type="button"
                    className="dxp-button dxp-button-primary"
                    disabled={exportTab === 'javascript' && issues.length > 0}
                    onClick={exportFile}
                  >
                    <ArrowDownToLine size={16} /> Download{' '}
                    {exportTab === 'javascript' ? '.js' : '.json'}
                  </button>
                </div>
              </>
            ) : (
              <div className="dxp-help-content">
                <p>
                  Visual DXP turns little ideas into thoughtful digital experiences. Start with a
                  trigger, connect your steps, and make the journey your own.
                </p>
                {[
                  {
                    icon: Plus,
                    title: '1. Start with a step',
                    body: 'Drag a node from the library, or click it to add it to your canvas.',
                  },
                  {
                    icon: WorkflowIcon,
                    title: '2. Connect the moments',
                    body: 'Drag between the circles on your nodes. Conditions follow the top path when the condition matches, and the bottom path otherwise.',
                  },
                  {
                    icon: MousePointer2,
                    title: '3. Make it personal',
                    body: 'Click a node to configure it. Use the element picker to choose a target directly on your website.',
                  },
                  {
                    icon: Code2,
                    title: '4. Put it out into the world',
                    body: 'Test your workflow on the demo site, then export a standalone JavaScript file for your own website.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div className="dxp-help-step" key={title}>
                    <span>
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
                <div className="dxp-shortcuts">
                  <span>
                    <kbd>⌘ / Ctrl Z</kbd> Undo
                  </span>
                  <span>
                    <kbd>Delete</kbd> Remove selected
                  </span>
                  <span>
                    <kbd>Esc</kbd> Close panel
                  </span>
                </div>
                <button
                  type="button"
                  className="dxp-button dxp-button-primary"
                  onClick={() => setModal(null)}
                >
                  Back to creating <ArrowRight size={14} />
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
