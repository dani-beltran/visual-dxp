import type { ConnectionData } from '../../../lib/connections';
import type { DataTransformConfig } from '../../../lib/dataTransform';
import type { DataOperator } from './data';
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
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'anchor';
  width?: number;
  noteText?: string;
  noteMarks?: NoteMark[];
  noteColor?: string;
  noteBold?: boolean;
  noteItalic?: boolean;
  noteStrikethrough?: boolean;
}
export type StepData = {
  kind: NodeKind;
  label: string;
  description?: string;
  config: StepConfig;
};
/** JSON transport contract, independent of the frontend's canvas implementation. */
export interface WorkflowNode {
  id: string;
  type: 'workflow';
  position: { x: number; y: number };
  parentId?: string;
  width?: number;
  height?: number;
  data: StepData;
}
export interface WorkflowEdge {
  data?: ConnectionData;
  id: string;
  source: string;
  target: string;
  type?: 'smoothstep';
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}
export interface Workflow {
  version: 1;
  name: string;
  websiteUrl: string;
  /** Run on descendant paths on the same origin. Missing in older workflows means false. */
  includeSubpages?: boolean;
  analytics?: import('../../../lib/types').AnalyticsSettings;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
export interface ValidationIssue {
  nodeId?: string;
  message: string;
}
