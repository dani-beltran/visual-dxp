// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityPanel } from '../src/components/ActivityPanel/ActivityPanel';
import type { ActivityEntry } from '../src/lib/activity';

function entry(id: string, timestamp: string): ActivityEntry {
  return Object.freeze({ id, username: 'Ada', action: id, timestamp });
}

function renderPanel(entries: readonly ActivityEntry[]) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<ActivityPanel entries={entries} />);
  return host;
}

describe('activity panel ordering', () => {
  it('shows the last appended entry first when timestamps match without changing the snapshot', () => {
    const sameTime = '2026-09-20T10:00:00.000Z';
    const entries = Object.freeze([
      entry('First action', sameTime),
      entry('Older action', '2026-09-19T10:00:00.000Z'),
      entry('Last action', sameTime),
    ]);
    const host = renderPanel(entries);

    expect([...host.querySelectorAll('li p')].map((action) => action.textContent)).toEqual([
      'Last action',
      'First action',
      'Older action',
    ]);
    expect(entries.map((item) => item.id)).toEqual(['First action', 'Older action', 'Last action']);
  });

  it('groups invalid timestamps after valid dates and renders a readable fallback', () => {
    const oldest = '1969-12-31T10:00:00.000Z';
    const latest = '2026-09-20T10:00:00.000Z';
    const host = renderPanel([
      entry('First unknown', 'invalid'),
      entry('Old action', oldest),
      entry('Recent action', latest),
      entry('Last unknown', ''),
    ]);

    expect([...host.querySelectorAll('li p')].map((action) => action.textContent)).toEqual([
      'Recent action',
      'Old action',
      'Last unknown',
      'First unknown',
    ]);
    expect([...host.querySelectorAll('time')].map((time) => time.getAttribute('datetime'))).toEqual(
      [latest, oldest],
    );
    const unknownGroup = host.querySelector('ol[aria-label="Unknown date"]');
    expect(unknownGroup).not.toBeNull();
    expect(unknownGroup?.textContent?.match(/Unknown time/g)).toHaveLength(2);
    expect(unknownGroup?.querySelector('time')).toBeNull();
  });
});
