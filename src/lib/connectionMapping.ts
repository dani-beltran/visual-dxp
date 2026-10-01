import { type DataSelection, dataTools } from './data';
import type { Workflow } from './types';

export interface ConnectionMapping {
  sourcePath: string;
  targetInput: 'data' | 'value' | 'condition';
  /** Compatibility selection applied only to successful JSON HTTP responses, before sourcePath. */
  responseDataPath?: string;
}

export type ConnectionData = { mapping?: ConnectionMapping; [key: string]: unknown };
export interface ConnectionPreview {
  source: DataSelection;
  /** Distinguishes JSON strings from non-JSON text and request failures. */
  jsonResponse: boolean;
}

type Destination = {
  kind: string;
  config: {
    action?: string;
    value?: string;
    selector?: string;
    attribute?: string;
    valueSource?: string;
    conditionType?: string;
  };
};

export function defaultTargetInput(target?: Destination): ConnectionMapping['targetInput'] {
  if (target?.kind === 'dom' && dataTools.usesIncomingValue(target.config)) return 'value';
  if (target?.kind === 'fork' && target.config.conditionType === 'data') return 'condition';
  return 'data';
}

export function isConnectionMapping(value: unknown): value is ConnectionMapping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const mapping = value as Record<string, unknown>;
  return (
    typeof mapping.sourcePath === 'string' &&
    ['data', 'value', 'condition'].includes(mapping.targetInput as string) &&
    (mapping.responseDataPath === undefined || typeof mapping.responseDataPath === 'string')
  );
}

/** Keep this factory self-contained: it is also serialized into exported workflows. */
export function createConnectionTools(data: typeof dataTools) {
  function validate(
    mapping: ConnectionMapping | undefined,
    target?: Destination,
    sourceKind?: string,
  ) {
    if (mapping === undefined) return;
    if (
      !mapping ||
      typeof mapping !== 'object' ||
      typeof mapping.sourcePath !== 'string' ||
      !['data', 'value', 'condition'].includes(mapping.targetInput)
    )
      throw new Error('Choose a source data path and a supported destination input.');
    data.parsePath(mapping.sourcePath);
    if (mapping.responseDataPath !== undefined) {
      data.parsePath(mapping.responseDataPath);
      if (sourceKind !== undefined && sourceKind !== 'http')
        throw new Error('An imported response selection requires an HTTP source.');
    }
    if (
      target &&
      ((mapping.targetInput === 'value' && target.kind !== 'dom') ||
        (mapping.targetInput === 'condition' && target.kind !== 'fork'))
    )
      throw new Error('The selected destination input is not available on this step.');
  }

  function resolve(mapping: ConnectionMapping | undefined, preview: ConnectionPreview) {
    validate(mapping);
    const incoming =
      mapping?.responseDataPath !== undefined && preview.jsonResponse
        ? data.select(preview.source, mapping.responseDataPath)
        : preview.source;
    const selected = mapping ? data.select(incoming, mapping.sourcePath) : incoming;
    return { incoming: mapping?.targetInput === 'data' ? selected : incoming, selected };
  }
  return { validate, resolve };
}

export const connectionTools = createConnectionTools(dataTools);

/** Idempotent, non-mutating migration. Unconnected legacy settings wait for a connection. */
export function migrateConnectionMappings(workflow: Workflow): Workflow {
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const migrated = new Map<string, Set<string>>();
  const mark = (id: string, key: string) => {
    const keys = migrated.get(id) ?? new Set<string>();
    keys.add(key);
    migrated.set(id, keys);
  };
  const edges = workflow.edges.map((edge) => {
    const source = nodes.get(edge.source)?.data;
    const target = nodes.get(edge.target)?.data;
    const responsePath = source?.kind === 'http' ? source.config.responseDataPath : undefined;
    const targetKey =
      target?.kind === 'dom' &&
      target.config.valueSource === 'incoming-data' &&
      !['hide', 'show'].includes(target.config.action ?? 'text')
        ? 'valueDataPath'
        : target?.kind === 'fork' && target.config.conditionType === 'data'
          ? 'conditionDataPath'
          : undefined;
    const targetPath = targetKey ? target?.config[targetKey] : undefined;
    if (responsePath === undefined && targetPath === undefined) return edge;
    const mapping: ConnectionMapping = {
      sourcePath: targetPath ?? '',
      targetInput:
        targetKey === 'valueDataPath'
          ? 'value'
          : targetKey === 'conditionDataPath'
            ? 'condition'
            : 'data',
      ...(responsePath === undefined ? {} : { responseDataPath: responsePath }),
      ...edge.data?.mapping,
    };
    if (responsePath !== undefined) mark(edge.source, 'responseDataPath');
    if (targetPath !== undefined && targetKey) mark(edge.target, targetKey);
    return { ...edge, data: { ...edge.data, mapping } };
  });
  if (!migrated.size) return workflow;
  return {
    ...workflow,
    edges,
    nodes: workflow.nodes.map((node) => {
      const keys = migrated.get(node.id);
      if (!keys) return node;
      const config = { ...node.data.config };
      for (const key of keys) delete config[key as keyof typeof config];
      return { ...node, data: { ...node.data, config } };
    }),
  };
}
