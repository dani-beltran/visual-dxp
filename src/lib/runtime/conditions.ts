import type { createDataTools } from '../data';
import type { getDateRange } from '../dateRange';
import type { getTimeRange } from '../timeRange';
import type { StepConfig } from '../types';
import type { getWeekdays } from '../weekdays';
import type { RuntimeContext } from './context';

interface ConditionModules {
  dataTools: ReturnType<typeof createDataTools>;
  getDateRange: typeof getDateRange;
  getTimeRange: typeof getTimeRange;
  getWeekdays: typeof getWeekdays;
}

export function matchesCondition(
  config: StepConfig,
  context: RuntimeContext,
  { getDateRange, getTimeRange, getWeekdays, dataTools }: ConditionModules,
): boolean {
  const { doc, win } = context;
  const type = config.conditionType ?? 'selector';
  if (type === 'data') return dataTools.evaluate(config, context.data);
  // Shift the timestamp, then read UTC components to avoid the host's time zone.
  const conditionNow = () =>
    new Date(
      Date.now() +
        (config.conditionTimeZone === 'offset' ? config.conditionTimeZoneOffset! * 3_600_000 : 0),
    );
  const useUTC = config.conditionTimeZone === 'utc' || config.conditionTimeZone === 'offset';
  if (type === 'weekdays') {
    const days = getWeekdays(config);
    const now = conditionNow();
    return days.includes(useUTC ? now.getUTCDay() : now.getDay());
  }
  if (type === 'time-of-day') {
    const [start, end] = getTimeRange(config);
    const now = conditionNow();
    const minutes = useUTC
      ? now.getUTCHours() * 60 + now.getUTCMinutes()
      : now.getHours() * 60 + now.getMinutes();
    return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
  }
  if (type === 'date-range') {
    const [start, end] = getDateRange(config);
    const now = conditionNow();
    const today = useUTC
      ? now.toISOString().slice(0, 10)
      : `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return today >= start && today <= end;
  }
  if (type === 'selector') {
    if (!config.condition?.trim())
      throw new Error('Enter a CSS selector for the branch condition.');
    return !!doc.querySelector(config.condition);
  }
  const expected = config.conditionValue;
  if (typeof expected !== 'string') throw new Error('Enter an expected condition value.');
  switch (type) {
    case 'device': {
      if (expected !== 'desktop' && expected !== 'mobile')
        throw new Error('Choose desktop or mobile for the device condition.');
      const navigator = win.navigator as Navigator & { userAgentData?: { mobile?: boolean } };
      const mobile =
        navigator.userAgentData?.mobile ??
        (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
          (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
      return expected === (mobile ? 'mobile' : 'desktop');
    }
    case 'language': {
      let language: string;
      try {
        language = Intl.getCanonicalLocales(expected.trim())[0]?.toLowerCase();
        if (!language) throw new Error();
      } catch {
        throw new Error('Enter a language code such as en, es, or en-US.');
      }
      const actual = win.navigator.language?.toLowerCase() ?? '';
      return actual === language || (!language.includes('-') && actual.startsWith(`${language}-`));
    }
    case 'referrer': {
      let domain: string;
      try {
        const value = expected.trim();
        const isUrl = /^https?:\/\//i.test(value);
        if (!value || (!isUrl && /[\s/\\?#@:]/.test(value))) throw new Error();
        // Accept saved URL conditions, comparing only their hostname.
        const parsed = new URL(isUrl ? value : `https://${value}`);
        domain = parsed.hostname.replace(/\.$/, '');
        if (
          parsed.username ||
          parsed.password ||
          !domain ||
          domain.length > 253 ||
          domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
        )
          throw new Error();
      } catch {
        throw new Error('Enter a valid referrer domain such as example.com.');
      }
      try {
        return !!doc.referrer && new URL(doc.referrer).hostname.replace(/\.$/, '') === domain;
      } catch {
        return false;
      }
    }
    case 'query-param':
    case 'cookie': {
      const key = config.conditionKey;
      if (!key?.trim()) throw new Error('Enter a name for the condition variable.');
      if (type === 'query-param') {
        try {
          const params =
            context.searchParams === undefined
              ? new URL(win.location.href).searchParams
              : new URLSearchParams(context.searchParams);
          return params.getAll(key).includes(expected);
        } catch {
          return false;
        }
      }
      // Access may be denied by browser privacy settings or an opaque preview origin.
      try {
        const decode = (value: string) => {
          try {
            return decodeURIComponent(value);
          } catch {
            return value;
          }
        };
        const cookieMatches = doc.cookie.split(';').some((entry) => {
          const cookie = entry.trim();
          const separator = cookie.indexOf('=');
          return (
            separator >= 0 &&
            decode(cookie.slice(0, separator)) === key &&
            decode(cookie.slice(separator + 1)) === expected
          );
        });
        if (cookieMatches) return true;
      } catch {
        // A blocked cookie read must not prevent a browser storage match.
      }
      for (const storage of ['localStorage', 'sessionStorage'] as const) {
        try {
          if (win[storage].getItem(key) === expected) return true;
        } catch {
          // Check each source independently when access to another is blocked.
        }
      }
      return false;
    }
    default:
      throw new Error('Choose a supported condition type.');
  }
}
