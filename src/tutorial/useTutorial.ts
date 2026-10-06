import { useEffect, useRef, useState } from 'react';
import type { PreviewExecutionEvent, Workflow, WorkflowNode } from '../lib/types';
import {
  advanceRun,
  missingPrerequisite,
  newTutorial,
  readTutorial,
  requirements,
  steps,
  type TutorialOptions,
  type TutorialRecord,
  type TutorialRun,
  type TutorialStep,
  trackCreated,
  tutorialFingerprint,
} from './model';

export function useTutorial({
  options,
  persistenceKey,
  workflow,
  selectedId,
  assistant,
  view,
  previewOpen,
  aiAvailable,
  presetsAvailable,
}: {
  options?: TutorialOptions;
  persistenceKey?: string;
  workflow: Workflow;
  selectedId: string | null;
  assistant: string | null;
  view: string;
  previewOpen: boolean;
  aiAvailable: boolean;
  presetsAvailable: boolean;
}) {
  const key = options?.storageKey ?? (persistenceKey ? `${persistenceKey}:tutorial:v1` : undefined);
  const [record, setRecord] = useState<TutorialRecord | null>(() =>
    options
      ? (readTutorial(key) ?? {
          ...newTutorial(workflow),
          needsReset: !!(workflow.nodes.length || workflow.edges.length),
        })
      : null,
  );
  const [active, setActive] = useState(record?.status === 'in-progress');
  const [gate, setGate] = useState<'reset' | 'mismatch' | null>(() =>
    record?.status !== 'in-progress'
      ? null
      : record.needsReset
        ? 'reset'
        : record.fingerprint !== tutorialFingerprint(workflow)
          ? 'mismatch'
          : null,
  );
  const [error, setError] = useState(false);
  const run = useRef<TutorialRun | null>(null);
  const ref = useRef(record);
  ref.current = record;
  const live = useRef(workflow);
  live.current = workflow;
  const sequence = steps.filter(
    (s) =>
      (s !== 'ai' || aiAvailable) &&
      (s !== 'export' || options?.host) &&
      (s !== 'presets' || presetsAvailable),
  );
  const step = record
    ? (sequence.find((s) => steps.indexOf(s) >= steps.indexOf(record.step)) ?? 'finish')
    : 'intro';
  const exportAccess = options?.host?.onExportAccessChange;
  useEffect(() => {
    exportAccess?.(active ? (gate ? 'backup' : step === 'export' ? 'inspect' : null) : null);
    return () => exportAccess?.(null);
  }, [active, gate, step, exportAccess]);
  const fingerprint = tutorialFingerprint(workflow);
  useEffect(() => {
    if (!record || !key) return;
    try {
      localStorage.setItem(key, JSON.stringify(record));
    } catch {
      /* In-memory progress remains usable. */
    }
  }, [record, key]);
  useEffect(() => {
    if (!active || gate) return;
    setRecord((previous) => {
      if (!previous) return previous;
      const inspected = { ...previous.inspected };
      for (const kind of ['trigger', 'delay', 'popover'] as const) {
        if (selectedId && previous.ids[kind] === selectedId && view === 'canvas' && !previewOpen)
          inspected[kind] = selectedId;
      }
      const visited = { ...previous.visited };
      if (step === 'ai' && assistant === 'chat') visited.ai = true;
      if (step === 'help' && assistant === 'help') visited.help = true;
      if (step === 'presets' && view === 'presets') visited.presets = true;
      if (step === 'export' && options?.host?.exportOpen) visited.export = true;
      const next = {
        ...previous,
        inspected,
        visited,
        fingerprint,
        tested: previous.tested === fingerprint ? previous.tested : undefined,
      };
      return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
    });
  }, [
    active,
    gate,
    selectedId,
    view,
    previewOpen,
    assistant,
    step,
    options?.host?.exportOpen,
    fingerprint,
  ]);
  function start() {
    setActive(true);
    setError(false);
    if (record && record.status !== 'completed') {
      setRecord({ ...record, status: 'in-progress', step });
      if (record.needsReset) setGate('reset');
      else if (record.fingerprint !== fingerprint) setGate('mismatch');
    } else if (workflow.nodes.length || workflow.edges.length) setGate('reset');
    else setRecord(newTutorial(workflow));
  }
  function begin(w: Workflow) {
    setRecord(newTutorial(w));
    setGate(null);
    setActive(true);
    run.current = null;
    setError(false);
  }
  function exit() {
    setActive(false);
    setGate(null);
    run.current = null;
    if (record)
      setRecord({
        ...record,
        status: record.status === 'completed' ? 'completed' : 'dismissed',
        fingerprint: gate ? record.fingerprint : fingerprint,
      });
  }
  function created(node: WorkflowNode) {
    if (!ref.current || gate || ref.current.status === 'completed') return;
    setRecord((previous) => (previous ? trackCreated(previous, node, live.current) : previous));
  }
  function execution(event: PreviewExecutionEvent) {
    const current = ref.current;
    if (!active || !current || gate || !options) return;
    if (
      event.type !== 'start' &&
      (!run.current ||
        run.current.id !== event.runId ||
        run.current.fingerprint !== tutorialFingerprint(live.current))
    ) {
      if (event.type === 'error' && !event.runId && !run.current) setError(true);
      return;
    }
    run.current = advanceRun(run.current, event, current, live.current);
    if (event.type === 'start') {
      setError(false);
      setRecord((p) => (p ? { ...p, tested: undefined } : p));
    }
    if (event.type === 'error' || run.current?.error) {
      setError(true);
      setRecord((p) => (p ? { ...p, tested: undefined } : p));
    }
    const checks = requirements(current, live.current, options.websiteUrl);
    if (
      run.current?.succeeded.length === 3 &&
      !run.current.error &&
      ['intro', 'website', 'trigger', 'event', 'delay', 'popover', 'connect'].every(
        (s) => checks[s as keyof typeof checks],
      )
    ) {
      setRecord((p) =>
        p
          ? {
              ...p,
              tested: tutorialFingerprint(live.current),
              step: p.step === 'test' ? 'result' : p.step,
            }
          : p,
      );
    }
  }
  const checks = record && options ? requirements(record, workflow, options.websiteUrl) : null;
  const missing =
    record && options
      ? missingPrerequisite({ ...record, step }, workflow, options.websiteUrl)
      : undefined;
  const eventReady =
    !!record &&
    view === 'canvas' &&
    !previewOpen &&
    !options?.host?.exportOpen &&
    selectedId === record.ids.trigger &&
    workflow.nodes.some((n) => n.id === selectedId && n.data.config.event === 'page-load');
  const ready =
    !missing &&
    !!record &&
    (step === 'event'
      ? eventReady || !!checks?.event
      : step === 'result'
        ? !!checks?.result && !previewOpen
        : step === 'ai' || step === 'help' || step === 'presets'
          ? !!record.visited[step]
          : step === 'export'
            ? !!record.visited.export && !options?.host?.exportOpen
            : step === 'finish'
              ? true
              : !!checks?.[step as keyof typeof checks]);
  function go(next: TutorialStep) {
    setRecord((p) => (p ? { ...p, step: next } : p));
  }
  function next() {
    if (!record || !ready) return;
    if (step === 'finish') {
      setRecord({ ...record, status: 'completed', fingerprint });
      setActive(false);
      return;
    }
    setRecord({
      ...record,
      ...(step === 'event' ? { confirmedTrigger: record.ids.trigger } : {}),
      step: sequence[sequence.indexOf(step) + 1],
    });
  }
  return {
    enabled: !!options,
    active,
    gate,
    setGate,
    record,
    step,
    sequence,
    ready,
    missing,
    error,
    start,
    begin,
    exit,
    created,
    execution,
    go,
    next,
    back: () => go(sequence[Math.max(0, sequence.indexOf(step) - 1)]),
    resumeRepair: () => {
      setGate(null);
      setRecord((p) => (p ? { ...p, status: 'in-progress', fingerprint } : newTutorial(workflow)));
    },
  };
}
export type TutorialController = ReturnType<typeof useTutorial>;
