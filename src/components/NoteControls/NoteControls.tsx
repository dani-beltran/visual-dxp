import '../../styles/base.css';
import '../../styles/shared.css';
import { Bold, Check, Italic, Strikethrough } from 'lucide-react';
import { useId } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import { restoreNoteSelection, useNoteSelection } from '../../lib/noteSelection';
import { selectionHasNoteMark, toggleNoteMark } from '../../lib/noteText';
import type { StepConfig } from '../../lib/types';
import './NoteControls.css';

export function noteBackground(config: StepConfig): string {
  const color = config.noteColor?.toLowerCase();
  return color === 'transparent' || (color && /^#[0-9a-f]{6}$/.test(color)) ? color : '#fff4b8';
}

export function noteForeground(background: string): string {
  if (background === 'transparent') return '#354838';
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(background.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.45 ? '#26372c' : luminance > 0.179 ? '#000000' : '#ffffff';
}

export function NoteControls({
  noteId,
  config,
  onChange,
}: {
  noteId: string;
  config: StepConfig;
  onChange: (patch: Partial<StepConfig>) => void;
}) {
  const { t } = useBuilderI18n();
  const noteColors = [
    { label: t('noteControls.yellow'), value: '#fff4b8' },
    { label: t('noteControls.green'), value: '#def0d8' },
    { label: t('noteControls.blue'), value: '#dcecfb' },
    { label: t('noteControls.purple'), value: '#ede2fa' },
    { label: t('noteControls.pink'), value: '#fbe0e8' },
    { label: t('noteControls.white'), value: '#ffffff' },
    { label: t('noteControls.transparent'), value: 'transparent' },
  ];
  const colorId = useId();
  const { selection } = useNoteSelection();
  const range = selection?.noteId === noteId && selection.start < selection.end ? selection : null;
  const background = noteBackground(config);
  const formats = [
    { key: 'bold', label: t('noteControls.bold'), icon: Bold },
    { key: 'italic', label: t('noteControls.italic'), icon: Italic },
    { key: 'strikethrough', label: t('noteControls.strikethrough'), icon: Strikethrough },
  ] as const;

  return (
    <div className="dxp-note-controls">
      <fieldset className="dxp-note-control-group">
        <legend>{t('noteControls.textStyle')}</legend>
        <div className="dxp-note-format-buttons" data-note-format-toolbar>
          {formats.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={
                range ? selectionHasNoteMark(config, range.start, range.end, key) : false
              }
              disabled={!range}
              title={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (!range || !range.editor.isConnected) return;
                const patch = toggleNoteMark(config, range.start, range.end, key);
                range.editor.focus({ preventScroll: true });
                restoreNoteSelection(range.editor, range.start, range.end);
                onChange(patch);
              }}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className="dxp-inspector-hint">
          {t('noteControls.selectTextInTheNoteOrAboveThenChooseAStyle')}
        </p>
      </fieldset>
      <fieldset className="dxp-note-control-group">
        <legend>{t('noteControls.background')}</legend>
        <div className="dxp-note-color-palette">
          {noteColors.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`dxp-note-color-swatch ${value === 'transparent' ? 'is-transparent' : ''}`}
              style={{ backgroundColor: value }}
              aria-label={t('noteControls.labelBackground', { label: String(label) })}
              aria-pressed={background === value}
              title={label}
              onClick={() => onChange({ noteColor: value })}
            >
              {background === value && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <label className="dxp-note-custom-color" htmlFor={colorId}>
          <input
            id={colorId}
            type="color"
            aria-label={t('noteControls.customBackgroundColor')}
            value={background === 'transparent' ? '#fff4b8' : background}
            onChange={(event) => onChange({ noteColor: event.target.value })}
          />
          <span>{t('noteControls.customColor')}</span>
          <span className="dxp-note-color-value">
            {background === 'transparent'
              ? t('noteControls.transparent')
              : background.toUpperCase()}
          </span>
        </label>
      </fieldset>
    </div>
  );
}
