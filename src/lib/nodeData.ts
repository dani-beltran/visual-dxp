import { dataTools } from './data';
import { popoverHasForm } from './popoverForm';
import type { NodeKind, StepConfig, StepData, WorkflowEdge, WorkflowNode } from './types';

interface NodeDataPorts {
  acceptsData: boolean;
  outputsData: boolean;
}

// Define data-port behavior once per node kind. Config changes are evaluated on render.
// These describe data inputs/outputs shown on the canvas, including condition pass-through.
const dataPorts: Partial<Record<NodeKind, (config: StepConfig) => NodeDataPorts>> = {
  'track-event': (config) => ({
    acceptsData: dataTools.hasVariables(config.analyticsPayload),
    outputsData: false,
  }),
  transform: () => ({ acceptsData: true, outputsData: true }),
  http: () => ({ acceptsData: true, outputsData: true }),
  // A form replaces incoming data with its submitted fields.
  popover: (config) => ({ acceptsData: false, outputsData: popoverHasForm(config) }),
  fork: (config) => ({
    acceptsData: config.conditionType === 'data',
    outputsData: false,
  }),
  dom: (config) => ({
    acceptsData: dataTools.usesIncomingValue(config),
    outputsData: false,
  }),
  cookie: (config) => ({
    acceptsData:
      dataTools.hasVariables(config.cookieName) || dataTools.hasVariables(config.cookieValue),
    outputsData: false,
  }),
};

/** Describes configured socket capabilities independently of connected data flow. */
export function getNodeDataPorts(node?: Pick<StepData, 'kind' | 'config'>): NodeDataPorts {
  return (
    (node && dataPorts[node.kind]?.(node.config)) ?? {
      acceptsData: false,
      outputsData: false,
    }
  );
}

type DataFlowNode = Pick<WorkflowNode, 'id' | 'data'>;
type DataFlowEdge = Pick<WorkflowEdge, 'source' | 'target'>;

/** Steps that replace incoming data with their own output: responses, transforms, form payloads. */
export function producesData(node?: Pick<StepData, 'kind' | 'config'>): boolean {
  if (!node) return false;
  if (node.kind === 'http' || node.kind === 'transform') return true;
  return node.kind === 'popover' && popoverHasForm(node.config ?? {});
}

/** Describes potential data flow through the connected graph, before execution. */
export function getNodeDataFlow(
  id: string,
  nodes: DataFlowNode[],
  edges: DataFlowEdge[],
): 'produces' | 'forwards' | 'receives' | undefined {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const isExecutable = (node?: DataFlowNode) =>
    node && !['trigger', 'note', 'frame'].includes(node.data.kind);
  const node = nodeMap.get(id);
  if (!isExecutable(node)) return undefined;
  if (producesData(node?.data)) return 'produces';

  const sources = new Map<string, string[]>();
  for (const edge of edges) {
    const incoming = sources.get(edge.target) ?? [];
    incoming.push(edge.source);
    sources.set(edge.target, incoming);
  }
  const pending = [...(sources.get(id) ?? [])];
  const visited = new Set([id]);
  while (pending.length) {
    const sourceId = pending.pop();
    if (sourceId === undefined) break;
    if (visited.has(sourceId)) continue;
    visited.add(sourceId);
    const source = nodeMap.get(sourceId);
    if (!isExecutable(source)) continue;
    if (producesData(source?.data)) {
      return edges.some((edge) => edge.source === id && isExecutable(nodeMap.get(edge.target)))
        ? 'forwards'
        : 'receives';
    }
    pending.push(...(sources.get(sourceId) ?? []));
  }
  return undefined;
}
