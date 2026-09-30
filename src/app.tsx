import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  FileJson,
  Moon,
  Play,
  Sun,
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
import { validateExportTarget } from './lib/targeting';
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
  presets,
  ...builderProps
}: AppProps) {
  const [localActivityStore] = useState(() => createActivityStore());
  const store = activityStore ?? localActivityStore;
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [builder, setBuilder] = useState<VisualDXPBuilderApi | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'javascript' | 'json'>('javascript');
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const modalRef = useDialogFocus(exportOpen);
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
      if (event.key === 'Escape') setExportOpen(false);
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
  const code = useMemo(() => {
    if (exportTab === 'javascript') return script;
    try {
      const target = validateExportTarget(workflow);
      return JSON.stringify(
        {
          ...workflow,
          websiteUrl: target.href,
          includeSubpages: workflow.includeSubpages ?? false,
        },
        null,
        2,
      );
    } catch {
      return '// Configure your website URL before exporting.';
    }
  }, [exportTab, script, workflow]);
  function requireExportTarget(next: Workflow): boolean {
    try {
      validateExportTarget(next);
      return true;
    } catch {
      setExportOpen(false);
      builder?.configureWebsite({
        requireExportable: true,
        onSave: (configured) => {
          // Resume the dialog, never an earlier Copy/Download action.
          setWorkflow(configured);
          setExportOpen(true);
        },
      });
      return false;
    }
  }
  function openExport() {
    if (!builder) return;
    const next = builder.getWorkflow();
    if (!requireExportTarget(next)) return;
    setWorkflow(next);
    setExportOpen(true);
  }
  function prepareExport() {
    if (!builder) return;
    const next = builder.getWorkflow();
    if (!requireExportTarget(next)) return;
    try {
      const target = validateExportTarget(next);
      const definition = {
        ...next,
        websiteUrl: target.href,
        includeSubpages: next.includeSubpages ?? false,
      };
      const content =
        exportTab === 'javascript' ? exportWorkflow(next) : JSON.stringify(definition, null, 2);
      return { workflow: next, content };
    } catch (error) {
      notify((error as Error).message);
    }
  }
  async function copyCode() {
    const prepared = prepareExport();
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared.content);
      recordActivity(
        `Copied the workflow as ${exportTab === 'javascript' ? 'JavaScript' : 'JSON'}`,
      );
      notify('Copied to clipboard');
    } catch {
      notify('Clipboard is unavailable. Use Download instead.');
    }
  }
  function exportFile() {
    const prepared = prepareExport();
    if (!prepared) return;
    const name = prepared.workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workflow';
    download(
      `${name}.${exportTab === 'javascript' ? 'js' : 'json'}`,
      prepared.content,
      exportTab === 'javascript' ? 'text/javascript' : 'application/json',
    );
    recordActivity(
      `Exported the workflow as ${exportTab === 'javascript' ? 'JavaScript' : 'JSON'}`,
    );
    if (exportTab === 'javascript') onExport?.(prepared.content, prepared.workflow);
    notify('Your workflow is ready to go');
  }
  return (
    <div className={`dxp-app ${className}`} style={style} data-dxp-theme={theme}>
      <main className="dxp-main">
        <header className="dxp-header">
          <div className="dxp-heading">
            <div className="dxp-project-summary">
              <div className="dxp-title-row">
                <h1>
                  <img className="dxp-brand-image" src="/visual-dxp-logo.png" alt="Visual DXP" />
                </h1>
              </div>
              <p>
                Build website workflows visually, test them live, and export standalone JavaScript.
              </p>
            </div>
            <div className="dxp-header-actions">
              <button
                type="button"
                className="dxp-button"
                aria-label="Dark mode"
                aria-pressed={theme === 'dark'}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                className="dxp-button"
                onClick={() => {
                  builder?.testWorkflow();
                }}
              >
                <Play size={14} /> Test workflow
              </button>
              <button type="button" className="dxp-button dxp-button-primary" onClick={openExport}>
                <Code2 size={16} /> Export workflow <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </header>
        <VisualDXPBuilder
          {...builderProps}
          presets={presets}
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
      {exportOpen && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and Escape key dismiss this dialog for keyboard users.
        // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
        <div className="dxp-modal-backdrop" onClick={() => setExportOpen(false)}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
          <section
            ref={modalRef}
            className="dxp-modal dxp-export-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Export workflow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dxp-modal-header">
              <div>
                <span className="dxp-eyebrow">FROM CANVAS TO CODE</span>
                <h2>Your workflow. Ready for the web.</h2>
              </div>
              <button
                type="button"
                className="dxp-icon-button"
                onClick={() => setExportOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
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
          </section>
        </div>
      )}
    </div>
  );
}
