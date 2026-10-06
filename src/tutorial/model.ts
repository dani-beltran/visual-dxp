import type { PreviewExecutionEvent, Workflow, WorkflowNode } from '../lib/types';

export const steps = [
  'intro',
  'website',
  'trigger',
  'event',
  'delay',
  'popover',
  'connect',
  'test',
  'result',
  'ai',
  'help',
  'export',
  'presets',
  'finish',
] as const;
export type TutorialStep = (typeof steps)[number];
export type TutorialKind = 'trigger' | 'delay' | 'popover';
export interface TutorialOptions {
  /** The host must supply an accessible practice website with the preview bridge. */
  websiteUrl: string;
  /** Separate from workflow JSON. Defaults to a versioned key scoped to persistenceKey. */
  storageKey?: string;
  /** Optional host UI. Omit for standalone embedded editors. */
  host?: {
    /** Shared DOM root containing the host controls and its export dialog. */
    root?: HTMLElement | null;
    onExportAccessChange?: (mode: 'inspect' | 'backup' | null) => void;
    nameControl?: boolean;
    testControl?: boolean;
    exportContainer?: HTMLElement | null;
    exportOpen?: boolean;
    openExport: (backup?: boolean) => void;
    closeExport: () => void;
  };
}
export interface TutorialRecord {
  version: 1;
  status: 'in-progress' | 'dismissed' | 'completed';
  step: TutorialStep;
  ids: Partial<Record<TutorialKind, string>>;
  defaultContent?: string;
  inspected: Partial<Record<TutorialKind, string>>;
  confirmedTrigger?: string;
  visited: Partial<Record<'ai' | 'help' | 'export' | 'presets', boolean>>;
  tested?: string;
  fingerprint: string;
}
export interface TutorialRun {
  id: string;
  fingerprint: string;
  succeeded: string[];
  error: boolean;
}
/** Positions and transient selection do not change the exercise or its execution. */
export function tutorialFingerprint(w: Workflow) {
  return JSON.stringify({
    name: w.name,
    websiteUrl: w.websiteUrl,
    includeSubpages: w.includeSubpages ?? false,
    analytics: w.analytics,
    nodes: w.nodes
      .map((n) => ({ id: n.id, kind: n.data.kind, config: n.data.config }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: w.edges
      .map((e) => [e.source, e.target, e.sourceHandle ?? null, e.targetHandle ?? null])
      .sort(),
  });
}
export function newTutorial(w: Workflow): TutorialRecord {
  return {
    version: 1,
    status: 'in-progress',
    step: 'intro',
    ids: {},
    inspected: {},
    visited: {},
    fingerprint: tutorialFingerprint(w),
  };
}
export function readTutorial(key?: string): TutorialRecord | null {
  if (!key) return null;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (
      value?.version !== 1 ||
      !steps.includes(value.step) ||
      !['in-progress', 'dismissed', 'completed'].includes(value.status) ||
      typeof value.fingerprint !== 'string' ||
      ['ids', 'inspected', 'visited'].some(
        (k) => !value[k] || typeof value[k] !== 'object' || Array.isArray(value[k]),
      ) ||
      ['trigger', 'delay', 'popover'].some(
        (k) =>
          (value.ids[k] !== undefined && typeof value.ids[k] !== 'string') ||
          (value.inspected[k] !== undefined && typeof value.inspected[k] !== 'string'),
      ) ||
      ['ai', 'help', 'export', 'presets'].some(
        (k) => value.visited[k] !== undefined && typeof value.visited[k] !== 'boolean',
      ) ||
      ['defaultContent', 'confirmedTrigger', 'tested'].some(
        (k) => value[k] !== undefined && typeof value[k] !== 'string',
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function trackCreated(
  record: TutorialRecord,
  node: WorkflowNode,
  workflow: Workflow,
): TutorialRecord {
  const kind = node.data.kind;
  if (!['trigger', 'delay', 'popover'].includes(kind) || record.status === 'completed')
    return record;
  const key = kind as TutorialKind;
  if (workflow.nodes.some((n) => n.id === record.ids[key])) return record;
  return {
    ...record,
    ids: { ...record.ids, [key]: node.id },
    ...(key === 'popover' ? { defaultContent: node.data.config.content } : {}),
    tested: undefined,
  };
}
export function requirements(record: TutorialRecord, w: Workflow, websiteUrl: string) {
  const node = (kind: TutorialKind) =>
    w.nodes.find((n) => n.id === record.ids[kind] && n.data.kind === kind);
  const trigger = node('trigger'),
    delay = node('delay'),
    popover = node('popover');
  const edge = (source?: string, target?: string) =>
    w.edges.some(
      (e) => e.source === source && e.target === target && !e.sourceHandle && !e.targetHandle,
    );
  return {
    intro: w.name.trim() === 'My first workflow.',
    website: w.websiteUrl === websiteUrl,
    trigger: !!trigger,
    event:
      !!trigger &&
      trigger.data.config.event === 'page-load' &&
      record.confirmedTrigger === trigger.id,
    delay: !!delay && delay.data.config.duration === 1000 && record.inspected.delay === delay.id,
    popover:
      !!popover &&
      record.inspected.popover === popover.id &&
      typeof record.defaultContent === 'string' &&
      popover.data.config.contentType === 'html' &&
      popover.data.config.content === record.defaultContent,
    connect:
      !!trigger && !!delay && !!popover && edge(trigger.id, delay.id) && edge(delay.id, popover.id),
    test: record.tested === tutorialFingerprint(w),
    result: record.tested === tutorialFingerprint(w),
  };
}
export function missingPrerequisite(
  record: TutorialRecord,
  w: Workflow,
  url: string,
): TutorialStep | undefined {
  const checks = requirements(record, w, url);
  const index = steps.indexOf(record.step);
  return steps.find(
    (step, i) => i < index && step in checks && !checks[step as keyof typeof checks],
  );
}
/** Only a current, unchanged run with ordered success for all three tracked nodes qualifies. */
export function advanceRun(
  run: TutorialRun | null,
  event: PreviewExecutionEvent,
  record: TutorialRecord,
  w: Workflow,
): TutorialRun | null {
  if (event.type === 'start')
    return { id: event.runId, fingerprint: tutorialFingerprint(w), succeeded: [], error: false };
  if (!run || run.id !== event.runId || run.fingerprint !== tutorialFingerprint(w)) return run;
  if (event.type === 'error') return { ...run, error: true };
  if (event.type === 'stop') return null;
  if (!event.log) return run;
  const order = [record.ids.trigger, record.ids.delay, record.ids.popover];
  if (!order.includes(event.log.nodeId)) return run;
  if (event.log.status === 'error') return { ...run, error: true };
  if (event.log.status === 'success' && event.log.nodeId === order[run.succeeded.length])
    return { ...run, succeeded: [...run.succeeded, event.log.nodeId] };
  return run;
}
