import type { StepConfig } from './types';

/** Calendar date validation shared by server workflow tools and AI edits. */
export function getDateRange(config: StepConfig): [string, string] {
  if (
    config.conditionTimeZone === 'offset' &&
    (typeof config.conditionTimeZoneOffset !== 'number' ||
      !Number.isFinite(config.conditionTimeZoneOffset) ||
      config.conditionTimeZoneOffset < -12 ||
      config.conditionTimeZoneOffset > 14 ||
      !Number.isInteger(config.conditionTimeZoneOffset))
  )
    throw new Error('Enter a whole-hour UTC offset from -12 to +14.');
  if (
    config.conditionTimeZone !== undefined &&
    config.conditionTimeZone !== 'local' &&
    config.conditionTimeZone !== 'utc' &&
    config.conditionTimeZone !== 'offset'
  )
    throw new Error(
      'Choose visitor local time or UTC, or enter a fixed UTC offset, for the date range.',
    );
  const date = (value: string | undefined, label: string): string => {
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !value.startsWith('0000')
    ) {
      // Parse only for validation; matching uses calendar dates in the selected time zone.
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value)
        return value;
    }
    throw new Error(`Choose a valid ${label} date (YYYY-MM-DD).`);
  };
  const start = date(config.conditionStartDate, 'start');
  const end = date(config.conditionEndDate, 'end');
  if (end < start) throw new Error('End date must be on or after the start date.');
  return [start, end];
}
