import { type ActivityEntry, createActivityStore } from '../lib/activity';

function isActivityEntry(value: unknown): value is ActivityEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ActivityEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.username === 'string' &&
    typeof entry.action === 'string' &&
    typeof entry.timestamp === 'string' &&
    Number.isFinite(Date.parse(entry.timestamp))
  );
}

/** Application persistence; embedded builders still use the host's activity store. */
export function createLocalStorageActivityStore(persistenceKey: string) {
  let entries: ActivityEntry[] = [];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(persistenceKey) || 'null');
    if (Array.isArray(saved) && saved.every(isActivityEntry)) entries = saved;
  } catch {
    // Start with an empty history if storage is unavailable or invalid.
  }

  const store = createActivityStore(entries);
  store.subscribe(() => {
    try {
      localStorage.setItem(persistenceKey, JSON.stringify(store.getSnapshot()));
    } catch {
      // Keep activity usable in memory if browser storage is unavailable or full.
    }
  });
  return store;
}
