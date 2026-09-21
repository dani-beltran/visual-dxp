import {
  GitFork,
  Globe2,
  MousePointer2,
  MousePointerClick,
  PanelTop,
  Repeat2,
  StickyNote,
  Timer,
} from 'lucide-react';
import type { NodeKind, StepConfig, Workflow, WorkflowNode } from './types';
export const catalog: {
  kind: NodeKind;
  label: string;
  description: string;
  color: string;
  icon: typeof Timer;
  category: string;
  config: StepConfig;
}[] = [
  {
    kind: 'trigger',
    label: 'Trigger',
    description: 'Choose when it all begins',
    color: 'green',
    icon: MousePointerClick,
    category: 'Start',
    config: { event: 'page-load', selector: '#shop-now' },
  },
  {
    kind: 'http',
    label: 'HTTP request',
    description: 'Connect to any API',
    color: 'blue',
    icon: Globe2,
    category: 'Action',
    config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: '{}' },
  },
  {
    kind: 'dom',
    label: 'Update element',
    description: 'Make the page your own',
    color: 'orange',
    icon: MousePointer2,
    category: 'Action',
    config: { selector: '#shop-now', action: 'text', value: 'Discover your next favorite' },
  },
  {
    kind: 'delay',
    label: 'Delay',
    description: 'Wait for the right moment',
    color: 'amber',
    icon: Timer,
    category: 'Logic',
    config: { duration: 1500 },
  },
  {
    kind: 'fork',
    label: 'Condition',
    description: 'Branch by visitor or page conditions',
    color: 'violet',
    icon: GitFork,
    category: 'Logic',
    config: { conditionType: 'selector', condition: '#shop-now' },
  },
  {
    kind: 'loop',
    label: 'Loop',
    description: 'Repeat a set of actions',
    color: 'pink',
    icon: Repeat2,
    category: 'Logic',
    config: { iterations: 3 },
  },
  {
    kind: 'popover',
    label: 'Popover',
    description: 'Put your message in focus',
    color: 'teal',
    icon: PanelTop,
    category: 'Action',
    config: {
      contentType: 'html',
      content:
        '<div style="padding:28px;font-family:system-ui;color:#203a30"><span style="font-size:11px;letter-spacing:2px;color:#277457">A LITTLE SOMETHING FOR YOU</span><h2 style="font-size:29px;line-height:1.15;font-weight:500;margin:14px 0">Good things start here.</h2><p style="color:#6b7770;line-height:1.6">Welcome to Atelier. Enjoy 15% off your first order with code <strong>HELLO15</strong>.</p><a href="#collection" style="display:inline-block;background:#267456;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:8px">Find your everyday favorite ↗</a></div>',
      position: 'bottom-right',
      width: 360,
    },
  },
  {
    kind: 'note',
    label: 'Note',
    description: 'Leave a thought on the canvas',
    color: 'amber',
    icon: StickyNote,
    category: 'Annotation',
    config: {
      noteText: '',
      noteColor: '#fff4b8',
      noteMarks: [],
    },
  },
];
export function createNode(kind: NodeKind, position = { x: 200, y: 200 }): WorkflowNode {
  const entry = catalog.find((x) => x.kind === kind)!;
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    type: 'workflow',
    position,
    data: { kind, label: entry.label, config: { ...entry.config } },
  };
}
export const defaultWorkflow: Workflow = {
  version: 1,
  name: 'Welcome journey',
  websiteUrl: '/demo-site.html',
  nodes: [
    {
      id: 'welcome',
      type: 'workflow',
      position: { x: 60, y: 220 },
      data: { kind: 'trigger', label: 'Page visited', config: { event: 'page-load' } },
    },
    {
      id: 'pause',
      type: 'workflow',
      position: { x: 350, y: 220 },
      data: { kind: 'delay', label: 'Give it a moment', config: { duration: 1500 } },
    },
    {
      id: 'check',
      type: 'workflow',
      position: { x: 640, y: 220 },
      data: {
        kind: 'fork',
        label: 'Find the right moment',
        config: { conditionType: 'selector', condition: '#shop-now' },
      },
    },
    {
      id: 'offer',
      type: 'workflow',
      position: { x: 950, y: 85 },
      data: { kind: 'popover', label: 'A little welcome gift', config: { ...catalog[6].config } },
    },
    {
      id: 'update',
      type: 'workflow',
      position: { x: 950, y: 370 },
      data: {
        kind: 'dom',
        label: 'Make it personal',
        config: {
          ...catalog[2].config,
          selector: '#newsletter h2',
          value: 'A little inspiration, just for you.',
        },
      },
    },
  ],
  edges: [
    { id: 'welcome-pause', source: 'welcome', target: 'pause', type: 'smoothstep' },
    { id: 'pause-check', source: 'pause', target: 'check', type: 'smoothstep' },
    {
      id: 'check-offer',
      source: 'check',
      target: 'offer',
      sourceHandle: 'true',
      label: 'Element found',
      type: 'smoothstep',
    },
    {
      id: 'check-update',
      source: 'check',
      target: 'update',
      sourceHandle: 'false',
      label: 'Otherwise',
      type: 'smoothstep',
    },
  ],
};
export function stepSummary(kind: NodeKind, c: StepConfig): string {
  switch (kind) {
    case 'trigger':
      switch (c.event ?? 'page-load') {
        case 'page-load':
          return 'When a visitor lands on your site';
        case 'zoom-in':
          return `Zoom in · ${c.selector || 'Choose an element'}`;
        case 'swipe':
          return `Swipe · ${c.selector || 'Choose an element'}`;
        case 'exit-intent':
          return 'When a visitor intends to leave';
        case 'rage-click':
          return `${c.rageClickCount ?? 3} nearby clicks within ${(c.rageClickWindow ?? 1000) / 1000}s`;
        case 'inactivity':
          return `After ${(c.duration ?? 30000) / 1000}s of inactivity`;
        case 'scroll-thrashing':
          return `${c.scrollDirectionChanges ?? 4} scroll reversals within ${(c.scrollThrashWindow ?? 2000) / 1000}s`;
        case 'scroll-depth':
          return `Scroll down to ${c.scrollThreshold ?? 75}%`;
        default:
          return `${c.event} · ${c.selector || 'Choose an element'}`;
      }
    case 'http':
      return `${c.method || 'GET'}  ${c.url ? c.url.replace(/^https?:\/\//, '') : 'Configure a URL'}`;
    case 'dom':
      return `${c.action === 'text' ? 'Change text' : c.action || 'Update'} · ${c.selector || 'Choose an element'}`;
    case 'delay':
      return `Wait ${(c.duration ?? 1000) / 1000} seconds`;
    case 'fork': {
      const conditionType = c.conditionType ?? 'selector';
      switch (conditionType) {
        case 'selector':
          return `${c.condition || 'Choose a selector'} exists on the page`;
        case 'device':
          return `Device is ${c.conditionValue || '…'}`;
        case 'language':
          return `Language is ${c.conditionValue || '…'}`;
        case 'referrer':
          return `Referrer domain equals ${c.conditionValue || '…'}`;
        case 'query-param':
        case 'cookie': {
          const source = {
            'query-param': 'URL parameter',
            cookie: 'Cookie or browser storage',
          }[conditionType];
          return `${source} ${c.conditionKey || '…'} = ${JSON.stringify(c.conditionValue ?? '')}`;
        }
        default:
          return 'Choose a condition type';
      }
    }
    case 'loop':
      return `Repeat ${c.iterations ?? 3} times`;
    case 'popover':
      return `${c.contentType === 'iframe' ? 'Embedded page' : 'Custom HTML'} · ${(c.position || 'center').replaceAll('-', ' ')}`;
    case 'note':
      return c.noteText || 'Write a note…';
  }
}
