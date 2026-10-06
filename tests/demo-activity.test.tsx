// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageActivityStore } from '../src/app/activityStore';
import EditorApp from '../src/app/EditorApp';
import type { ActivityEntry } from '../src/lib/activity';
import { commonDXPPresets } from '../src/presets';

const persistenceKey = 'visual-dxp-activity-v1';
const entry: ActivityEntry = {
  id: 'saved-action',
  username: 'Ada',
  action: 'Renamed the workflow',
  timestamp: '2026-09-20T09:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('editor activity persistence', () => {
  it('restores entries and persists additions, removals, and an empty history', () => {
    localStorage.setItem(persistenceKey, JSON.stringify([entry]));
    const store = createLocalStorageActivityStore(persistenceKey);
    expect(store.getSnapshot()).toEqual([entry]);

    const added = { ...entry, id: 'new-action', action: 'Added a delay' };
    store.append(added);
    expect(createLocalStorageActivityStore(persistenceKey).getSnapshot()).toEqual([entry, added]);
    store.remove(entry.id);
    expect(createLocalStorageActivityStore(persistenceKey).getSnapshot()).toEqual([added]);
    store.remove(added.id);
    expect(localStorage.getItem(persistenceKey)).toBe('[]');
    expect(createLocalStorageActivityStore(persistenceKey).getSnapshot()).toEqual([]);
  });

  it.each([
    null,
    '{invalid json',
    '{}',
    '[null]',
    JSON.stringify([{ ...entry, username: 123 }]),
    JSON.stringify([{ ...entry, timestamp: 'invalid' }]),
  ])('starts empty for missing or invalid history: %s', (saved) => {
    if (saved !== null) localStorage.setItem(persistenceKey, saved);
    const store = createLocalStorageActivityStore(persistenceKey);
    expect(store.getSnapshot()).toEqual([]);
    store.append(entry);
    expect(createLocalStorageActivityStore(persistenceKey).getSnapshot()).toEqual([entry]);
  });

  it('keeps activity and subscriptions working when storage access is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    });
    const store = createLocalStorageActivityStore(persistenceKey);
    const listener = vi.fn(() => store.getSnapshot());
    store.subscribe(listener);
    store.append(entry);
    expect(listener).toHaveReturnedWith([entry]);
    store.remove(entry.id);
    expect(listener).toHaveLastReturnedWith([]);
  });

  it('preserves in-memory changes when storage is full and saves them on the next update', () => {
    const store = createLocalStorageActivityStore(persistenceKey);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    store.append(entry);
    expect(store.getSnapshot()).toEqual([entry]);

    setItem.mockRestore();
    const next = { ...entry, id: 'next-action' };
    store.append(next);
    expect(createLocalStorageActivityStore(persistenceKey).getSnapshot()).toEqual([entry, next]);
  });

  it('keeps the editor activity after remounting and saves Undo and Redo changes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = () =>
      act(async () => {
        root.render(
          <StrictMode>
            <EditorApp />
          </StrictMode>,
        );
      });
    const click = async (selector: string) => {
      const button = host.querySelector<HTMLButtonElement>(selector);
      if (!button) throw new Error(`Missing button: ${selector}`);
      await act(async () => button.click());
    };
    const savedEntries = (): ActivityEntry[] =>
      JSON.parse(localStorage.getItem(persistenceKey) || '[]');

    try {
      await render();
      await click('button[role="tab"][id$="-presets-tab"]');
      expect(
        [...host.querySelectorAll('.dxp-preset-card h3')].map((card) => card.textContent),
      ).toEqual(commonDXPPresets.map((preset) => preset.name));
      expect(host.querySelector('.dxp-preset-setup')).toBeNull();
      await click('button[role="tab"][id$="-canvas-tab"]');
      await click('button[aria-label="Add Delay"]');
      const added = savedEntries();
      expect(added).toHaveLength(1);
      await click('button[title^="Undo"]');
      expect(savedEntries()).toEqual([]);
      await click('button[title^="Redo"]');
      expect(savedEntries()).toEqual(added);
      await act(async () => vi.advanceTimersByTime(600));

      await act(async () => root.render(null));
      await render();
      await click('button[role="tab"][id$="-activity-tab"]');
      expect(host.querySelector('.dxp-activity')?.textContent).toContain(added[0].action);
      expect(host.querySelector('time')?.dateTime).toBe(added[0].timestamp);
      expect(savedEntries()).toEqual(added);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
