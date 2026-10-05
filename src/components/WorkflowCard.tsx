import { Handle, type NodeProps, Position, useStore, useUpdateNodeInternals } from '@xyflow/react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Circle,
  Ellipsis,
  LoaderCircle,
  Repeat2,
} from 'lucide-react';
import { useContext, useLayoutEffect, useRef } from 'react';
import { getCatalog, stepSummary } from '../lib/catalog';
import { useBuilderI18n } from '../lib/i18nContext';
import { getNodeDataFlow, getNodeDataPorts } from '../lib/nodeData';
import { NoteEditingContext } from '../lib/noteEditing';
import type { WorkflowNode } from '../lib/types';
import { FrameCard } from './FrameCard';
import { NoteCard } from './NoteCard';

function socketClassName(connected: boolean, carriesData: boolean) {
  if (!connected) return undefined;
  return carriesData ? 'dxp-handle-connected dxp-handle-data' : 'dxp-handle-connected';
}

export function WorkflowCard({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { t } = useBuilderI18n();
  const catalog = getCatalog(t);
  const editNote = useContext(NoteEditingContext);
  const bodyRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const refresh = () => updateNodeInternals(id);
    const observer = new ResizeObserver(refresh);
    observer.observe(body);
    return () => observer.disconnect();
  }, [id, updateNodeInternals]);
  const firstOutput =
    data.kind === 'experiment'
      ? 'a'
      : data.kind === 'fork'
        ? 'true'
        : data.kind === 'loop'
          ? 'body'
          : null;
  const secondOutput = data.kind === 'experiment' ? 'b' : data.kind === 'fork' ? 'false' : 'done';
  const inputConnected = useStore((state) => state.edges.some((edge) => edge.target === id));
  const firstOutputConnected = useStore((state) =>
    state.edges.some((edge) => edge.source === id && (edge.sourceHandle ?? null) === firstOutput),
  );
  const secondOutputConnected = useStore((state) =>
    state.edges.some((edge) => edge.source === id && edge.sourceHandle === secondOutput),
  );
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
  const split = data.kind === 'fork' || data.kind === 'loop' || data.kind === 'experiment';
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
          className={socketClassName(inputConnected, receivesData)}
          title={receivesData ? t('workflowCard.incomingData') : undefined}
          aria-label={receivesData ? t('workflowCard.incomingData') : undefined}
        />
      )}
      <div ref={bodyRef} className={`dxp-node-body${split ? ' dxp-node-body-split' : ''}`}>
        <div className="dxp-node-top">
          <span className={`dxp-node-icon dxp-color-${entry.color}`}>
            <Icon size={19} />
          </span>
          <span className="dxp-node-kind">{entry.label}</span>
          <Ellipsis size={17} className="dxp-node-more" />
        </div>
        <div className="dxp-node-title">
          <strong>{data.label}</strong>
          {split && (
            <>
              <span className="dxp-branch-port dxp-branch-port-first" aria-hidden="true">
                {data.kind === 'loop' ? (
                  <Repeat2 size={13} />
                ) : data.kind === 'experiment' ? (
                  'A'
                ) : (
                  'T'
                )}
              </span>
              <Handle
                type="source"
                id={firstOutput ?? undefined}
                className={`dxp-output-first ${socketClassName(firstOutputConnected, sendsData) ?? ''}`}
                title={
                  data.kind === 'experiment'
                    ? t('experiment.variantA')
                    : data.kind === 'fork'
                      ? t('workflowCard.truePassesIncomingDataUnchanged')
                      : t('workflowCard.body')
                }
                position={Position.Right}
              />
            </>
          )}
        </div>
        <p>{stepSummary(data.kind, data.config, t)}</p>
        {dataFlow && (
          <div className="dxp-node-incoming-value" title={dataFlowLabel}>
            <ArrowRight size={12} aria-hidden="true" /> {dataFlowLabel}
          </div>
        )}
        {split && (
          <>
            <span className="dxp-branch-port dxp-branch-port-second" aria-hidden="true">
              {data.kind === 'loop' ? (
                <ArrowDown size={13} />
              ) : data.kind === 'experiment' ? (
                'B'
              ) : (
                'F'
              )}
            </span>
            <Handle
              type="source"
              id={secondOutput}
              className={`dxp-output-second ${socketClassName(secondOutputConnected, sendsData) ?? ''}`}
              title={
                data.kind === 'experiment'
                  ? t('experiment.variantB')
                  : data.kind === 'fork'
                    ? t('workflowCard.falsePassesIncomingDataUnchanged')
                    : t('workflowCard.done')
              }
              position={Position.Right}
            />
          </>
        )}
      </div>
      {!split && (
        <Handle
          type="source"
          position={Position.Right}
          className={socketClassName(firstOutputConnected, sendsData)}
          title={sendsData ? outputLabel : undefined}
          aria-label={sendsData ? outputLabel : undefined}
        />
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
    </div>
  );
}
