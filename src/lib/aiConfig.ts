import { elementTriggerEvents, triggerOptions } from './triggers';
import type { NodeKind, StepConfig } from './types';

// Ownership applies to supplied AI writes, not historical/imported configuration.
const configFields = {
  trigger: ['event'], // Selector and settings belong to the effective event below.
  http: ['url', 'method', 'headers', 'body'],
  transform: ['dataPath', 'transformations'],
  dom: ['selector', 'action', 'value', 'attribute'],
  cookie: ['cookieName', 'cookieValue', 'cookieDays'],
  delay: ['duration'],
  experiment: [
    'experimentSplit',
    'experimentKey',
    'experimentAnalytics',
    'experimentId',
    'experimentSelector',
    'experimentInteraction',
    'experimentDelivery',
    'experimentMeasurementId',
  ],
  fork: [
    'conditionType',
    'conditionOperator',
    'condition',
    'conditionKey',
    'conditionValue',
    'conditionStartDate',
    'conditionEndDate',
    'conditionStartTime',
    'conditionEndTime',
    'conditionTimeZone',
  ],
  loop: ['iterations'],
  popover: ['contentType', 'content', 'position', 'width', 'selector'],
  note: ['noteText', 'noteMarks', 'noteColor', 'noteBold', 'noteItalic', 'noteStrikethrough'],
  frame: [],
} satisfies Record<NodeKind, readonly (keyof StepConfig)[]>;

function applicableFields(kind: NodeKind, config: StepConfig): readonly string[] {
  if (kind !== 'trigger') return configFields[kind];
  const event = config.event ?? 'page-load';
  if (!Object.hasOwn(triggerOptions, event)) throw new Error('Choose a supported trigger event.');
  return [
    ...configFields.trigger,
    ...(elementTriggerEvents.includes(event) ? ['selector'] : []),
    ...triggerOptions[event].settings.map(({ key }) => key),
  ];
}

export function validateAIConfigWrite(
  kind: NodeKind,
  patch: StepConfig,
  current: StepConfig = {},
): void {
  const fields = applicableFields(kind, { ...current, ...patch });
  const invalid = Object.keys(patch)
    .filter((key) => !fields.includes(key))
    .sort();
  if (invalid.length) {
    const target =
      kind === 'trigger' ? `trigger (${patch.event ?? current.event ?? 'page-load'})` : kind;
    throw new Error(
      `Invalid configuration fields: ${invalid.join(', ')} for ${target}. Send only fields belonging to this node kind/event.`,
    );
  }
}

/** Catalog defaults must not supply inactive fields for the requested trigger event. */
export function applicableAIConfigDefaults(
  kind: NodeKind,
  defaults: StepConfig,
  patch: StepConfig = {},
): StepConfig {
  const fields = applicableFields(kind, { ...defaults, ...patch });
  return Object.fromEntries(Object.entries(defaults).filter(([key]) => fields.includes(key)));
}

/** Only an explicit event change removes inactive configuration. Same-event writes stay patches. */
export function configBeforeAIPatch(
  kind: NodeKind,
  current: StepConfig,
  patch: StepConfig = {},
): StepConfig {
  return kind === 'trigger' &&
    patch.event !== undefined &&
    patch.event !== (current.event ?? 'page-load')
    ? applicableAIConfigDefaults(kind, current, patch)
    : current;
}
