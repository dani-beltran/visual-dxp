import { Bold, Check, Italic, Strikethrough } from 'lucide-react';
import { useId } from 'react';
import { restoreNoteSelection, useNoteSelection } from '../lib/noteSelection';
import { selectionHasNoteMark, toggleNoteMark } from '../lib/noteText';
import type { StepConfig } from '../lib/types';
import '../styles/notes.css';

const noteColors = [
  { label: 'Yellow', value: '#fff4b8' },
  { label: 'Green', value: '#def0d8' },
  { label: 'Blue', value: '#dcecfb' },
  { label: 'Purple', value: '#ede2fa' },
  { label: 'Pink', value: '#fbe0e8' },
  { label: 'White', value: '#ffffff' },
  { label: 'Transparent', value: 'transparent' },
];

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
  const colorId = useId();
  const { selection } = useNoteSelection();
  const range = selection?.noteId === noteId && selection.start < selection.end ? selection : null;
  const background = noteBackground(config);
  const formats = [
    { key: 'bold', label: 'Bold', icon: Bold },
    { key: 'italic', label: 'Italic', icon: Italic },
    { key: 'strikethrough', label: 'Strikethrough', icon: Strikethrough },
  ] as const;

  return (
    <div className="dxp-note-controls">
      <fieldset className="dxp-note-control-group">
        <legend>Text style</legend>
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
        <p className="dxp-inspector-hint">Select text in the note or above, then choose a style.</p>
      </fieldset>
      <fieldset className="dxp-note-control-group">
        <legend>Background</legend>
        <div className="dxp-note-color-palette">
          {noteColors.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`dxp-note-color-swatch ${value === 'transparent' ? 'is-transparent' : ''}`}
              style={{ backgroundColor: value }}
              aria-label={`${label} background`}
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
            aria-label="Custom background color"
            value={background === 'transparent' ? '#fff4b8' : background}
            onChange={(event) => onChange({ noteColor: event.target.value })}
          />
          <span>Custom color</span>
          <span className="dxp-note-color-value">
            {background === 'transparent' ? 'Transparent' : background.toUpperCase()}
          </span>
        </label>
      </fieldset>
    </div>
  );
}
