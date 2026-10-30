export interface CapturedAnalyticsEvent {
  name: string;
  source: 'gtag' | 'dataLayer';
  timestamp: number;
  simulated: boolean;
  data: unknown;
  truncated?: boolean;
}

/** Self-contained: serialized alongside the standalone runtime modules. */
export function createAnalyticsCaptureTools(win: Window) {
  const MAX_EVENTS = 1000;

  function capture(
    name: unknown,
    source: CapturedAnalyticsEvent['source'],
    raw: unknown,
    simulated = false,
  ): CapturedAnalyticsEvent | undefined {
    if (typeof name !== 'string' || !name || name.length > 128) return;
    let valuesLeft = 10000;
    let charactersLeft = 512000;
    let truncated = false;
    const ancestors = new WeakSet<object>();
    const marker = (type: string, value?: string) => ({
      $type: type,
      ...(value === undefined ? {} : { value }),
    });
    function text(value: string): string {
      let length = Math.min(value.length, Math.max(0, charactersLeft));
      const cost = (size: number) => JSON.stringify(value.slice(0, size)).length - 2;
      // Account for JSON escapes so one event still fits the storage budget.
      if (cost(length) > charactersLeft) {
        let low = 0;
        let high = length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (cost(middle) <= charactersLeft) low = middle;
          else high = middle - 1;
        }
        length = low;
      }
      const result = value.slice(0, length);
      charactersLeft -= cost(length);
      if (result.length === value.length) return result;
      truncated = true;
      return `${result}[Truncated]`;
    }

    function copy(value: unknown, depth = 0): unknown {
      if (--valuesLeft < 0 || depth > 40) {
        truncated = true;
        return marker('Truncated');
      }
      if (value === null || typeof value === 'boolean') return value;
      if (typeof value === 'string') return text(value);
      if (typeof value === 'number')
        return Number.isFinite(value) ? value : marker('Number', String(value));
      if (typeof value === 'undefined') return marker('Undefined');
      if (typeof value === 'bigint') return marker('BigInt', text(String(value)));
      if (typeof value === 'symbol') return marker('Symbol', text(String(value)));
      if (typeof value === 'function') return marker('Function');
      if (typeof value !== 'object') return marker('Unknown');
      if (ancestors.has(value)) return marker('Circular');
      ancestors.add(value);
      try {
        if (value === win) return marker('Window');
        const host = win as Window & typeof globalThis;
        if (typeof host.Element === 'function' && value instanceof host.Element)
          return marker('Element', text(value.outerHTML));
        if (
          value instanceof Date ||
          (typeof host.Date === 'function' && value instanceof host.Date)
        ) {
          const time = Date.prototype.getTime.call(value);
          return marker(
            'Date',
            Number.isFinite(time) ? Date.prototype.toISOString.call(value) : 'Invalid Date',
          );
        }
        if (value instanceof Map || (typeof host.Map === 'function' && value instanceof host.Map)) {
          const entries: unknown[] = [];
          for (const [key, item] of Map.prototype.entries.call(value)) {
            if (valuesLeft <= 0) {
              truncated = true;
              break;
            }
            entries.push([copy(key, depth + 1), copy(item, depth + 1)]);
          }
          return { $type: 'Map', entries };
        }
        if (value instanceof Set || (typeof host.Set === 'function' && value instanceof host.Set)) {
          const items: unknown[] = [];
          for (const item of Set.prototype.values.call(value)) {
            if (valuesLeft <= 0) {
              truncated = true;
              break;
            }
            items.push(copy(item, depth + 1));
          }
          return { $type: 'Set', values: items };
        }
        const descriptors = Object.getOwnPropertyDescriptors(value);
        if (
          Array.isArray(value) ||
          (!(Symbol.toStringTag in value) &&
            Object.prototype.toString.call(value) === '[object Arguments]')
        ) {
          const length = Math.min(Number(descriptors.length?.value) || 0, Math.max(0, valuesLeft));
          if (length < Number(descriptors.length?.value)) truncated = true;
          return Array.from({ length }, (_, index) => {
            const property = descriptors[String(index)];
            return property && !('value' in property)
              ? marker('Accessor')
              : copy(property?.value, depth + 1);
          });
        }
        const result: Record<string, unknown> = Object.create(null);
        // Browser events expose their useful fields through native prototype
        // getters. Read those explicitly, without evaluating payload accessors.
        for (const eventClass of [
          host.Event,
          host.CustomEvent,
          host.UIEvent,
          host.MouseEvent,
          host.KeyboardEvent,
          host.PointerEvent,
          host.InputEvent,
        ]) {
          if (typeof eventClass !== 'function' || !(value instanceof eventClass)) continue;
          result.$type = 'Event';
          for (const [key, property] of Object.entries(
            Object.getOwnPropertyDescriptors(eventClass.prototype),
          )) {
            if (!property.get) continue;
            if (valuesLeft <= 0 || charactersLeft <= 0) {
              truncated = true;
              break;
            }
            try {
              result[key] = copy(property.get.call(value), depth + 1);
            } catch {
              result[key] = marker('Unserializable');
            }
          }
        }
        for (const [key, property] of Object.entries(descriptors)) {
          if (valuesLeft <= 0 || charactersLeft <= 0) {
            truncated = true;
            break;
          }
          result[text(key)] =
            'value' in property ? copy(property.value, depth + 1) : marker('Accessor');
        }
        return result;
      } catch {
        return marker('Unserializable');
      } finally {
        ancestors.delete(value);
      }
    }
    const data = copy(raw);
    return {
      name,
      source,
      timestamp: Date.now(),
      simulated,
      data,
      ...(truncated ? { truncated: true } : {}),
    };
  }

  function store(storageKey: string, event: CapturedAnalyticsEvent): void {
    try {
      const storage = win.sessionStorage;
      const raw = storage.getItem(storageKey);
      let events: CapturedAnalyticsEvent[] = [];
      try {
        const saved = raw && raw.length <= 2000000 ? JSON.parse(raw) : undefined;
        // Aggregates (schema 1) cannot be reconstructed as raw events.
        if (saved?.version === 2 && Array.isArray(saved.events))
          events = saved.events
            .filter(
              (item: CapturedAnalyticsEvent) =>
                item &&
                typeof item.name === 'string' &&
                Number.isFinite(item.timestamp) &&
                (item.source === 'gtag' || item.source === 'dataLayer') &&
                typeof item.simulated === 'boolean' &&
                Object.hasOwn(item, 'data'),
            )
            .slice(1 - MAX_EVENTS); // Keep the most recent events.
      } catch {
        /* Replace corrupt or incompatible storage. */
      }
      events.push(event);
      let encoded = JSON.stringify({ version: 2, updatedAt: event.timestamp, events });
      while (encoded.length > 2000000 && events.length > 1) {
        events.shift();
        encoded = JSON.stringify({ version: 2, updatedAt: event.timestamp, events });
      }
      if (encoded.length > 2000000) return;
      for (;;) {
        try {
          storage.setItem(storageKey, encoded);
          return;
        } catch (error) {
          if (
            events.length <= 1 ||
            !error ||
            typeof error !== 'object' ||
            !('name' in error) ||
            error.name !== 'QuotaExceededError'
          )
            return;
          events = events.slice(Math.floor(events.length / 2));
          encoded = JSON.stringify({ version: 2, updatedAt: event.timestamp, events });
        }
      }
    } catch {
      /* Storage denial must never affect analytics delivery. */
    }
  }
  return { capture, store };
}
