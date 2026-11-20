import type { PopoverSettings, StepConfig, TourStep } from './types';

/** Config fields that describe one popover. A Tour step stores exactly these fields. */
export const popoverSettingKeys = [
  'contentType',
  'content',
  'url',
  'position',
  'selector',
  'width',
  'popoverAnimation',
] as const satisfies readonly (keyof PopoverSettings)[];

/**
 * Labels visitors see when a Tour omits its own. The runtime repeats these literals because its
 * modules are serialized into exported scripts and cannot import shared constants; a test keeps
 * both in sync.
 */
export const tourButtonDefaults = { next: 'Next', previous: 'Previous', done: 'Done' } as const;

/** Structural check for untrusted JSON. Value ranges are reported by workflow validation. */
export function isTourStep(value: unknown): value is TourStep {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const step = value as Record<string, unknown>;
  return Object.entries(step).every(([key, field]) =>
    key === 'width'
      ? field === undefined || (typeof field === 'number' && Number.isFinite(field))
      : (popoverSettingKeys as readonly string[]).includes(key) &&
        (field === undefined || typeof field === 'string'),
  );
}

export function isTourSteps(value: unknown): value is TourStep[] {
  return Array.isArray(value) && value.every(isTourStep);
}

export function getTourSteps(config: Pick<StepConfig, 'tourSteps'>): TourStep[] {
  return Array.isArray(config.tourSteps) ? config.tourSteps : [];
}

/** A new step keeps the appearance of the step it follows, so a tour stays visually consistent. */
export function createTourStep(previous?: TourStep): TourStep {
  return {
    contentType: 'html',
    content:
      '<h3 style="margin:0 0 8px">New step</h3><p style="margin:0;line-height:1.5">Describe this part of the page.</p>',
    position: previous?.position === 'anchor' ? 'center' : (previous?.position ?? 'center'),
    width: previous?.width ?? 360,
    popoverAnimation: previous?.popoverAnimation ?? 'fade',
  };
}
