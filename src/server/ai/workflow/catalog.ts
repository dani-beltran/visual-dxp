import { nodeDescriptions } from '../../../lib/nodeDescriptions';
import type { NodeKind, StepConfig } from './types';
export const catalog: {
  kind: NodeKind;
  label: string;
  description: string;
  config: StepConfig;
}[] = [
  {
    kind: 'trigger',
    label: 'Trigger',
    description: nodeDescriptions.trigger,
    config: { event: 'page-load', selector: '#shop-now' },
  },
  {
    kind: 'http',
    label: 'HTTP request',
    description: nodeDescriptions.http,
    config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: '{}' },
  },
  {
    kind: 'transform',
    label: 'Data Transform',
    description: nodeDescriptions.transform,
    config: { dataPath: '', transformations: [] },
  },
  {
    kind: 'dom',
    label: 'Customize Page',
    description: nodeDescriptions.dom,
    config: { changes: [] },
  },
  {
    kind: 'delay',
    label: 'Delay',
    description: nodeDescriptions.delay,
    config: { duration: 1500 },
  },
  {
    kind: 'fork',
    label: 'Condition',
    description: nodeDescriptions.fork,
    config: { conditionType: 'selector', condition: '#shop-now' },
  },
  {
    kind: 'loop',
    label: 'Loop',
    description: nodeDescriptions.loop,
    config: { iterations: 3 },
  },
  {
    kind: 'track-event',
    label: 'Track event',
    description: nodeDescriptions['track-event'],
    config: { analyticsEventName: 'milestone_reached' },
  },
  {
    kind: 'experiment',
    label: 'Experiment',
    description: nodeDescriptions.experiment,
    config: { experimentSplit: 50 },
  },
  {
    kind: 'popover',
    label: 'Popover',
    description: nodeDescriptions.popover,
    config: {
      contentType: 'html',
      content:
        '<div style="padding:28px;font-family:system-ui;color:#203a30"><span style="font-size:11px;letter-spacing:2px;color:#277457">A LITTLE SOMETHING FOR YOU</span><h2 style="font-size:29px;line-height:1.15;font-weight:500;margin:14px 0">Good things start here.</h2><p style="color:#6b7770;line-height:1.6">Welcome to Atelier. Enjoy 15% off your first order with code <strong>HELLO15</strong>.</p><a href="#collection" style="display:inline-block;background:#267456;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:8px">Find your everyday favorite ↗</a></div>',
      position: 'bottom-right',
      width: 360,
    },
  },
  {
    kind: 'cookie',
    label: 'Set cookie',
    description: nodeDescriptions.cookie,
    config: { cookieName: 'audience', cookieValue: 'returning', cookieDays: 0 },
  },
  {
    kind: 'note',
    label: 'Note',
    description: nodeDescriptions.note,
    config: {
      noteText: '',
      noteColor: '#fff4b8',
      noteMarks: [],
    },
  },
];
