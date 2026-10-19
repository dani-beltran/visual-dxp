import { RecoverableToolError } from './aiToolErrors';
import { dataTools } from './data';
import { elementTriggerEvents, triggerOptions } from './triggers';
import type { NodeKind, StepConfig } from './types';

type ConfigField = keyof StepConfig;
interface ConfigPolicy {
  /** Accepted only for historical operation replay, never advertised for new tool calls. */
  legacy?: ConfigPolicy;
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
    fields: ['selector', 'changes'],
    variants: [
      {
        key: 'action',
        defaultValue: 'text',
        options: {
          text: { fields: ['value', 'textPath'] },
          html: { fields: ['value'] },
          'add-class': { fields: ['value'] },
          'remove-class': { fields: ['value'] },
          hide: {},
          show: {},
          attribute: { fields: ['value', 'attribute'] },
          'replace-image': { fields: ['value', 'imageAlt'] },
        },
      },
    ],
  },
  'track-event': { fields: ['analyticsEventName', 'analyticsPayload'] },
  cookie: { fields: ['cookieName', 'cookieValue', 'cookieDays'] },
  delay: { fields: ['duration'] },
  experiment: {
    fields: ['experimentSplit', 'experimentKey'],
    legacy: {
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
                  options: {
                    gtag: { fields: ['experimentMeasurementId'] },
                    gtm: {},
                  },
                },
              ],
            },
          },
        },
      ],
    },
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
          'date-range': {
            fields: [
              'conditionStartDate',
              'conditionEndDate',
              'conditionTimeZone',
              'conditionTimeZoneOffset',
            ],
          },
          weekdays: {
            fields: ['conditionWeekdays', 'conditionTimeZone', 'conditionTimeZoneOffset'],
          },
          'time-of-day': {
            fields: [
              'conditionStartTime',
              'conditionEndTime',
              'conditionTimeZone',
              'conditionTimeZoneOffset',
            ],
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

function applicableConfig(kind: NodeKind, config: StepConfig, includeLegacy = true) {
  const fields = new Set<ConfigField>();
  const modes: [ConfigField, string][] = [];
  function visit(policy: ConfigPolicy) {
    if (includeLegacy && policy.legacy) visit(policy.legacy);
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

/** Describe fields and mode transitions using the same policy as AI write validation. */
export function aiConfigCapabilities(kind: NodeKind, config: StepConfig = {}) {
  const { fields, modes } = applicableConfig(kind, config, false);
  function describe(policy: ConfigPolicy): {
    fields: readonly ConfigField[];
    variants: {
      key: ConfigField;
      defaultValue: string;
      options: Record<string, ReturnType<typeof describe>>;
    }[];
  } {
    return {
      fields: policy.fields ?? [],
      variants: (policy.variants ?? []).map(({ key, defaultValue, options }) => ({
        key,
        defaultValue,
        options: Object.fromEntries(
          Object.entries(options).map(([value, option]) => [value, describe(option)]),
        ),
      })),
    };
  }
  return {
    kind,
    applicableFields: [...fields].sort(),
    modes: Object.fromEntries(modes),
    policy: describe(configPolicies[kind]),
    updateRule:
      kind === 'dom' && config.changes !== undefined
        ? 'Update the complete changes list, preserving unrelated entries. Do not patch legacy single-change fields.'
        : 'Send a partial patch with only requested fields. Fields depend on the resulting modes; include fields required by a mode change.',
  };
}

export const aiAnalyticsAuthoring = {
  path: 'workflow.analytics',
  instruction:
    'Configure shared analytics in the Analytics tab. These tools cannot edit workflow.analytics. Use track-event nodes for milestones; do not configure analytics delivery on individual nodes.',
};

export function validateAIConfigWrite(
  kind: NodeKind,
  patch: StepConfig,
  current: StepConfig = {},
): void {
  if (
    kind === 'dom' &&
    current.changes !== undefined &&
    patch.changes === undefined &&
    ['selector', 'action', 'value', 'attribute', 'imageAlt', 'textPath'].some((key) =>
      Object.hasOwn(patch, key),
    )
  ) {
    throw new RecoverableToolError(
      'invalid_configuration',
      'This Customize Page node stores config.changes. Update the complete changes list while preserving unrelated edits.',
      {
        ...aiConfigCapabilities(kind, current),
        currentConfig: current,
        invalidFields: Object.keys(patch)
          .filter((key) => key !== 'changes')
          .sort(),
        repairHint:
          'Submit a changed patch containing the complete changes list, preserving unrelated edits.',
      },
    );
  }
  const { fields } = applicableConfig(kind, { ...current, ...patch });
  const invalid = Object.keys(patch)
    .filter((key) => !fields.has(key as ConfigField))
    .sort();
  if (invalid.length) {
    const capabilities = aiConfigCapabilities(kind, { ...current, ...patch });
    const modes = Object.entries(capabilities.modes);
    const target = modes.length
      ? `${kind} (${modes.map(([key, value]) => `${key}=${value}`).join(', ')})`
      : kind;
    throw new RecoverableToolError(
      'invalid_configuration',
      `Invalid configuration fields: ${invalid.join(', ')} for ${target}. Send only fields supported by the resulting configuration.`,
      {
        ...capabilities,
        currentConfig: current,
        invalidFields: invalid,
        repairHint:
          'Remove invalidFields and submit a changed partial patch for this target using applicableFields and the resulting modes. Preserve unrelated configuration.',
      },
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
  if (
    kind === 'dom' &&
    patch.changes === undefined &&
    ['selector', 'action', 'value', 'attribute', 'imageAlt'].some((key) =>
      Object.hasOwn(patch, key),
    )
  )
    fields.delete('changes');
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
