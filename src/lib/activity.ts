import {
  type BuilderMessageArgs,
  type BuilderMessageKey,
  type BuilderTranslator,
  translateEnglish,
} from './i18n';

export type ActivityMessageKey = Extract<BuilderMessageKey, `activity.${string}`>;
export type ActivityMessage = {
  [K in ActivityMessageKey]: { key: K; params: BuilderMessageArgs<K>[0] };
}[ActivityMessageKey];
export interface ActivityAction {
  /** English snapshot for storage/search and host-authored activity. */
  readonly action: string;
  /** Builder-generated activity is formatted in the viewer's language at render time. */
  readonly message?: ActivityMessage;
}
export function activityAction<K extends ActivityMessageKey>(
  key: K,
  ...args: BuilderMessageArgs<K>
): ActivityAction {
  return {
    action: translateEnglish(key, ...args),
    message: { key, params: args[0] } as ActivityMessage,
  };
}
export function formatActivity(entry: ActivityAction, t: BuilderTranslator): string {
  if (!entry.message) return entry.action;
  const { key, params } = entry.message;
  // The discriminated union guarantees that params belong to this key.
  return (t as (key: ActivityMessageKey, params: ActivityMessage['params']) => string)(key, params);
}

export interface ActivityEntry extends ActivityAction {
  readonly id: string;
  readonly username: string;
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
      Array.from(
        new Map(
          entries.map((entry) => [
            entry.id,
            Object.freeze({
              ...entry,
              ...(entry.message
                ? {
                    message: Object.freeze({
                      ...entry.message,
                      params: Object.freeze({ ...entry.message.params }),
                    }) as ActivityMessage,
                  }
                : {}),
            }),
          ]),
        ).values(),
      ),
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
