import { type NodeProps, NodeResizer } from '@xyflow/react';
import { Frame, GripHorizontal } from 'lucide-react';
import { FRAME_MIN_HEIGHT, FRAME_MIN_WIDTH } from '../lib/frames';
import type { WorkflowNode } from '../lib/types';
import '../styles/frames.css';

export function FrameCard({ data, selected }: Pick<NodeProps<WorkflowNode>, 'data' | 'selected'>) {
  return (
    <div className={`dxp-frame-card ${selected ? 'is-selected' : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={FRAME_MIN_WIDTH}
        minHeight={FRAME_MIN_HEIGHT}
        color="#789bb1"
      />
      <div className="dxp-frame-header" title="Drag to move this frame and its nodes">
        <Frame size={16} aria-hidden="true" />
        <strong>{data.label || 'Frame'}</strong>
        <GripHorizontal size={16} aria-hidden="true" />
      </div>
      <span className="dxp-frame-hint">Drop nodes inside to group them</span>
    </div>
  );
}
