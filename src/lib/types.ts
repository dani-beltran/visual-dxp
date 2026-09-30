import type { Edge, Node } from '@xyflow/react';
import type { DataOperator } from './data';
export type NodeKind =
  | 'trigger'
  | 'http'
  | 'dom'
  | 'cookie'
  | 'delay'
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
export interface StepConfig {
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
  url?: string;
  method?: string;
  headers?: string;
  body?: string;
  /** Optional selection within parsed JSON. Non-JSON responses pass as complete text. */
  responseDataPath?: string;
  action?: 'text' | 'html' | 'add-class' | 'remove-class' | 'hide' | 'show' | 'attribute';
  value?: string;
  /** Value source for Update element actions. Older workflows default to manual. */
  valueSource?: 'manual' | 'incoming-data';
  /** Optional selection within incoming data for Update element. */
  valueDataPath?: string;
  attribute?: string;
  /** Name of the cookie to create or overwrite on the current host. */
  cookieName?: string;
  /** Cookie value, encoded when written. An empty string is allowed. */
  cookieValue?: string;
  /** Lifetime in whole days, from 0 (browser session, default) to 400. */
  cookieDays?: number;
  /** Delay or inactivity duration in milliseconds. Inactivity defaults to 30,000. */
  duration?: number;
  /** Omitted in older workflows, which check CSS selector existence. */
  conditionType?: ConditionType;
  /** Optional nested selection from incoming node data; empty uses all data. */
  conditionDataPath?: string;
  conditionOperator?: DataOperator;
  /** CSS selector used by selector conditions. */
  condition?: string;
  /** Exact query parameter, cookie, local storage, or session storage key. */
  conditionKey?: string;
  /** Expected device, language, referrer domain, or stored string (including empty). */
  conditionValue?: string;
  /** Inclusive start date in YYYY-MM-DD format, using conditionTimeZone. */
  conditionStartDate?: string;
  /** Inclusive end date in YYYY-MM-DD format, using conditionTimeZone. */
  conditionEndDate?: string;
  /** Inclusive start minute in 24-hour HH:MM format, using conditionTimeZone. */
  conditionStartTime?: string;
  /** Inclusive end minute in HH:MM format. Earlier times wrap past midnight. */
  conditionEndTime?: string;
  /** Time zone used by date and time conditions. Defaults to the visitor's local time zone. */
  conditionTimeZone?: 'local' | 'utc';
  iterations?: number;
  contentType?: 'html' | 'iframe';
  content?: string;
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
export type WorkflowEdge = Edge;
export interface Workflow {
  version: 1;
  name: string;
  websiteUrl: string;
  /** Run on descendant paths on the same origin. Missing in older workflows means false. */
  includeSubpages?: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
export interface RunLog {
  nodeId: string;
  label: string;
  status: 'running' | 'success' | 'error';
  message: string;
  timestamp: number;
}
export interface ValidationIssue {
  nodeId?: string;
  message: string;
}
