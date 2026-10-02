import { Handle, type NodeProps, Position, useStore } from '@xyflow/react';
import { ArrowRight, Check, Circle, Ellipsis, LoaderCircle } from 'lucide-react';
import { useContext } from 'react';
import { getCatalog, stepSummary } from '../lib/catalog';
import { useBuilderI18n } from '../lib/i18nContext';
import { getNodeDataFlow, getNodeDataPorts } from '../lib/nodeData';
import { NoteEditingContext } from '../lib/noteEditing';
import type { WorkflowNode } from '../lib/types';
import { FrameCard } from './FrameCard';
import { NoteCard } from './NoteCard';

export function WorkflowCard({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { t } = useBuilderI18n();
  const catalog = getCatalog(t);
  const editNote = useContext(NoteEditingContext);
  const dataFlow = useStore((state) =>
    getNodeDataFlow(id, state.nodes as WorkflowNode[], state.edges),
  );
  const receivesData = useStore((state) =>
    state.edges.some((edge) => {
      if (edge.target !== id) return false;
      const sourceFlow = getNodeDataFlow(edge.source, state.nodes as WorkflowNode[], state.edges);
      return sourceFlow === 'produces' || sourceFlow === 'forwards';
    }),
  );
  if (data.kind === 'frame') return <FrameCard data={data} selected={selected} />;
  if (data.kind === 'note')
    return <NoteCard id={id} data={data} selected={selected} onChange={editNote} />;
  const entry = catalog.find((x) => x.kind === data.kind)!;
  const Icon = entry.icon;
  const split = data.kind === 'fork' || data.kind === 'loop';
  const { outputsData } = getNodeDataPorts(data);
  const highlightsOutput = dataFlow === 'forwards' || outputsData;
  const sendsData = dataFlow === 'produces' || dataFlow === 'forwards';
  const outputLabel =
    dataFlow === 'produces'
      ? data.kind === 'transform'
        ? t('transform.outputHint')
        : t('workflowCard.responseDataOutput')
      : t('workflowCard.forwardsData');
  const dataFlowLabel =
    dataFlow === 'produces'
      ? t('workflowCard.producesData')
      : dataFlow === 'forwards'
        ? t('workflowCard.forwardsData')
        : t('workflowCard.usesIncomingData');
  return (
    <div
      className={`dxp-node dxp-node-${entry.color} ${selected ? 'is-selected' : ''} ${data.status === 'running' ? 'is-running' : ''}`}
    >
      {data.kind !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Left}
          className={receivesData ? 'dxp-handle-data' : undefined}
          title={receivesData ? t('workflowCard.incomingData') : undefined}
          aria-label={receivesData ? t('workflowCard.incomingData') : undefined}
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
      <p>{stepSummary(data.kind, data.config, t)}</p>
      {dataFlow && (
        <div className="dxp-node-incoming-value" title={dataFlowLabel}>
          <ArrowRight size={12} aria-hidden="true" /> {dataFlowLabel}
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
            ? t('workflowCard.running')
            : data.status === 'error'
              ? t('workflowCard.needsAttention')
              : data.status === 'success'
                ? t('workflowCard.completed')
                : t('workflowCard.configured')}
        </span>
        <span className={highlightsOutput ? 'dxp-node-data-output' : undefined}>
          {data.kind === 'trigger'
            ? 'START'
            : split
              ? t('workflowCard.2Paths')
              : outputsData
                ? t('workflowCard.dataOut')
                : 'ACTION'}
        </span>
      </div>
      {split ? (
        <>
          <Handle
            type="source"
            id={data.kind === 'fork' ? 'true' : 'body'}
            className={sendsData ? 'dxp-handle-data' : undefined}
            title={
              data.kind === 'fork'
                ? t('workflowCard.truePassesIncomingDataUnchanged')
                : t('workflowCard.body')
            }
            position={Position.Right}
            style={{ top: '37%' }}
          />
          <Handle
            type="source"
            id={data.kind === 'fork' ? 'false' : 'done'}
            className={sendsData ? 'dxp-handle-data' : undefined}
            title={
              data.kind === 'fork'
                ? t('workflowCard.falsePassesIncomingDataUnchanged')
                : t('workflowCard.done')
            }
            position={Position.Right}
            style={{ top: '73%' }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className={sendsData ? 'dxp-handle-data' : undefined}
          title={sendsData ? outputLabel : undefined}
          aria-label={sendsData ? outputLabel : undefined}
        />
      )}
    </div>
  );
}
