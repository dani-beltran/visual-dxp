import type { ConnectionPreview } from '../connectionMapping';
import type { RunLog } from '../types';

export interface RuntimeOptions {
  document?: Document;
  window?: Window;
  fetch?: typeof fetch;
  onLog?: (entry: RunLog) => void;
  /** Transient execution samples; never included in workflow persistence. */
  onConnectionPreview?: (edgeId: string, preview: ConnectionPreview) => void;
  signal?: AbortSignal;
  /** Maximum executed steps for one trigger invocation. Defaults to 10,000. */
  maxSteps?: number;
}

export interface WorkflowRuntime {
  /** Install event listeners and run page-load triggers. Calling twice is safe. */
  start(): void;
  /** Run a trigger immediately, or all triggers when the ID is omitted. */
  run(triggerId?: string): Promise<void>;
  /** Abort requests and delays, remove listeners and close runtime popovers. */
  destroy(): void;
}
