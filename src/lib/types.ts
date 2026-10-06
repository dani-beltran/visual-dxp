import type { Edge, Node } from '@xyflow/react';
import type { ConnectionData } from './connections';
import type { DataOperator } from './data';
import type { DataTransformConfig } from './dataTransform';
export type NodeKind =
  | 'trigger'
  | 'http'
  | 'transform'
  | 'dom'
  | 'track-event'
  | 'cookie'
  | 'delay'
  | 'experiment'
  | 'fork'
  | 'loop'
  | 'popover'
  | 'note'
  | 'frame';
/** A styled text range using UTF-16 offsets, sorted without overlapping other ranges. */
export interface NoteMark {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}
export type ConditionType =
  | 'data'
  | 'selector'
  | 'device'
  | 'language'
  | 'referrer'
  | 'date-range'
  | 'time-of-day'
  | 'weekdays'
  | 'query-param'
  | 'cookie';
export type TriggerEvent =
  | 'page-load'
  | 'click'
  | 'mouseover'
  | 'submit'
  | 'change'
  | 'zoom-in'
  | 'swipe'
  | 'exit-intent'
  | 'rage-click'
  | 'inactivity'
  | 'scroll-thrashing'
  | 'scroll-depth';
export interface StepConfig extends DataTransformConfig {
  event?: TriggerEvent;
  /** Nearby primary clicks required for rage clicking. Defaults to 3. */
  rageClickCount?: number;
  /** Rage click time window in milliseconds. Defaults to 1,000. */
  rageClickWindow?: number;
  /** Maximum distance from the first click in CSS pixels. Defaults to 50. */
  rageClickRadius?: number;
  /** Scroll direction reversals required. Defaults to 4. */
  scrollDirectionChanges?: number;
  /** Scroll thrashing time window in milliseconds. Defaults to 2,000. */
  scrollThrashWindow?: number;
  /** Minimum travel before counting a scroll direction change, in CSS pixels. Defaults to 50. */
  scrollMinDistance?: number;
  /** Percentage of the page's scrollable distance. Defaults to 75. */
  scrollThreshold?: number;
  selector?: string;
  /** Request URL; accepts {{path}} variables from incoming data. */
  url?: string;
  method?: string;
  headers?: string;
  /** Raw request body; accepts {{path}} variables from incoming data (except GET/HEAD). */
  body?: string;
  action?: 'text' | 'html' | 'add-class' | 'remove-class' | 'hide' | 'show' | 'attribute';
  /** Update element content supports {{name}}, nested paths, and {{$}} for the whole input. */
  value?: string;
  attribute?: string;
  /** Cookie name on the current host; supports {{variables}} from incoming data. */
  cookieName?: string;
  /** Cookie value; supports {{variables}} and {{$}}. Encoded when written; may be empty. */
  cookieValue?: string;
  /** Lifetime in whole days, from 0 (browser session, default) to 400. */
  cookieDays?: number;
  /** Delay or inactivity duration in milliseconds. Inactivity defaults to 30,000. */
  duration?: number;
  /** Omitted in older workflows, which check CSS selector existence. */
  conditionType?: ConditionType;
  conditionOperator?: DataOperator;
  /** CSS selector used by selector conditions. */
  condition?: string;
  /** Exact query parameter, cookie, local storage, or session storage key. */
  conditionKey?: string;
  /** Expected device, language, referrer domain, or stored string (including empty). */
  conditionValue?: string;
  /** Inclusive start date in YYYY-MM-DD format, using conditionTimeZone. */
  conditionStartDate?: string;
  /** Selected days: 0 is Sunday, 1 is Monday, through 6 for Saturday. */
  conditionWeekdays?: number[];
  /** Inclusive end date in YYYY-MM-DD format, using conditionTimeZone. */
  conditionEndDate?: string;
  /** Inclusive start minute in 24-hour HH:MM format, using conditionTimeZone. */
  conditionStartTime?: string;
  /** Inclusive end minute in HH:MM format. Earlier times wrap past midnight. */
  conditionEndTime?: string;
  /** Time zone used by date and time conditions. Defaults to the visitor's local time zone. */
  conditionTimeZone?: 'local' | 'utc';
  /** Static custom event name emitted by a Track event node. */
  analyticsEventName?: string;
  analyticsPayload?: string;
  /** Percentage of new assignments sent to A, from 0 to 100. Defaults to 50. */
  experimentSplit?: number;
  /** Stable assignment key on this origin. Empty or omitted uses the node ID. */
  experimentKey?: string;
  /** Omitted in older workflows: no analytics tracking. */
  experimentAnalytics?: 'none' | 'ga4';
  /** Reporting ID, independent from the browser assignment key. */
  experimentId?: string;
  experimentSelector?: string;
  experimentInteraction?: 'click' | 'change';
  /** Exactly one delivery method, reusing the website installation. */
  experimentDelivery?: 'gtag' | 'gtm';
  /** Optional GA4 send_to destination, used only with gtag. */
  experimentMeasurementId?: string;
  iterations?: number;
  contentType?: 'html' | 'iframe';
  content?: string;
  popoverAnimation?: 'none' | 'fade' | 'slide' | 'zoom' | 'bounce';
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'anchor';
  width?: number;
  /** Canvas annotation text; never executed or included in the exported script. */
  noteText?: string;
  /** Note background, as a six-digit hex color or 'transparent'. */
  noteColor?: string;
  noteMarks?: NoteMark[];
  /** Legacy whole-note formatting, used only when noteMarks is absent. */
  noteBold?: boolean;
  noteItalic?: boolean;
  noteStrikethrough?: boolean;
}
export type StepData = {
  kind: NodeKind;
  label: string;
  description?: string;
  config: StepConfig;
  status?: 'idle' | 'running' | 'success' | 'error';
  [key: string]: unknown;
};
export type WorkflowNode = Node<StepData, 'workflow'>;
export type WorkflowEdge = Edge<ConnectionData>;
export interface AnalyticsSettings {
  provider: 'none' | 'ga4';
  /** Stable reporting ID; omitted legacy settings use the workflow name. */
  workflowId?: string;
  /** Reporting revision, distinct from the workflow JSON schema version. */
  workflowVersion?: string;
  delivery?: 'gtag' | 'gtm';
  measurementId?: string;
}
export interface Workflow {
  version: 1;
  name: string;
  websiteUrl: string;
  /** Run on descendant paths on the same origin. Missing in older workflows means false. */
  includeSubpages?: boolean;
  analytics?: AnalyticsSettings;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
/** A host-supplied, JSON-serializable workflow configuration. */
export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  /** Ascending display order, from least to most complex. */
  order: number;
  tags?: string[];
  setupInstructions?: string[];
  workflow: Workflow;
}
export interface RunLog {
  nodeId: string;
  label: string;
  status: 'running' | 'success' | 'error';
  message: string;
  timestamp: number;
}
export interface ValidationIssue {
  /** Stable identifier for issues that affect editor behavior. */
  code?: string;
  edgeId?: string;
  nodeId?: string;
  message: string;
}

/** Run-scoped events emitted only by the active isolated preview. */
export interface PreviewExecutionEvent {
  type: 'start' | 'log' | 'error' | 'stop';
  runId: string;
  log?: RunLog;
}
