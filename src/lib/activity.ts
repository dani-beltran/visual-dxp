export interface ActivityEntry {
  readonly id: string;
  readonly username: string;
  readonly action: string;
  /** ISO 8601 timestamp, including a timezone. */
  readonly timestamp: string;
}

export interface ActivityStore {
  /** Return the same immutable snapshot until entries change. */
  getSnapshot: () => readonly ActivityEntry[];
  subscribe: (listener: () => void) => () => void;
  /** Update the local snapshot synchronously; the host can persist it asynchronously. */
  append: (entry: ActivityEntry) => void;
  /** Remove the reverted action locally; the host can synchronize its deletion. */
  remove: (id: string) => void;
}

/** In-memory store for demos, or as the local cache of a server-backed adapter. */
export function createActivityStore(
  initialEntries: readonly ActivityEntry[] = [],
): ActivityStore & {
  replaceEntries: (entries: readonly ActivityEntry[]) => void;
} {
  const snapshot = (entries: readonly ActivityEntry[]) =>
    Object.freeze(
      Array.from(new Map(entries.map((entry) => [entry.id, Object.freeze({ ...entry })])).values()),
    );
  let entries = snapshot(initialEntries);
  const listeners = new Set<() => void>();
  const replaceEntries = (next: readonly ActivityEntry[]) => {
    entries = snapshot(next);
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => entries,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    append: (entry) => replaceEntries([...entries, entry]),
    remove: (id) => {
      if (entries.some((entry) => entry.id === id))
        replaceEntries(entries.filter((entry) => entry.id !== id));
    },
    replaceEntries,
  };
}
