import { useEffect, useId, useRef } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';
import type { Workflow, WorkflowPreset } from '../lib/types';
import { localizeCommonDXPPreset } from '../presets';
import type { TutorialOptions } from './model';
import type { TutorialController } from './useTutorial';
import { useTutorialPopover } from './useTutorialPopover';
import './tutorial.css';

export function TutorialPanel({
  controller: c,
  options,
  workflow,
  scope,
  selectedId,
  previewOpen,
  auxiliaryOpen,
  aiUnavailable,
  presets,
  onReset,
  onRename,
  onWebsite,
  onSelect,
  onTest,
  onClosePreview,
  onEditor,
  onBackup,
}: {
  controller: TutorialController;
  options: TutorialOptions;
  workflow: Workflow;
  scope: HTMLElement | null;
  selectedId: string | null;
  previewOpen: boolean;
  auxiliaryOpen?: boolean;
  aiUnavailable: boolean;
  presets?: readonly WorkflowPreset[];
  onReset: () => void;
  onRename: (name: string) => void;
  onWebsite: () => void;
  onSelect: (id: string) => void;
  onTest: () => void;
  onClosePreview: () => void;
  onEditor: () => void;
  onBackup: () => void;
}) {
  const { t, locale } = useBuilderI18n();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  // Preserve editor focus during hands-on work; recover focus when the launch control unmounts.
  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus();
  }, []);
  const step = c.step;
  const target =
    c.gate || auxiliaryOpen
      ? ''
      : {
          intro: '',
          name: 'name',
          website: 'website',
          trigger: 'add-trigger',
          event: 'inspector',
          delay: c.record?.ids.delay ? 'inspector' : 'add-delay',
          popover: c.record?.ids.popover ? 'inspector' : 'add-popover',
          connect: 'connections',
          test: previewOpen ? 'run' : 'test',
          result: 'log',
          ai: 'chat',
          help: 'help',
          export: 'export',
          presets: 'presets',
          finish: '',
        }[step];
  const { panel, arrow } = useTutorialPopover(scope, target);
  const title = c.gate ? t(`tutorial.${c.gate}.title`) : t(`tutorial.${step}.title`);
  const kind =
    step === 'event' || step === 'trigger'
      ? 'trigger'
      : step === 'delay' || step === 'popover'
        ? step
        : null;
  const nodeId = kind && c.record?.ids[kind];
  return (
    <section
      ref={panel}
      className="dxp-tutorial"
      aria-labelledby={`${id}-title`}
      data-tutorial-panel="true"
    >
      <svg
        ref={arrow}
        className="dxp-tutorial-arrow"
        width="20"
        height="10"
        viewBox="0 0 20 10"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M 0 10 L 10 0 L 20 10" />
      </svg>
      <div className="dxp-tutorial-surface">
        <div className="dxp-tutorial-heading">
          <span role="status" aria-live="polite">
            {t('tutorial.progress', {
              current: c.sequence.indexOf(step) + 1,
              total: c.sequence.length,
            })}
          </span>
          <button type="button" className="dxp-button" onClick={c.exit}>
            {t('tutorial.exit')}
          </button>
          <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>
            {title}
          </h2>
        </div>
        <div className="dxp-tutorial-content">
          {auxiliaryOpen && (
            <button type="button" className="dxp-button" onClick={onEditor}>
              {t('tutorial.closePreview')}
            </button>
          )}
          {c.gate ? (
            <>
              <p>{t(`tutorial.${c.gate}.body`)}</p>
              <p>{t('tutorial.backupNote')}</p>
              <div className="dxp-tutorial-actions">
                <button type="button" className="dxp-button" onClick={onBackup}>
                  {t('tutorial.backup')}
                </button>
                {c.gate === 'mismatch' && (
                  <button type="button" className="dxp-button" onClick={c.resumeRepair}>
                    {t('tutorial.resumeRepair')}
                  </button>
                )}
                <button
                  type="button"
                  className="dxp-button"
                  onClick={c.gate === 'mismatch' ? () => c.setGate('reset') : onReset}
                >
                  {t(c.gate === 'mismatch' ? 'tutorial.startOver' : 'tutorial.restart')}
                </button>
                <button type="button" className="dxp-button" onClick={c.exit}>
                  {t('common.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              {step === 'intro' && (
                <>
                  <p>{t('tutorial.intro.about')}</p>
                  <p>{t('tutorial.intro.exercise')}</p>
                </>
              )}
              <p>
                {step === 'website' && options.websiteUrl !== '/demo-site.html'
                  ? t('tutorial.website.custom', { url: options.websiteUrl })
                  : t(`tutorial.${step}.body`)}
              </p>
              {step === 'name' && !options.host?.nameControl && (
                <label>
                  {t('tutorial.workflowName')}
                  <input value={workflow.name} onChange={(e) => onRename(e.target.value)} />
                </label>
              )}
              {step === 'website' && (
                <button type="button" className="dxp-button" onClick={onWebsite}>
                  {t('tutorial.website.open')}
                </button>
              )}
              {nodeId && workflow.nodes.some((n) => n.id === nodeId) && selectedId !== nodeId && (
                <button type="button" className="dxp-button" onClick={() => onSelect(nodeId)}>
                  {t('tutorial.showSettings')}
                </button>
              )}
              {step === 'popover' &&
                nodeId &&
                workflow.nodes.some(
                  (n) => n.id === nodeId && n.data.config.content !== c.record?.defaultContent,
                ) && <p role="status">{t('tutorial.restoreContent')}</p>}
              {step === 'connect' && (
                <>
                  <p className="dxp-tutorial-path">{t('tutorial.connectionHint')}</p>
                  <label>
                    {t('tutorial.selectSource')}
                    <select
                      value={
                        selectedId === c.record?.ids.trigger || selectedId === c.record?.ids.delay
                          ? (selectedId ?? '')
                          : ''
                      }
                      onChange={(e) => onSelect(e.target.value)}
                    >
                      <option value="">{t('tutorial.chooseSource')}</option>
                      {workflow.nodes
                        .filter(
                          (n) => n.id === c.record?.ids.trigger || n.id === c.record?.ids.delay,
                        )
                        .map((n) => (
                          <option value={n.id} key={n.id}>
                            {n.data.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {step === 'test' && !previewOpen && !options.host?.testControl && (
                <button type="button" className="dxp-button" onClick={onTest}>
                  {t('tutorial.openTest')}
                </button>
              )}
              {step === 'result' && previewOpen && (
                <button type="button" className="dxp-button" onClick={onClosePreview}>
                  {t('tutorial.closePreview')}
                </button>
              )}
              {step === 'ai' && (
                <>
                  <blockquote>{t('tutorial.ai.example')}</blockquote>
                  <p>{t('tutorial.ai.branding')}</p>
                  {aiUnavailable && <p>{t('tutorial.ai.unavailable')}</p>}
                </>
              )}
              {step === 'export' && (
                <button
                  type="button"
                  className="dxp-button"
                  onClick={
                    options.host?.exportOpen
                      ? options.host.closeExport
                      : () => options.host?.openExport()
                  }
                >
                  {t(options.host?.exportOpen ? 'tutorial.closeExport' : 'tutorial.openExport')}
                </button>
              )}
              {step === 'presets' && (
                <p>
                  {presets
                    ?.filter((p) =>
                      [
                        'blank',
                        'welcome-journey',
                        'delayed-welcome',
                        'headline-experiment',
                      ].includes(p.id),
                    )
                    .map((p) => localizeCommonDXPPreset(p, locale).name)
                    .join(' · ')}
                </p>
              )}
              {step === 'finish' && (
                <p>
                  {[
                    c.sequence.includes('ai') && t('tutorial.ai.title'),
                    t('tutorial.help.title'),
                    c.sequence.includes('export') && t('tutorial.export.title'),
                    c.sequence.includes('presets') && t('tutorial.presets.title'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {c.missing && (
                <div role="status">
                  <p>
                    {t('tutorial.recovery')} {t(`tutorial.${c.missing}.title`)}
                  </p>
                  <button
                    type="button"
                    className="dxp-button"
                    onClick={() => {
                      onEditor();
                      if (c.missing) c.go(c.missing);
                    }}
                  >
                    {t('tutorial.repair')}
                  </button>
                </div>
              )}
              {c.error && (step === 'test' || step === 'result') && (
                <p role="alert">{t('tutorial.runtimeError')}</p>
              )}
            </>
          )}
        </div>
        {!c.gate && (
          <div className="dxp-tutorial-actions">
            <span role="status" aria-live="polite">
              {c.ready ? '✓ ' : ''}
              {t(c.ready ? 'tutorial.ready' : 'tutorial.pending')}
            </span>
            <button
              type="button"
              className="dxp-button"
              disabled={c.sequence.indexOf(step) === 0}
              onClick={c.back}
            >
              {t('tutorial.back')}
            </button>
            <button
              type="button"
              className="dxp-button dxp-button-primary"
              disabled={!c.ready}
              onClick={() => {
                if (step === 'finish') onEditor();
                c.next();
              }}
            >
              {t(
                step === 'finish'
                  ? 'tutorial.keepEditing'
                  : step === 'event'
                    ? 'tutorial.confirmEvent'
                    : 'tutorial.continue',
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
