import { isConnectionMapping } from './connectionMapping';
import { type DataTransformation, dataTransformTools } from './dataTransform';
import { isNoteMarks } from './noteText';
import type { Workflow } from './types';

const kinds = new Set([
  'trigger',
  'http',
  'transform',
  'dom',
  'cookie',
  'delay',
  'fork',
  'loop',
  'popover',
  'note',
  'frame',
]);
const strings = [
  'event',
  'selector',
  'url',
  'method',
  'headers',
  'body',
  'dataPath',
  'migrationWarning',
  'responseDataPath',
  'action',
  'value',
  'valueSource',
  'valueDataPath',
  'attribute',
  'cookieName',
  'cookieValue',
  'condition',
  'conditionType',
  'conditionDataPath',
  'conditionOperator',
  'conditionKey',
  'conditionValue',
  'conditionStartDate',
  'conditionEndDate',
  'conditionStartTime',
  'conditionEndTime',
  'conditionTimeZone',
  'contentType',
  'content',
  'position',
  'noteText',
  'noteColor',
];
const numbers = [
  'cookieDays',
  'duration',
  'iterations',
  'width',
  'rageClickCount',
  'rageClickWindow',
  'rageClickRadius',
  'scrollDirectionChanges',
  'scrollThrashWindow',
  'scrollMinDistance',
  'scrollThreshold',
];
const booleans = ['legacyJsonOnly', 'noteBold', 'noteItalic', 'noteStrikethrough'];
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
/** Structural check for untrusted JSON; incomplete but editable configurations remain valid. */
export function isWorkflow(value: unknown): value is Workflow {
  if (
    !object(value) ||
    value.version !== 1 ||
    typeof value.name !== 'string' ||
    typeof value.websiteUrl !== 'string' ||
    (value.includeSubpages !== undefined && typeof value.includeSubpages !== 'boolean') ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  )
    return false;
  const nodeIds = new Set<string>();
  for (const node of value.nodes) {
    if (
      !object(node) ||
      typeof node.id !== 'string' ||
      nodeIds.has(node.id) ||
      node.type !== 'workflow' ||
      !object(node.position) ||
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y) ||
      !object(node.data) ||
      typeof node.data.kind !== 'string' ||
      !kinds.has(node.data.kind) ||
      typeof node.data.label !== 'string' ||
      !object(node.data.config)
    )
      return false;
    const config = node.data.config;
    if (
      strings.some((key) => config[key] !== undefined && typeof config[key] !== 'string') ||
      numbers.some(
        (key) =>
          config[key] !== undefined &&
          (typeof config[key] !== 'number' || !Number.isFinite(config[key])),
      ) ||
      booleans.some((key) => config[key] !== undefined && typeof config[key] !== 'boolean') ||
      (config.noteMarks !== undefined &&
        !isNoteMarks(config.noteMarks, ((config.noteText as string | undefined) ?? '').length)) ||
      (config.noteColor !== undefined &&
        config.noteColor !== 'transparent' &&
        !/^#[\da-f]{6}$/i.test(config.noteColor as string))
    )
      return false;
    if (config.transformations !== undefined) {
      try {
        dataTransformTools.validate(
          { transformations: config.transformations as DataTransformation[] },
          false,
          true,
        );
      } catch {
        return false;
      }
    }
    nodeIds.add(node.id);
  }
  for (const node of value.nodes) {
    if (node.parentId !== undefined) {
      const parent = value.nodes.find((entry) => entry.id === node.parentId);
      if (
        typeof node.parentId !== 'string' ||
        !parent ||
        parent.data.kind !== 'frame' ||
        node.data.kind === 'frame'
      )
        return false;
    }
    if (
      node.data.kind === 'frame' &&
      ['width', 'height'].some(
        (key) =>
          node[key] !== undefined &&
          (typeof node[key] !== 'number' || !Number.isFinite(node[key]) || node[key] <= 0),
      )
    )
      return false;
  }
  const edgeIds = new Set<string>();
  for (const edge of value.edges) {
    if (
      !object(edge) ||
      typeof edge.id !== 'string' ||
      edgeIds.has(edge.id) ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string' ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target) ||
      (edge.sourceHandle != null && typeof edge.sourceHandle !== 'string') ||
      (edge.label != null && typeof edge.label !== 'string') ||
      (edge.data !== undefined &&
        (!object(edge.data) ||
          (edge.data.mapping !== undefined && !isConnectionMapping(edge.data.mapping))))
    )
      return false;
    edgeIds.add(edge.id);
  }
  return true;
}
