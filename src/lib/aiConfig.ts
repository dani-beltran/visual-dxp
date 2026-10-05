import { dataTools } from './data';
import { elementTriggerEvents, triggerOptions } from './triggers';
import type { NodeKind, StepConfig } from './types';

type ConfigField = keyof StepConfig;
interface ConfigPolicy {
  fields?: readonly ConfigField[];
  variants?: readonly {
    key: ConfigField;
    defaultValue: string;
    normalize?: (value: string) => string;
    options: Readonly<Record<string, ConfigPolicy>>;
  }[];
}

// Ownership applies to AI writes, not historical/imported configuration. Each
// variant describes a setting that changes which other fields the runtime uses.
const configPolicies: Record<NodeKind, ConfigPolicy> = {
  trigger: {
    variants: [
      {
        key: 'event',
        defaultValue: 'page-load',
        options: Object.fromEntries(
          Object.entries(triggerOptions).map(([event, { settings }]) => [
            event,
            {
              fields: [
                ...(elementTriggerEvents.includes(event as NonNullable<StepConfig['event']>)
                  ? ['selector' as const]
                  : []),
                ...settings.map(({ key }) => key),
              ],
            },
          ]),
        ),
      },
    ],
  },
  http: {
    fields: ['url', 'headers'],
    variants: [
      {
        key: 'method',
        defaultValue: 'GET',
        normalize: (value) => value.toUpperCase(),
        options: {
          GET: {},
          HEAD: {},
          POST: { fields: ['body'] },
          PUT: { fields: ['body'] },
          PATCH: { fields: ['body'] },
          DELETE: { fields: ['body'] },
          OPTIONS: { fields: ['body'] },
        },
      },
    ],
  },
  transform: { fields: ['dataPath', 'transformations'] },
  dom: {
    fields: ['selector'],
    variants: [
      {
        key: 'action',
        defaultValue: 'text',
        options: {
          text: { fields: ['value'] },
          html: { fields: ['value'] },
          'add-class': { fields: ['value'] },
          'remove-class': { fields: ['value'] },
          hide: {},
          show: {},
          attribute: { fields: ['value', 'attribute'] },
        },
      },
    ],
  },
  cookie: { fields: ['cookieName', 'cookieValue', 'cookieDays'] },
  delay: { fields: ['duration'] },
  experiment: {
    fields: ['experimentSplit', 'experimentKey'],
    variants: [
      {
        key: 'experimentAnalytics',
        defaultValue: 'none',
        options: {
          none: {},
          ga4: {
            fields: ['experimentId', 'experimentSelector', 'experimentInteraction'],
            variants: [
              {
                key: 'experimentDelivery',
                defaultValue: 'gtag',
                options: { gtag: { fields: ['experimentMeasurementId'] }, gtm: {} },
              },
            ],
          },
        },
      },
    ],
  },
  fork: {
    variants: [
      {
        key: 'conditionType',
        defaultValue: 'selector',
        options: {
          selector: { fields: ['condition'] },
          device: { fields: ['conditionValue'] },
          language: { fields: ['conditionValue'] },
          referrer: { fields: ['conditionValue'] },
          'query-param': { fields: ['conditionKey', 'conditionValue'] },
          cookie: { fields: ['conditionKey', 'conditionValue'] },
          'date-range': { fields: ['conditionStartDate', 'conditionEndDate', 'conditionTimeZone'] },
          'time-of-day': {
            fields: ['conditionStartTime', 'conditionEndTime', 'conditionTimeZone'],
          },
          data: {
            variants: [
              {
                key: 'conditionOperator',
                defaultValue: 'equal',
                options: Object.fromEntries(
                  Object.keys(dataTools.operators).map((operator) => [
                    operator,
                    { fields: dataTools.needsValue(operator) ? ['conditionValue'] : [] },
                  ]),
                ),
              },
            ],
          },
        },
      },
    ],
  },
  loop: { fields: ['iterations'] },
  popover: {
    fields: ['width'],
    variants: [
      {
        key: 'contentType',
        defaultValue: 'html',
        options: { html: { fields: ['content'] }, iframe: { fields: ['url'] } },
      },
      {
        key: 'position',
        defaultValue: 'bottom-right',
        options: {
          center: {},
          'top-left': {},
          'top-right': {},
          'bottom-left': {},
          'bottom-right': {},
          anchor: { fields: ['selector'] },
        },
      },
    ],
  },
  note: {
    fields: ['noteText', 'noteMarks', 'noteColor', 'noteBold', 'noteItalic', 'noteStrikethrough'],
  },
  frame: {},
};

function applicableConfig(kind: NodeKind, config: StepConfig) {
  const fields = new Set<ConfigField>();
  const modes: [ConfigField, string][] = [];
  function visit(policy: ConfigPolicy) {
    for (const field of policy.fields ?? []) fields.add(field);
    for (const variant of policy.variants ?? []) {
      fields.add(variant.key);
      const supplied = String(config[variant.key] ?? variant.defaultValue);
      const value = variant.normalize?.(supplied) ?? supplied;
      modes.push([variant.key, value]);
      // Existing invalid configurations remain editable. Value validation stays
      // with the workflow validator, which rejects newly introduced issues.
      if (Object.hasOwn(variant.options, value)) visit(variant.options[value]);
    }
  }
  visit(configPolicies[kind]);
  return { fields, modes };
}

export function validateAIConfigWrite(
  kind: NodeKind,
  patch: StepConfig,
  current: StepConfig = {},
): void {
  const { fields, modes } = applicableConfig(kind, { ...current, ...patch });
  const invalid = Object.keys(patch)
    .filter((key) => !fields.has(key as ConfigField))
    .sort();
  if (invalid.length) {
    const target = modes.length
      ? `${kind} (${modes.map(([key, value]) => `${key}=${value}`).join(', ')})`
      : kind;
    throw new Error(
      `Invalid configuration fields: ${invalid.join(', ')} for ${target}. Send only fields supported by the resulting configuration.`,
    );
  }
}

/** Catalog defaults must not supply inactive fields for the requested configuration. */
export function applicableAIConfigDefaults(
  kind: NodeKind,
  defaults: StepConfig,
  patch: StepConfig = {},
): StepConfig {
  const { fields } = applicableConfig(kind, { ...defaults, ...patch });
  return Object.fromEntries(
    Object.entries(defaults).filter(([key]) => fields.has(key as ConfigField)),
  );
}

/** Mode changes remove inactive fields; ordinary updates remain partial patches. */
export function configBeforeAIPatch(
  kind: NodeKind,
  current: StepConfig,
  patch: StepConfig = {},
): StepConfig {
  const before = applicableConfig(kind, current);
  const after = applicableConfig(kind, { ...current, ...patch });
  return JSON.stringify(before.modes) !== JSON.stringify(after.modes)
    ? applicableAIConfigDefaults(kind, current, patch)
    : current;
}
