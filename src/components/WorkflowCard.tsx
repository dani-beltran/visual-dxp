import { Handle, type NodeProps, Position } from '@xyflow/react';
import { ArrowRight, Check, Circle, Ellipsis, LoaderCircle } from 'lucide-react';
import { useContext } from 'react';
import { catalog, stepSummary } from '../lib/catalog';
import { getNodeDataPorts } from '../lib/nodeData';
import { NoteEditingContext } from '../lib/noteEditing';
import type { WorkflowNode } from '../lib/types';
import { FrameCard } from './FrameCard';
import { NoteCard } from './NoteCard';

export function WorkflowCard({ id, data, selected }: NodeProps<WorkflowNode>) {
  const editNote = useContext(NoteEditingContext);
  if (data.kind === 'frame') return <FrameCard data={data} selected={selected} />;
  if (data.kind === 'note')
    return <NoteCard id={id} data={data} selected={selected} onChange={editNote} />;
  const entry = catalog.find((x) => x.kind === data.kind)!;
  const Icon = entry.icon;
  const split = data.kind === 'fork' || data.kind === 'loop';
  const { acceptsData, outputsData, incomingDataPath } = getNodeDataPorts(data);
  return (
    <div
      className={`dxp-node dxp-node-${entry.color} ${selected ? 'is-selected' : ''} ${data.status === 'running' ? 'is-running' : ''}`}
    >
      {data.kind !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Left}
          className={acceptsData ? 'dxp-handle-data' : undefined}
          title={acceptsData ? 'Incoming data' : undefined}
          aria-label={acceptsData ? 'Incoming data' : undefined}
        />
      )}
      <div className="dxp-node-top">
        <span className={`dxp-node-icon dxp-color-${entry.color}`}>
          <Icon size={19} />
        </span>
        <span className="dxp-node-kind">{entry.label}</span>
        <Ellipsis size={17} className="dxp-node-more" />
      </div>
      <strong>{data.label}</strong>
      <p>{stepSummary(data.kind, data.config)}</p>
      {acceptsData && (
        <div
          className="dxp-node-incoming-value"
          title={
            incomingDataPath
              ? `Incoming data: ${incomingDataPath}`
              : 'Uses the whole incoming value'
          }
        >
          <ArrowRight size={12} aria-hidden="true" /> Uses incoming data
        </div>
      )}
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
        <span className={outputsData ? 'dxp-node-data-output' : undefined}>
          {data.kind === 'trigger'
            ? 'START'
            : split
              ? '2 PATHS'
              : outputsData
                ? 'DATA OUT'
                : 'ACTION'}
        </span>
      </div>
      {split ? (
        <>
          <Handle
            type="source"
            id={data.kind === 'fork' ? 'true' : 'body'}
            title={data.kind === 'fork' ? 'True — passes incoming data unchanged' : 'Body'}
            position={Position.Right}
            style={{ top: '37%' }}
          />
          <Handle
            type="source"
            id={data.kind === 'fork' ? 'false' : 'done'}
            title={data.kind === 'fork' ? 'False — passes incoming data unchanged' : 'Done'}
            position={Position.Right}
            style={{ top: '73%' }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className={outputsData ? 'dxp-handle-data' : undefined}
          title={outputsData ? 'Response data output' : undefined}
          aria-label={outputsData ? 'Response data output' : undefined}
        />
      )}
    </div>
  );
}
