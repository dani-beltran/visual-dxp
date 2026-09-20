import { describe, expect, it, vi } from 'vitest';
import { type ActivityEntry, createActivityStore } from '../src/lib/activity';

function entry(id: string, action = 'Added a delay') {
  return {
    id,
    username: 'Ada',
    action,
    timestamp: '2026-09-20T09:00:00.000Z',
  } satisfies ActivityEntry;
}

describe('activity store', () => {
  it('keeps snapshots stable between updates and preserves earlier snapshots', () => {
    const initial = [entry('first')];
    const store = createActivityStore(initial);
    const original = store.getSnapshot();
    expect(store.getSnapshot()).toBe(original);

    initial.push(entry('outside'));
    initial[0].action = 'Changed outside the store';
    expect(original).toEqual([entry('first')]);

    store.append(entry('second'));
    const updated = store.getSnapshot();
    expect(updated).not.toBe(original);
    expect(updated).toEqual([entry('first'), entry('second')]);
    expect(original).toEqual([entry('first')]);
    expect(store.getSnapshot()).toBe(updated);
  });

  it('notifies subscribers synchronously and stops notifying after unsubscribe', () => {
    const store = createActivityStore();
    const listener = vi.fn(() => store.getSnapshot());
    const unsubscribe = store.subscribe(listener);

    store.append(entry('first'));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.results[0].value).toEqual([entry('first')]);

    store.replaceEntries([entry('remote', 'Renamed the workflow')]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.results[1].value).toEqual([entry('remote', 'Renamed the workflow')]);

    unsubscribe();
    store.append(entry('second'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('upserts a server echo by ID instead of duplicating the local activity', () => {
    const store = createActivityStore([entry('shared')]);
    store.append(entry('shared', 'Added a confirmed delay'));
    expect(store.getSnapshot()).toEqual([entry('shared', 'Added a confirmed delay')]);

    const remote = [entry('replacement')];
    store.replaceEntries(remote);
    remote[0].username = 'Changed outside the store';
    expect(store.getSnapshot()).toEqual([entry('replacement')]);

    store.replaceEntries([]);
    expect(store.getSnapshot()).toEqual([]);
  });
});
