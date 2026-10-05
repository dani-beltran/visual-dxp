import type { ConnectionPreview } from '../connections';
import type { RunLog } from '../types';

export interface RuntimeOptions {
  document?: Document;
  window?: Window;
  fetch?: typeof fetch;
  onLog?: (entry: RunLog) => void;
  /** Transient execution samples; never included in workflow persistence. */
  onConnectionPreview?: (edgeId: string, preview: ConnectionPreview) => void;
  /** Editor previews simulate analytics and never call the website's analytics APIs. */
  analyticsMode?: 'live' | 'simulate';
  /** Optional query string for testing conditions without changing the page location. */
  searchParams?: string;
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
