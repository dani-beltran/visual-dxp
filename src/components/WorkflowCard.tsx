import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Check, Circle, Ellipsis, LoaderCircle } from 'lucide-react';
import { useContext } from 'react';
import { catalog, stepSummary } from '../lib/catalog';
import { NoteEditingContext } from '../lib/noteEditing';
import type { WorkflowNode } from '../lib/types';
import { NoteCard } from './NoteCard';

export function WorkflowCard({ id, data, selected }: NodeProps<WorkflowNode>) {
  const editNote = useContext(NoteEditingContext);
  if (data.kind === 'note')
    return <NoteCard id={id} data={data} selected={selected} onChange={editNote} />;
  const entry = catalog.find((x) => x.kind === data.kind)!;
  const Icon = entry.icon;
  const split = data.kind === 'fork' || data.kind === 'loop';
  return (
    <div
      className={`dxp-node dxp-node-${entry.color} ${selected ? 'is-selected' : ''} ${data.status === 'running' ? 'is-running' : ''}`}
    >
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Left} />}
      <div className="dxp-node-top">
        <span className={`dxp-node-icon dxp-color-${entry.color}`}>
          <Icon size={19} />
        </span>
        <span className="dxp-node-kind">{entry.label}</span>
        <Ellipsis size={17} className="dxp-node-more" />
      </div>
      <strong>{data.label}</strong>
      <p>{stepSummary(data.kind, data.config)}</p>
      <div className="dxp-node-footer">
        <span>
          {data.status === 'running' ? (
            <LoaderCircle size={12} className="dxp-spin" />
          ) : data.status === 'error' ? (
            <Circle size={10} />
          ) : (
            <Check size={12} />
          )}{' '}
          {data.status === 'running'
            ? 'Running'
            : data.status === 'error'
              ? 'Needs attention'
              : data.status === 'success'
                ? 'Completed'
                : 'Configured'}
        </span>
        <span>{data.kind === 'trigger' ? 'START' : split ? '2 PATHS' : 'ACTION'}</span>
      </div>
      {split ? (
        <>
          <Handle
            type="source"
            id={data.kind === 'fork' ? 'true' : 'body'}
            title={data.kind === 'fork' ? 'True' : 'Body'}
            position={Position.Right}
            style={{ top: '37%' }}
          />
          <Handle
            type="source"
            id={data.kind === 'fork' ? 'false' : 'done'}
            title={data.kind === 'fork' ? 'False' : 'Done'}
            position={Position.Right}
            style={{ top: '73%' }}
          />
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
