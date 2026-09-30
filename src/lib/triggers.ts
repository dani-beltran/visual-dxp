import { type BuilderTranslator, translateEnglish } from './i18n';
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
  'zoom-in',
  'swipe',
];

export function getTriggerOptions(t: BuilderTranslator = translateEnglish) {
  const triggerOptions: Record<
    TriggerEvent,
    { label: string; hint: string; settings: TriggerSetting[] }
  > = {
    'page-load': {
      label: t('triggers.thePageLoads'),
      hint: t('triggers.thisWorkflowStartsOnceThePageIsReady'),
      settings: [],
    },
    click: {
      label: t('triggers.anElementIsClicked'),
      hint: t('triggers.startsEachTimeAVisitorClicksTheSelectedElementOr'),
      settings: [],
    },
    mouseover: {
      label: t('triggers.anElementIsHovered'),
      hint: t('triggers.startsEachTimeThePointerMovesOntoTheSelectedElement'),
      settings: [],
    },
    submit: {
      label: t('triggers.aFormIsSubmitted'),
      hint: t('triggers.startsEachTimeTheSelectedFormIsSubmittedChooseThe'),
      settings: [],
    },
    change: {
      label: t('triggers.anInputChanges'),
      hint: t('triggers.startsWhenAVisitorCommitsAChangeToTheSelected'),
      settings: [],
    },
    'zoom-in': {
      label: t('triggers.anElementIsZoomedInto'),
      hint: t('triggers.startsOncePerPinchOrCtrlWheelZoomInGesture'),
      settings: [],
    },
    swipe: {
      label: t('triggers.anElementIsSwiped'),
      hint: t('triggers.startsOnceWhenAFingerOrPenSwipeBeginsOn'),
      settings: [],
    },
    'exit-intent': {
      label: t('triggers.exitIntention'),
      hint: t('triggers.startsOnceWhenTheMouseLeavesThroughTheTopOf'),
      settings: [],
    },
    'rage-click': {
      label: t('triggers.rageClicking'),
      hint: t('triggers.detectsRapidClicksInTheSameAreaAnywhereOnThe'),
      settings: [
        {
          key: 'rageClickCount',
          label: t('triggers.clickCount'),
          defaultValue: 3,
          min: 2,
          max: 100,
        },
        {
          key: 'rageClickWindow',
          label: t('triggers.clickTimeWindowMs'),
          defaultValue: 1000,
          min: 100,
          max: 60000,
        },
        {
          key: 'rageClickRadius',
          label: t('triggers.clickRadiusPx'),
          defaultValue: 50,
          min: 1,
          max: 1000,
        },
      ],
    },
    inactivity: {
      label: t('triggers.inactivity'),
      hint: t('triggers.startsAfterNoPointerKeyboardTouchOrScrollActivityRuns'),
      settings: [
        {
          key: 'duration',
          label: t('triggers.inactivityDurationMs'),
          defaultValue: 30000,
          min: 1000,
          max: 86400000,
        },
      ],
    },
    'scroll-thrashing': {
      label: t('triggers.scrollThrashing'),
      hint: t('triggers.detectsRapidUpDownDirectionChangesWhileScrollingThePage'),
      settings: [
        {
          key: 'scrollDirectionChanges',
          label: t('triggers.directionChanges'),
          defaultValue: 4,
          min: 2,
          max: 100,
        },
        {
          key: 'scrollThrashWindow',
          label: t('triggers.scrollTimeWindowMs'),
          defaultValue: 2000,
          min: 100,
          max: 60000,
        },
        {
          key: 'scrollMinDistance',
          label: t('triggers.minimumScrollTravelPx'),
          defaultValue: 50,
          min: 1,
          max: 1000,
        },
      ],
    },
    'scroll-depth': {
      label: t('triggers.scrollDownThreshold'),
      hint: t('triggers.startsOnceWhenTheVisitorScrollsDownToThisPercentage'),
      settings: [
        {
          key: 'scrollThreshold',
          label: t('triggers.scrollThreshold'),
          defaultValue: 75,
          min: 1,
          max: 100,
        },
      ],
    },
  };

  return triggerOptions;
}
export const triggerOptions = getTriggerOptions();

export function validateTriggerConfig(
  config: StepConfig,
  t: BuilderTranslator = translateEnglish,
): string[] {
  const triggerOptions = getTriggerOptions(t);
  const event = config.event ?? 'page-load';
  if (!Object.hasOwn(triggerOptions, event)) return [t('validation.unsupportedTrigger')];
  return triggerOptions[event].settings.flatMap(({ key, label, min, max }) => {
    const value = config[key];
    return value !== undefined && (!Number.isInteger(value) || value < min || value > max)
      ? [t('validation.triggerRange', { label, min, max })]
      : [];
  });
}
