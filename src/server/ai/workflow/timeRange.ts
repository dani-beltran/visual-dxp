import type { StepConfig } from './types';

/** Self-contained so validation and standalone workflow scripts use the same rules. */
export function getTimeRange(config: StepConfig): [number, number] {
  if (
    config.conditionTimeZone !== undefined &&
    config.conditionTimeZone !== 'local' &&
    config.conditionTimeZone !== 'utc'
  )
    throw new Error('Choose visitor local time or UTC for the time of day.');
  const minutes = (value: string | undefined, label: string): number => {
    if (
      typeof value !== 'string' ||
      value.length !== 5 ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    )
      throw new Error(`Choose a valid ${label} time (HH:MM, from 00:00 to 23:59).`);
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return [minutes(config.conditionStartTime, 'start'), minutes(config.conditionEndTime, 'end')];
}
