import type { Edge, Node } from '@xyflow/react';
export type NodeKind = 'trigger' | 'http' | 'dom' | 'delay' | 'fork' | 'loop' | 'popover' | 'note';
/** A styled text range using UTF-16 offsets, sorted without overlapping other ranges. */
export interface NoteMark {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}
export type ConditionType =
  | 'selector'
  | 'device'
  | 'language'
  | 'referrer'
  | 'query-param'
  | 'cookie';
export interface StepConfig {
  event?: 'page-load' | 'click' | 'mouseover' | 'submit' | 'change';
  selector?: string;
  url?: string;
  method?: string;
  headers?: string;
  body?: string;
  action?: 'text' | 'html' | 'add-class' | 'remove-class' | 'hide' | 'show' | 'attribute';
  value?: string;
  attribute?: string;
  duration?: number;
  /** Omitted in older workflows, which check CSS selector existence. */
  conditionType?: ConditionType;
  /** CSS selector used by selector conditions. */
  condition?: string;
  /** Exact query parameter, cookie, local storage, or session storage key. */
  conditionKey?: string;
  /** Expected device, language, referrer domain, or stored string (including empty). */
  conditionValue?: string;
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
