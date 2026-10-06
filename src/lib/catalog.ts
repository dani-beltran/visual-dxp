import {
  Braces,
  ChartNoAxesColumn,
  Cookie,
  FlaskConical,
  Frame,
  GitFork,
  Globe2,
  MousePointerClick,
  PanelTop,
  Repeat2,
  SquareDashedMousePointer,
  StickyNote,
  Timer,
} from 'lucide-react';
import { welcomeJourneyPreset } from '../presets/welcome-journey';
import { dataTools } from './data';
import { FRAME_HEIGHT, FRAME_WIDTH } from './frames';
import { type BuilderTranslator, translateEnglish } from './i18n';
import { nodeDescriptions } from './nodeDescriptions';
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
    description: nodeDescriptions.trigger,
    color: 'green',
    icon: MousePointerClick,
    category: 'Start',
    config: { event: 'page-load', selector: '#shop-now' },
  },
  {
    kind: 'delay',
    label: 'Delay',
    description: nodeDescriptions.delay,
    color: 'amber',
    icon: Timer,
    category: 'Logic',
    config: { duration: 1500 },
  },
  {
    kind: 'dom',
    label: 'Update element',
    description: nodeDescriptions.dom,
    color: 'orange',
    icon: SquareDashedMousePointer,
    category: 'Action',
    config: { selector: '#shop-now', action: 'text', value: 'Discover your next favorite' },
  },
  {
    kind: 'fork',
    label: 'Condition',
    description: nodeDescriptions.fork,
    color: 'violet',
    icon: GitFork,
    category: 'Logic',
    config: { conditionType: 'selector', condition: '#shop-now' },
  },
  {
    kind: 'loop',
    label: 'Loop',
    description: nodeDescriptions.loop,
    color: 'pink',
    icon: Repeat2,
    category: 'Logic',
    config: { iterations: 3 },
  },
  {
    kind: 'popover',
    label: 'Popover',
    description: nodeDescriptions.popover,
    color: 'teal',
    icon: PanelTop,
    category: 'Action',
    config: {
      contentType: 'html',
      content:
        '<div style="padding:28px;font-family:system-ui;color:#203a30"><span style="font-size:11px;letter-spacing:2px;color:#277457">A LITTLE SOMETHING FOR YOU</span><h2 style="font-size:29px;line-height:1.15;font-weight:500;margin:14px 0">Good things start here.</h2><p style="color:#6b7770;line-height:1.6">Welcome to Atelier. Enjoy 15% off your first order with code <strong>HELLO15</strong>.</p><a href="#collection" style="display:inline-block;background:#267456;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:8px">Find your everyday favorite ↗</a></div>',
      position: 'bottom-right',
      popoverAnimation: 'slide',
      width: 360,
    },
  },
  {
    kind: 'http',
    label: 'HTTP request',
    description: nodeDescriptions.http,
    color: 'blue',
    icon: Globe2,
    category: 'Action',
    config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: '{}' },
  },
  {
    kind: 'track-event',
    label: 'Track event',
    description: nodeDescriptions['track-event'],
    config: { analyticsEventName: 'milestone_reached' },
    color: 'analytics',
    icon: ChartNoAxesColumn,
    category: 'Action',
  },
  {
    kind: 'experiment',
    label: 'Experiment',
    description: nodeDescriptions.experiment,
    color: 'violet',
    icon: FlaskConical,
    category: 'Logic',
    config: { experimentSplit: 50 },
  },
  {
    kind: 'transform',
    label: 'Data Transform',
    description: nodeDescriptions.transform,
    color: 'blue',
    icon: Braces,
    category: 'Action',
    config: { dataPath: '', transformations: [] },
  },
  {
    kind: 'cookie',
    label: 'Set cookie',
    description: nodeDescriptions.cookie,
    color: 'brown',
    icon: Cookie,
    category: 'Action',
    config: { cookieName: 'audience', cookieValue: 'returning', cookieDays: 0 },
  },
  {
    kind: 'note',
    label: 'Note',
    description: nodeDescriptions.note,
    color: 'amber',
    icon: StickyNote,
    category: 'Annotation',
    config: {
      noteText: '',
      noteColor: '#fff4b8',
      noteMarks: [],
    },
  },
  {
    kind: 'frame',
    label: 'Frame',
    description: nodeDescriptions.frame,
    color: 'blue',
    icon: Frame,
    category: 'Annotation',
    config: {},
  },
];
export function createNode(kind: NodeKind, position = { x: 200, y: 200 }): WorkflowNode {
  const entry = catalog.find((x) => x.kind === kind)!;
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    type: 'workflow',
    position,
    ...(kind === 'frame' ? { width: FRAME_WIDTH, height: FRAME_HEIGHT } : {}),
    data: { kind, label: entry.label, config: structuredClone(entry.config) },
  };
}
/** The initial workflow is also available in the bundled preset collection. */
export const defaultWorkflow: Workflow = welcomeJourneyPreset.workflow;
/** A summary is presentation text; configuration values are never rewritten. */
export function stepSummary(
  kind: NodeKind,
  c: StepConfig,
  t: BuilderTranslator = translateEnglish,
): string {
  const element = c.selector || t('summary.chooseElement');
  switch (kind) {
    case 'trigger': {
      const event = c.event ?? 'page-load';
      switch (event) {
        case 'page-load':
          return t('summary.pageLoad');
        case 'exit-intent':
          return t('summary.exitIntent');
        case 'rage-click':
          return t('summary.rageClick', {
            count: c.rageClickCount ?? 3,
            seconds: (c.rageClickWindow ?? 1000) / 1000,
          });
        case 'inactivity':
          return t('summary.inactivity', { seconds: (c.duration ?? 30000) / 1000 });
        case 'scroll-thrashing':
          return t('summary.scrollThrashing', {
            count: c.scrollDirectionChanges ?? 4,
            seconds: (c.scrollThrashWindow ?? 2000) / 1000,
          });
        case 'scroll-depth':
          return t('summary.scrollDepth', { percent: c.scrollThreshold ?? 75 });
        default:
          return t('summary.elementEvent', { event, element });
      }
    }
    case 'transform':
      return t('transform.summary', {
        path: c.dataPath || t('transform.wholeValue'),
        count: c.transformations?.length ?? 0,
      });
    case 'http':
      return t('summary.http', {
        method: c.method || 'GET',
        url: c.url ? c.url.replace(/^https?:\/\//, '') : t('summary.configureUrl'),
      });
    case 'dom':
      return t('summary.dom', {
        action: c.action || 'text',
        element,
        incoming: dataTools.usesIncomingValue(c),
        path: '',
      });
    case 'cookie':
      return t('summary.cookie', {
        name: c.cookieName || t('summary.chooseCookie'),
        value: JSON.stringify(c.cookieValue ?? ''),
        days: c.cookieDays || 0,
      });
    case 'delay':
      return t('summary.delay', { seconds: (c.duration ?? 1000) / 1000 });
    case 'fork': {
      switch (c.conditionType ?? 'selector') {
        case 'data':
          return t('summary.data', {
            path: t('summary.dataLabel'),
            operator: t(`data.operator.${c.conditionOperator ?? 'equal'}`),
            value: dataTools.needsValue(c.conditionOperator ?? 'equal')
              ? JSON.stringify(c.conditionValue ?? '')
              : '',
          });
        case 'time-of-day':
          return t('summary.time', {
            start: c.conditionStartTime || '…',
            end: c.conditionEndTime || '…',
            zone: c.conditionTimeZone || 'local',
          });
        case 'date-range':
          return t('summary.date', {
            start: c.conditionStartDate || '…',
            end: c.conditionEndDate || '…',
            zone: c.conditionTimeZone || 'local',
          });
        case 'selector':
          return t('summary.selector', { selector: c.condition || t('summary.chooseSelector') });
        case 'device':
          return t('summary.device', { value: c.conditionValue || '…' });
        case 'language':
          return t('summary.language', { value: c.conditionValue || '…' });
        case 'referrer':
          return t('summary.referrer', { value: c.conditionValue || '…' });
        case 'query-param':
        case 'cookie':
          return t('summary.variable', {
            source: c.conditionType ?? 'query-param',
            name: c.conditionKey || '…',
            value: JSON.stringify(c.conditionValue ?? ''),
          });
        default:
          return t('summary.chooseCondition');
      }
    }
    case 'track-event':
      return c.analyticsEventName || t('analytics.chooseEventName');
    case 'experiment':
      return t('experiment.summary', {
        a: c.experimentSplit ?? 50,
        b: 100 - (c.experimentSplit ?? 50),
      });
    case 'loop':
      return t('summary.loop', { count: c.iterations ?? 3 });
    case 'popover':
      return t('summary.popover', {
        contentType: c.contentType || 'html',
        position: c.position || 'center',
      });
    case 'note':
      return c.noteText || t('summary.writeNote');
    case 'frame':
      return t('summary.frame');
  }
}

/** Presentation metadata; never mutates the shared catalog or saved node labels. */
export function getCatalog(t: BuilderTranslator = translateEnglish) {
  return catalog.map((entry) => ({
    ...entry,
    label: t(`nodes.${entry.kind}.label`),
    description: t(`nodes.${entry.kind}.description`),
  }));
}
