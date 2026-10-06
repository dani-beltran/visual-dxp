import '../../styles/base.css';
import '../../styles/shared.css';
import { GripHorizontal, StickyNote } from 'lucide-react';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { StepConfig, StepData } from '../../lib/types';
import { noteBackground, noteForeground } from '../NoteControls/NoteControls';
import { NoteTextEditor } from '../NoteTextEditor/NoteTextEditor';
import './NoteCard.css';

export function NoteCard({
  id,
  data,
  selected,
  onChange,
}: {
  id: string;
  data: StepData;
  selected: boolean;
  onChange: (id: string, patch: Partial<StepConfig>) => void;
}) {
  const { t } = useBuilderI18n();
  const config = data.config;
  const background = noteBackground(config);

  return (
    <div
      className={`dxp-note-card ${selected ? 'is-selected' : ''} ${background === 'transparent' ? 'is-transparent' : ''}`}
      style={{ backgroundColor: background, color: noteForeground(background) }}
    >
      <div className="dxp-note-header" title={t('noteCard.dragToMoveNote')}>
        <StickyNote size={15} aria-hidden="true" />
        <strong>{data.label || t('noteCard.note')}</strong>
        <GripHorizontal className="dxp-note-grip" size={16} aria-hidden="true" />
      </div>
      <NoteTextEditor
        noteId={id}
        config={config}
        className="dxp-note-text nodrag nopan nowheel"
        ariaLabel={t('noteCard.valueText', { value: String(data.label || 'Note') })}
        onChange={(patch) => onChange(id, patch)}
      />
    </div>
  );
}
