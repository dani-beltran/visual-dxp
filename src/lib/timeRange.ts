import type { StepConfig } from './types';

/** Self-contained so validation and standalone workflow scripts use the same rules. */
export function getTimeRange(config: StepConfig): [number, number] {
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
    throw Object.assign(
      new Error(
        'Choose visitor local time or UTC, or enter a fixed UTC offset, for the time of day.',
      ),
      {
        messageKey: 'errors.timeRange.chooseVisitorLocalTimeOrUtcForTheTimeOf',
        messageParams: {},
      },
    );
  const minutes = (value: string | undefined, label: string): number => {
    if (
      typeof value !== 'string' ||
      value.length !== 5 ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    )
      throw Object.assign(new Error(`Choose a valid ${label} time (HH:MM, from 00:00 to 23:59).`), {
        messageKey: 'errors.timeRange.chooseAValidLabelTimeHhMmFrom0000',
        messageParams: { label: String(label) },
      });
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return [minutes(config.conditionStartTime, 'start'), minutes(config.conditionEndTime, 'end')];
}
