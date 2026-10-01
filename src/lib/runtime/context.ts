import type { DataSelection } from '../data';
import type { RunLog, Workflow } from '../types';
import type { RuntimeOptions } from './types';

export function createRuntimeContext(workflow: Workflow, options: RuntimeOptions) {
  const doc = options.document ?? globalThis.document;
  const win = options.window ?? doc?.defaultView ?? globalThis.window;
  if (!doc || !win) throw new Error('A browser document is required to run this workflow.');
  const controller = new AbortController();
  const signal = controller.signal;
  const cleanups = new Set<() => void>();
  const popovers = new Map<string, () => void>();
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const fetcher = options.fetch ?? win.fetch?.bind(win) ?? globalThis.fetch?.bind(globalThis);
  const maxSteps = Math.max(1, Math.min(100000, options.maxSteps ?? 10000));

  function aborted(): void {
    if (signal.aborted) {
      const error = new Error('Workflow stopped.');
      error.name = 'AbortError';
      throw error;
    }
  }

  function log(nodeId: string, status: RunLog['status'], message: string): void {
    const node = nodes.get(nodeId);
    try {
      options.onLog?.({
        nodeId,
        label: node?.data.label ?? nodeId,
        status,
        message,
        timestamp: Date.now(),
      });
    } catch {
      /* A consumer's log callback must not interrupt the workflow. */
    }
  }

  function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      aborted();
      const stop = () => {
        win.clearTimeout(timer);
        signal.removeEventListener('abort', stop);
        const error = new Error('Workflow stopped.');
        error.name = 'AbortError';
        reject(error);
      };
      const timer = win.setTimeout(() => {
        signal.removeEventListener('abort', stop);
        resolve();
      }, milliseconds);
      signal.addEventListener('abort', stop, { once: true });
    });
  }

  function selectorElements(selector: string | undefined): Element[] {
    if (!selector?.trim()) throw new Error('Choose a target element first.');
    const elements = Array.from(doc.querySelectorAll(selector));
    if (!elements.length) throw new Error(`No elements match “${selector}”.`);
    return elements;
  }

  function reportFailure(error: unknown): void {
    if (!signal.aborted) console.error('[Visual DXP]', error);
  }

  function listen(
    target: EventTarget,
    event: string,
    listener: (event: Event) => void,
    capture = false,
  ): void {
    target.addEventListener(event, listener, { passive: true, capture });
    cleanups.add(() => target.removeEventListener(event, listener, capture));
  }

  return {
    onConnectionPreview: options.onConnectionPreview,
    data: { exists: false, value: undefined } as DataSelection,
    doc,
    win,
    controller,
    signal,
    cleanups,
    popovers,
    nodes,
    fetcher,
    maxSteps,
    destroyed: false,
    aborted,
    log,
    wait,
    selectorElements,
    reportFailure,
    listen,
  };
}

export type RuntimeContext = ReturnType<typeof createRuntimeContext>;
