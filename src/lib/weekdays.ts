import type { StepConfig } from './types';

export const weekdays = [
  { value: 1, name: 'monday' },
  { value: 2, name: 'tuesday' },
  { value: 3, name: 'wednesday' },
  { value: 4, name: 'thursday' },
  { value: 5, name: 'friday' },
  { value: 6, name: 'saturday' },
  { value: 0, name: 'sunday' },
] as const;

/** Self-contained for standalone workflow exports. */
export function getWeekdays(config: StepConfig): number[] {
  const days = config.conditionWeekdays;
  if (
    !Array.isArray(days) ||
    days.length === 0 ||
    days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new Error('Select at least one valid weekday.');
  if (
    config.conditionTimeZone !== undefined &&
    config.conditionTimeZone !== 'local' &&
    config.conditionTimeZone !== 'utc'
  )
    throw new Error('Choose visitor local time or UTC for weekdays.');
  return days;
}
