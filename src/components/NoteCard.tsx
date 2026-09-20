import { GripHorizontal, StickyNote } from 'lucide-react';
import type { StepConfig, StepData } from '../lib/types';
import { noteBackground, noteForeground } from './NoteControls';
import { NoteTextEditor } from './NoteTextEditor';

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
  const config = data.config;
  const background = noteBackground(config);

  return (
    <div
      className={`dxp-note-card ${selected ? 'is-selected' : ''} ${background === 'transparent' ? 'is-transparent' : ''}`}
      style={{ backgroundColor: background, color: noteForeground(background) }}
    >
      <div className="dxp-note-header" title="Drag to move note">
        <StickyNote size={15} aria-hidden="true" />
        <strong>{data.label || 'Note'}</strong>
        <GripHorizontal className="dxp-note-grip" size={16} aria-hidden="true" />
      </div>
      <NoteTextEditor
        noteId={id}
        config={config}
        className="dxp-note-text nodrag nopan nowheel"
        ariaLabel={`${data.label || 'Note'} text`}
        onChange={(patch) => onChange(id, patch)}
      />
    </div>
  );
}
