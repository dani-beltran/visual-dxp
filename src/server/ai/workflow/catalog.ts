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
    description: 'Choose when it all begins',
    config: { event: 'page-load', selector: '#shop-now' },
  },
  {
    kind: 'http',
    label: 'HTTP request',
    description: 'Connect to any API',
    config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: '{}' },
  },
  {
    kind: 'dom',
    label: 'Update element',
    description: 'Make the page your own',
    config: { selector: '#shop-now', action: 'text', value: 'Discover your next favorite' },
  },
  {
    kind: 'delay',
    label: 'Delay',
    description: 'Wait for the right moment',
    config: { duration: 1500 },
  },
  {
    kind: 'fork',
    label: 'Condition',
    description: 'Branch by visitor or page conditions',
    config: { conditionType: 'selector', condition: '#shop-now' },
  },
  {
    kind: 'loop',
    label: 'Loop',
    description: 'Repeat a set of actions',
    config: { iterations: 3 },
  },
  {
    kind: 'popover',
    label: 'Popover',
    description: 'Put your message in focus',
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
    description: 'Remember a value on this website',
    config: { cookieName: 'audience', cookieValue: 'returning', cookieDays: 0 },
  },
  {
    kind: 'note',
    label: 'Note',
    description: 'Add a note to your canvas',
    config: {
      noteText: '',
      noteColor: '#fff4b8',
      noteMarks: [],
    },
  },
];
