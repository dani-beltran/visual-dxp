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
  if (
    config.conditionTimeZone === 'offset' &&
    (typeof config.conditionTimeZoneOffset !== 'number' ||
      !Number.isFinite(config.conditionTimeZoneOffset) ||
      config.conditionTimeZoneOffset < -12 ||
      config.conditionTimeZoneOffset > 14 ||
      !Number.isInteger(config.conditionTimeZoneOffset))
  )
    throw new Error('Enter a whole-hour UTC offset from -12 to +14.');
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
    config.conditionTimeZone !== 'utc' &&
    config.conditionTimeZone !== 'offset'
  )
    throw new Error('Choose visitor local time or UTC, or enter a fixed UTC offset, for weekdays.');
  return days;
}
