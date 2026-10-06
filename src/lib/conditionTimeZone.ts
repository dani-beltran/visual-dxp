import type { StepConfig } from './types';

export function conditionTimeZoneLabel(config: StepConfig): string {
  if (config.conditionTimeZone !== 'offset') return config.conditionTimeZone || 'local';
  const offset = config.conditionTimeZoneOffset;
  if (typeof offset !== 'number' || !Number.isFinite(offset)) return 'UTC…';
  const minutes = Math.round(Math.abs(offset) * 60);
  return `UTC${offset < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
