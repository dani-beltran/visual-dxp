import '../../styles/base.css';
import '../../styles/shared.css';
import { ArrowDownToLine, ArrowUpRight, Check, Code2, Copy, FileJson, Play, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { appMessages } from '../../app/locales/appMessages';
import { spanishMessages } from '../../app/locales/es';
import { AppPreferences } from '../AppPreferences/AppPreferences';
import {
  VisualDXPBuilder,
  type VisualDXPBuilderApi,
  type VisualDXPBuilderProps,
} from '../VisualDXPBuilder/VisualDXPBuilder';
import { createActivityStore } from '../../lib/activity';
import { download } from '../../lib/download';
import { exportWorkflow, validateWorkflow } from '../../lib/export';
import { createBuilderTranslator, formatBuilderError } from '../../lib/i18n';
import { restoreWorkflow } from '../../lib/initialWorkflow';
import { validateExportTarget } from '../../lib/targeting';
import type { Workflow } from '../../lib/types';
import { useDialogFocus } from '../../lib/useDialogFocus';
import './App.css';

const themeStorageKey = 'visual-dxp-theme';
const languageStorageKey = 'visual-dxp-language';

export interface AppProps extends Omit<VisualDXPBuilderProps, 'onReady'> {
  onExport?: (script: string, workflow: Workflow) => void;
}

export function App({
  initialWorkflow,
  tutorial,
  onChange,
  onExport,
  className = '',
  style,
  activityStore,
  activityUser = 'You',
  presets,
  i18n,
  ...builderProps
}: AppProps) {
  // Use host localization unless the user has saved a supported language choice.
  const [language, setLanguage] = useState<'en' | 'es' | null>(() => {
    try {
      const saved = localStorage.getItem(languageStorageKey);
      return saved === 'en' || saved === 'es' ? saved : null;
    } catch {
      return null;
    }
  });
  function selectLanguage(value: string) {
    const next = value === 'en' || value === 'es' ? value : null;
    setLanguage(next);
    try {
      if (next) localStorage.setItem(languageStorageKey, next);
      else localStorage.removeItem(languageStorageKey);
    } catch {
      // Keep language switching usable when browser storage is unavailable.
    }
  }
  const hostLanguage = i18n?.locale ?? 'en';
  const selectedLanguage =
    language ?? (hostLanguage.split('-')[0].toLowerCase() === 'es' ? 'es' : hostLanguage);
  const builderI18n = useMemo(() => {
    if (language === 'es') return { locale: 'es-ES', messages: spanishMessages };
    if (language === 'en') return { locale: 'en' };
    if (hostLanguage.split('-')[0].toLowerCase() === 'es') {
      return { ...i18n, messages: { ...spanishMessages, ...i18n?.messages } };
    }
    return i18n;
  }, [language, hostLanguage, i18n]);
  const t = useMemo(() => createBuilderTranslator(builderI18n?.messages), [builderI18n]);
  const copy = appMessages[selectedLanguage === 'es' ? 'es' : 'en'];
  const [localActivityStore] = useState(() => createActivityStore());
  const store = activityStore ?? localActivityStore;
  const [workflow, setWorkflow] = useState(() =>
    restoreWorkflow(initialWorkflow, builderProps.persistenceKey, t),
  );
  const [builder, setBuilder] = useState<VisualDXPBuilderApi | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [tutorialRoot, setTutorialRoot] = useState<HTMLDivElement | null>(null);
  const [exportContainer, setExportContainer] = useState<HTMLDivElement | null>(null);
  const [tutorialExport, setTutorialExport] = useState(false);
  const [tutorialExportAccess, setTutorialExportAccess] = useState<'inspect' | 'backup' | null>(
    null,
  );
  const [exportTab, setExportTab] = useState<'javascript' | 'json'>('javascript');
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Keep the theme toggle usable when browser storage is unavailable.
    }
  }, [theme]);
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
      notify(copy.activityError);
    }
  }
  const issues = useMemo(() => validateWorkflow(workflow, t), [workflow, t]);
  const script = useMemo(() => {
    try {
      return exportWorkflow(workflow);
    } catch {
      return copy.resolveIssues;
    }
  }, [workflow, copy.resolveIssues]);
  const code = useMemo(() => {
    if (exportTab === 'javascript') return script;
    try {
      if (tutorialExport) return JSON.stringify(workflow, null, 2);
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
      return copy.configureWebsite;
    }
  }, [exportTab, script, workflow, copy.configureWebsite, tutorialExport]);
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
    if (tutorialExportAccess) {
      setTutorialExport(true);
      setExportTab(tutorialExportAccess === 'backup' ? 'json' : 'javascript');
      setExportOpen(true);
      return;
    }
    setTutorialExport(false);
    if (!builder) return;
    const next = builder.getWorkflow();
    if (!requireExportTarget(next)) return;
    setWorkflow(next);
    setExportOpen(true);
  }
  function prepareExport() {
    if (!builder) return;
    const next = builder.getWorkflow();
    if (tutorialExport && exportTab === 'json')
      return { workflow: next, content: JSON.stringify(next, null, 2) };
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
      notify(formatBuilderError(error, t));
    }
  }
  async function copyCode() {
    const prepared = prepareExport();
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared.content);
      recordActivity(copy.copiedActivity(exportTab === 'javascript' ? 'JavaScript' : 'JSON'));
      notify(copy.copied);
    } catch {
      notify(copy.clipboardUnavailable);
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
    recordActivity(copy.exportedActivity(exportTab === 'javascript' ? 'JavaScript' : 'JSON'));
    if (exportTab === 'javascript') onExport?.(prepared.content, prepared.workflow);
    notify(copy.ready);
  }
  return (
    <div
      ref={tutorial ? setTutorialRoot : undefined}
      className={`dxp-app ${className}`}
      style={style}
      data-dxp-theme={theme}
      lang={builderI18n?.locale ?? 'en'}
    >
      <main className="dxp-main">
        <header className="dxp-header">
          <div className="dxp-heading">
            <div className="dxp-project-summary">
              <div className="dxp-title-row">
                <h1>
                  <img className="dxp-brand-image" src="/visual-dxp-logo.png" alt="Visual DXP" />
                </h1>
              </div>
              <p>{copy.description}</p>
            </div>
            <AppPreferences
              selectedLanguage={selectedLanguage}
              hostLanguage={hostLanguage}
              theme={theme}
              copy={copy}
              onLanguageChange={selectLanguage}
              onThemeChange={setTheme}
            />
          </div>
        </header>
        <section className="dxp-workflow-bar" aria-label={copy.workflowActions}>
          <input
            data-tutorial="name"
            className="dxp-workflow-name"
            aria-label={copy.workflowName}
            title={copy.workflowName}
            value={workflow.name}
            onChange={(event) => builder?.renameWorkflow(event.target.value)}
            onBlur={() => builder?.flushActivity()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <div className="dxp-workflow-actions">
            <button
              type="button"
              className="dxp-button"
              data-tutorial="test"
              onClick={() => {
                builder?.testWorkflow();
              }}
            >
              <Play size={14} /> {copy.testWorkflow}
            </button>
            <button
              type="button"
              data-tutorial="export"
              className="dxp-button dxp-button-primary"
              onClick={openExport}
            >
              <Code2 size={16} /> {copy.exportWorkflow} <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <VisualDXPBuilder
          {...builderProps}
          tutorial={
            tutorial
              ? {
                  ...tutorial,
                  host: {
                    root: tutorialRoot,
                    nameControl: true,
                    testControl: true,
                    exportContainer,
                    exportOpen,
                    onExportAccessChange: setTutorialExportAccess,
                    openExport: (backup) => {
                      setTutorialExport(true);
                      setExportTab(backup ? 'json' : 'javascript');
                      setExportOpen(true);
                    },
                    closeExport: () => setExportOpen(false),
                  },
                }
              : undefined
          }
          i18n={builderI18n}
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
          <button
            type="button"
            onClick={() => setToast('')}
            aria-label={t('builder.dismissNotification')}
          >
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
            aria-label={copy.exportWorkflow}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dxp-modal-header">
              <div>
                <span className="dxp-eyebrow">{copy.eyebrow}</span>
                <h2>{copy.exportTitle}</h2>
              </div>
              <button
                type="button"
                className="dxp-icon-button"
                onClick={() => setExportOpen(false)}
                aria-label={t('builder.closeDialog')}
              >
                <X size={20} />
              </button>
            </div>
            <div ref={setExportContainer} />
            <p className="dxp-modal-description">{copy.exportDescription}</p>
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
                <FileJson size={15} /> {copy.workflowJson}
              </button>
              <span />
              <button
                type="button"
                onClick={copyCode}
                disabled={tutorialExport && exportTab === 'javascript'}
              >
                <Copy size={14} /> {copy.copy}
              </button>
            </div>
            {issues.length > 0 && (
              <div className="dxp-validation">
                <strong>{copy.beforeExport}</strong>
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
                <Check size={14} /> {copy.standalone}
              </span>
              <button
                type="button"
                className="dxp-button dxp-button-primary"
                disabled={exportTab === 'javascript' && (issues.length > 0 || tutorialExport)}
                onClick={exportFile}
              >
                <ArrowDownToLine size={16} /> {copy.download}{' '}
                {exportTab === 'javascript' ? '.js' : '.json'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
