import type { StepConfig, TriggerEvent } from './types';

type TriggerSettingKey =
  | 'rageClickCount'
  | 'rageClickWindow'
  | 'rageClickRadius'
  | 'duration'
  | 'scrollDirectionChanges'
  | 'scrollThrashWindow'
  | 'scrollMinDistance'
  | 'scrollThreshold';

interface TriggerSetting {
  key: TriggerSettingKey;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}

export const elementTriggerEvents: readonly TriggerEvent[] = [
  'click',
  'mouseover',
  'submit',
  'change',
];

export const triggerOptions: Record<
  TriggerEvent,
  { label: string; hint: string; settings: TriggerSetting[] }
> = {
  'page-load': {
    label: 'The page loads',
    hint: 'This workflow starts once the page is ready.',
    settings: [],
  },
  click: {
    label: 'An element is clicked',
    hint: 'Starts each time a visitor clicks the selected element or anything inside it.',
    settings: [],
  },
  mouseover: {
    label: 'An element is hovered',
    hint: 'Starts each time the pointer moves onto the selected element or one of its child elements. Moving between child elements can trigger it again.',
    settings: [],
  },
  submit: {
    label: 'A form is submitted',
    hint: 'Starts each time the selected form is submitted. Choose the form as the target element.',
    settings: [],
  },
  change: {
    label: 'An input changes',
    hint: 'Starts when a visitor commits a change to the selected field, such as choosing an option, toggling a checkbox, or leaving a text field after editing it.',
    settings: [],
  },
  'exit-intent': {
    label: 'Exit intention',
    hint: 'Starts once when the mouse leaves through the top of the page, toward the browser controls. For visitors using a mouse.',
    settings: [],
  },
  'rage-click': {
    label: 'Rage clicking',
    hint: 'Detects rapid clicks in the same area anywhere on the page. Each matching group of clicks starts the workflow.',
    settings: [
      { key: 'rageClickCount', label: 'Click count', defaultValue: 3, min: 2, max: 100 },
      {
        key: 'rageClickWindow',
        label: 'Click time window (ms)',
        defaultValue: 1000,
        min: 100,
        max: 60000,
      },
      { key: 'rageClickRadius', label: 'Click radius (px)', defaultValue: 50, min: 1, max: 1000 },
    ],
  },
  inactivity: {
    label: 'Inactivity',
    hint: 'Starts after no pointer, keyboard, touch, or scroll activity. Runs once per idle period and resets when activity resumes. Pauses in hidden tabs.',
    settings: [
      {
        key: 'duration',
        label: 'Inactivity duration (ms)',
        defaultValue: 30000,
        min: 1000,
        max: 86400000,
      },
    ],
  },
  'scroll-thrashing': {
    label: 'Scroll thrashing',
    hint: 'Detects rapid up/down direction changes while scrolling the page. Small movements are ignored. Each matching group starts the workflow.',
    settings: [
      {
        key: 'scrollDirectionChanges',
        label: 'Direction changes',
        defaultValue: 4,
        min: 2,
        max: 100,
      },
      {
        key: 'scrollThrashWindow',
        label: 'Scroll time window (ms)',
        defaultValue: 2000,
        min: 100,
        max: 60000,
      },
      {
        key: 'scrollMinDistance',
        label: 'Minimum scroll travel (px)',
        defaultValue: 50,
        min: 1,
        max: 1000,
      },
    ],
  },
  'scroll-depth': {
    label: 'Scroll down threshold',
    hint: 'Starts once when the visitor scrolls down to this percentage of the page’s scrollable distance. 100% means the bottom of the page.',
    settings: [
      { key: 'scrollThreshold', label: 'Scroll threshold (%)', defaultValue: 75, min: 1, max: 100 },
    ],
  },
};

export function validateTriggerConfig(config: StepConfig): string[] {
  const event = config.event ?? 'page-load';
  if (!Object.hasOwn(triggerOptions, event)) return ['Choose a supported trigger event.'];
  return triggerOptions[event].settings.flatMap(({ key, label, min, max }) => {
    const value = config[key];
    return value !== undefined && (!Number.isInteger(value) || value < min || value > max)
      ? [`${label} must be a whole number between ${min} and ${max}.`]
      : [];
  });
}
