import '../../styles/base.css';
import '../../styles/shared.css';
import { ChevronDown, ChevronUp, Plus, Route, Trash2 } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import { popoverPositionLabel } from '../../lib/popoverLabels';
import { createTourStep, getTourSteps, tourButtonDefaults } from '../../lib/tour';
import type { StepConfig, TourStep, WorkflowNode } from '../../lib/types';
import { Field } from '../InspectorFields/InspectorFields';
import {
  type PopoverDraftEditor,
  PopoverEditorDialog,
} from '../PopoverPreview/PopoverEditorDialog';
import { PopoverSettingsFields } from '../PopoverPreview/PopoverEditorPanel';
import './TourPreview.css';

/** Fullscreen Tour editor: the Popover editor, with a step list around the same settings. */
export function TourPreview({
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
  // Undo can remove steps, so the selection is clamped wherever it is read.
  const [selected, setSelected] = useState(0);
  const current = (config: StepConfig) =>
    Math.max(0, Math.min(selected, getTourSteps(config).length - 1));
  return (
    <PopoverEditorDialog
      node={node}
      websiteUrl={websiteUrl}
      onClose={onClose}
      onSave={onSave}
      guidance={guidance}
      icon={<Route size={19} aria-hidden="true" />}
      text={{
        title: t('tourEditor.editTour'),
        description: t('tourEditor.description'),
        unsavedChanges: t('tourEditor.unsavedChanges'),
        previewHint: t('tourEditor.previewHint'),
        cancelTitle: t('tourEditor.cancelTitle'),
        previewTitle: t('tourEditor.previewWebsite'),
      }}
      previewStep={selected}
      pickPatch={(config, selector) => {
        const index = current(config);
        return {
          tourSteps: getTourSteps(config).map((step, position) =>
            position === index ? { ...step, selector } : step,
          ),
        };
      }}
      renderPanel={(editor) => (
        <TourEditorPanel
          editor={editor}
          selected={current(editor.config)}
          onSelect={(index) => {
            // A pick in progress belongs to the step it started on.
            editor.setPicking(false);
            setSelected(index);
          }}
        />
      )}
    />
  );
}

function TourEditorPanel({
  editor,
  selected,
  onSelect,
}: {
  editor: PopoverDraftEditor;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useBuilderI18n();
  const prefix = useId();
  const { config, update } = editor;
  const steps = getTourSteps(config);
  const step: TourStep | undefined = steps[selected];
  const setSteps = (next: TourStep[], select: number) => {
    update({ tourSteps: next });
    onSelect(select);
  };
  const move = (index: number, offset: -1 | 1) => {
    const next = [...steps];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setSteps(
      next,
      selected === index ? index + offset : selected === index + offset ? index : selected,
    );
  };
  return (
    <aside
      className="dxp-website-editor-panel dxp-popover-editor-panel dxp-tour-editor-panel"
      aria-label={t('tourEditor.settings')}
    >
      <h3 id={`${prefix}-steps`}>{t('tourEditor.steps')}</h3>
      <ol className="dxp-tour-steps" aria-labelledby={`${prefix}-steps`}>
        {steps.map((entry, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: Steps have no identity beyond their order.
            key={index}
            className={`dxp-tour-step${index === selected ? ' dxp-tour-step-selected' : ''}`}
          >
            <button
              type="button"
              className="dxp-tour-step-label"
              aria-pressed={index === selected}
              onClick={() => onSelect(index)}
            >
              <strong>{t('tourEditor.step', { number: index + 1 })}</strong>{' '}
              <span>{popoverPositionLabel(entry, t)}</span>
            </button>
            <button
              type="button"
              className="dxp-tour-icon-button"
              aria-label={t('tourEditor.moveStepUp', { number: index + 1 })}
              title={t('tourEditor.moveStepUp', { number: index + 1 })}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className="dxp-tour-icon-button"
              aria-label={t('tourEditor.moveStepDown', { number: index + 1 })}
              title={t('tourEditor.moveStepDown', { number: index + 1 })}
              disabled={index === steps.length - 1}
              onClick={() => move(index, 1)}
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              className="dxp-tour-icon-button"
              aria-label={t('tourEditor.deleteStep', { number: index + 1 })}
              title={t('tourEditor.deleteStep', { number: index + 1 })}
              // A tour always keeps at least one step.
              disabled={steps.length === 1}
              onClick={() =>
                setSteps(
                  steps.filter((_, position) => position !== index),
                  index < selected || selected === steps.length - 1 ? selected - 1 : selected,
                )
              }
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="dxp-button dxp-tour-add-step"
        onClick={() => {
          // The new step follows the selected one.
          const index = steps.length ? selected + 1 : 0;
          setSteps([...steps.slice(0, index), createTourStep(step), ...steps.slice(index)], index);
        }}
      >
        <Plus size={14} /> {t('tourEditor.addStep')}
      </button>
      {step && (
        <section className="dxp-tour-editor-section" aria-labelledby={`${prefix}-step-settings`}>
          <h3 id={`${prefix}-step-settings`}>
            {t('tourEditor.stepSettings', { number: selected + 1 })}
          </h3>
          <PopoverSettingsFields
            // Fresh field state for each step, such as partially typed numbers.
            key={selected}
            config={step}
            onChange={(patch) =>
              update({
                tourSteps: steps.map((entry, index) =>
                  index === selected ? { ...entry, ...patch } : entry,
                ),
              })
            }
            picking={editor.picking}
            onPickingChange={editor.setPicking}
            canPick={editor.canPick}
            ready={editor.ready}
            formHint={t('tourEditor.formHint')}
          />
        </section>
      )}
      <section className="dxp-tour-editor-section" aria-labelledby={`${prefix}-buttons`}>
        <h3 id={`${prefix}-buttons`}>{t('tourEditor.buttons')}</h3>
        <p className="dxp-inspector-hint">{t('tourEditor.buttonsHint')}</p>
        {(
          [
            ['tourPreviousLabel', 'tourEditor.previousLabel', tourButtonDefaults.previous],
            ['tourNextLabel', 'tourEditor.nextLabel', tourButtonDefaults.next],
            ['tourDoneLabel', 'tourEditor.doneLabel', tourButtonDefaults.done],
          ] as const
        ).map(([key, label, placeholder]) => (
          <Field key={key} label={t(label)} htmlFor={`${prefix}-${key}`}>
            <input
              id={`${prefix}-${key}`}
              value={config[key] ?? ''}
              placeholder={placeholder}
              onChange={(event) => update({ [key]: event.target.value })}
            />
          </Field>
        ))}
      </section>
    </aside>
  );
}
