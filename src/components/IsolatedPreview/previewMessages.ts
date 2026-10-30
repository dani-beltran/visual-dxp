import type { ConnectionPreview } from '../../lib/connections';
import type { RunLog, Workflow } from '../../lib/types';

type PreviewMessage =
  | { type: 'pick-element'; selector: string }
  | { type: 'pick-cancel' | 'close' | 'error' }
  | { type: 'connection-preview'; edgeId: string; preview: ConnectionPreview }
  | { type: 'log'; log: RunLog };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Validate untrusted payloads after the connection checks source/origin/channel. */
export function readPreviewMessage(
  data: Record<string, unknown>,
  {
    workflow,
    runId,
    picking,
    stepLabel,
    now,
  }: {
    workflow: Workflow;
    runId: string;
    picking: boolean;
    stepLabel: string;
    now: number;
  },
): PreviewMessage | undefined {
  if (data.type === 'close') return { type: 'close' };
  if (data.type === 'pick-cancel' && picking) return { type: 'pick-cancel' };
  if (
    data.type === 'pick-element' &&
    picking &&
    typeof data.selector === 'string' &&
    data.selector.trim() &&
    data.selector.length <= 4000
  )
    return { type: 'pick-element', selector: data.selector };
  if (!runId || data.runId !== runId) return;
  if (data.type === 'error') return { type: 'error' };
  if (data.type === 'connection-preview') {
    const sample = data.preview;
    if (
      typeof data.edgeId !== 'string' ||
      !workflow.edges.some((edge) => edge.id === data.edgeId) ||
      !record(sample) ||
      !record(sample.source) ||
      typeof sample.source.exists !== 'boolean'
    )
      return;
    try {
      const encoded = JSON.stringify(sample.source.value);
      if (encoded && encoded.length > 32768) return;
      return {
        type: 'connection-preview',
        edgeId: data.edgeId,
        preview: {
          source: {
            exists: sample.source.exists,
            value: encoded === undefined ? undefined : JSON.parse(encoded),
          },
        },
      };
    } catch {
      return; // Ignore malformed or oversized execution samples.
    }
  }
  if (data.type === 'log') {
    const log = data.log;
    if (
      !record(log) ||
      typeof log.nodeId !== 'string' ||
      typeof log.message !== 'string' ||
      log.message.length > 2000 ||
      (log.status !== 'running' && log.status !== 'success' && log.status !== 'error')
    )
      return;
    const node = workflow.nodes.find((candidate) => candidate.id === log.nodeId);
    if (!node) return;
    // Take known fields only; labels and timestamps belong to the editor.
    return {
      type: 'log',
      log: {
        nodeId: node.id,
        label: node.data.label ?? stepLabel,
        status: log.status,
        message: log.message,
        timestamp: now,
      },
    };
  }
}
