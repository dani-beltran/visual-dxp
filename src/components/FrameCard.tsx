import { type NodeProps, NodeResizer } from '@xyflow/react';
import { Frame, GripHorizontal } from 'lucide-react';
import { FRAME_MIN_HEIGHT, FRAME_MIN_WIDTH } from '../lib/frames';
import { useBuilderI18n } from '../lib/i18nContext';
import type { WorkflowNode } from '../lib/types';
import '../styles/frames.css';

export function FrameCard({ data, selected }: Pick<NodeProps<WorkflowNode>, 'data' | 'selected'>) {
  const { t } = useBuilderI18n();
  return (
    <div className={`dxp-frame-card ${selected ? 'is-selected' : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={FRAME_MIN_WIDTH}
        minHeight={FRAME_MIN_HEIGHT}
        color="#789bb1"
      />
      <div className="dxp-frame-header" title={t('frameCard.dragToMoveThisFrameAndItsNodes')}>
        <Frame size={16} aria-hidden="true" />
        <strong>{data.label || t('frameCard.frame')}</strong>
        <GripHorizontal size={16} aria-hidden="true" />
      </div>
      <span className="dxp-frame-hint">{t('frameCard.dropNodesInsideToGroupThem')}</span>
    </div>
  );
}
