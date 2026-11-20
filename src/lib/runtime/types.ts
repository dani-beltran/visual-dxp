import type { ConnectionPreview } from '../connections';
import type { DataSelection } from '../data';
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
  /** Original document base for HTTP steps in a proxied preview. */
  baseUrl?: string;
  signal?: AbortSignal;
  /** Maximum executed steps for one trigger invocation. Defaults to 10,000. */
  maxSteps?: number;
}

export interface WorkflowRuntime {
  /** Install event listeners and run page-load triggers. Calling twice is safe. */
  start(): void;
  /**
   * Run a trigger immediately, or all triggers when the ID is omitted. The optional input is
   * passed to the trigger's next steps as incoming data, as custom event triggers do with the
   * event's detail. Without it, the next steps receive no data.
   */
  run(triggerId?: string, input?: DataSelection): Promise<void>;
  /** Abort requests and delays, remove listeners and close runtime popovers. */
  destroy(): void;
}
