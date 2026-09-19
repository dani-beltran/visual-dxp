import type { Edge, Node } from '@xyflow/react';
export type NodeKind = 'trigger' | 'http' | 'dom' | 'delay' | 'fork' | 'loop' | 'popover';
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
  condition?: string;
  iterations?: number;
  contentType?: 'html' | 'iframe';
  content?: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'anchor';
  width?: number;
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
