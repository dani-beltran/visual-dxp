import type { StepConfig } from './types';

/** Keep this self-contained: it is also serialized into exported workflow scripts. */
export function getDateRange(config: StepConfig): [string, string] {
  if (
    config.conditionTimeZone !== undefined &&
    config.conditionTimeZone !== 'local' &&
    config.conditionTimeZone !== 'utc'
  )
    throw Object.assign(new Error('Choose visitor local time or UTC for the date range.'), {
      messageKey: 'errors.dateRange.chooseVisitorLocalTimeOrUtcForTheDateRange',
      messageParams: {},
    });
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
    throw Object.assign(new Error(`Choose a valid ${label} date (YYYY-MM-DD).`), {
      messageKey: 'errors.dateRange.chooseAValidLabelDateYyyyMmDd',
      messageParams: { label: String(label) },
    });
  };
  const start = date(config.conditionStartDate, 'start');
  const end = date(config.conditionEndDate, 'end');
  if (end < start)
    throw Object.assign(new Error('End date must be on or after the start date.'), {
      messageKey: 'errors.dateRange.endDateMustBeOnOrAfterTheStartDate',
      messageParams: {},
    });
  return [start, end];
}
