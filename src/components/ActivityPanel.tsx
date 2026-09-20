import { Clock3, History } from 'lucide-react';
import { useId } from 'react';
import type { ActivityEntry } from '../lib/activity';
import '../styles/activity.css';

export interface ActivityPanelProps {
  entries: readonly ActivityEntry[];
}

function calendarDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function initials(username: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase();
}

function avatarColor(username: string) {
  let hash = 0;
  for (const character of username) hash = (hash + (character.codePointAt(0) ?? 0)) % 4;
  return hash;
}

export function ActivityPanel({ entries }: ActivityPanelProps) {
  const headingId = useId();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<
    string,
    { label: string; entries: { entry: ActivityEntry; date: Date | null }[] }
  >();
  const sorted = entries
    .map((entry, index) => {
      const date = new Date(entry.timestamp);
      return { entry, index, date: Number.isNaN(date.getTime()) ? null : date };
    })
    .sort(
      (a, b) =>
        (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity) || b.index - a.index,
    );

  for (const item of sorted) {
    const key = item.date ? calendarDay(item.date) : 'unknown';
    let group = groups.get(key);
    if (!group) {
      const label =
        key === calendarDay(today)
          ? 'Today'
          : key === calendarDay(yesterday)
            ? 'Yesterday'
            : (item.date?.toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }) ?? 'Unknown date');
      group = { label, entries: [] };
      groups.set(key, group);
    }
    group.entries.push(item);
  }

  return (
    <div className="dxp-activity">
      <section
        className="dxp-activity-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable activity history must support keyboard scrolling.
        tabIndex={0}
        aria-labelledby={headingId}
      >
        <div className="dxp-activity-content">
          <header className="dxp-activity-header">
            <span className="dxp-activity-icon" aria-hidden="true">
              <History size={21} strokeWidth={1.6} />
            </span>
            <div className="dxp-activity-heading">
              <h2 id={headingId}>Recent activity</h2>
              <p>See who changed this workflow and when.</p>
            </div>
            <span className="dxp-activity-count" aria-live="polite" aria-atomic="true">
              {entries.length} {entries.length === 1 ? 'action' : 'actions'}
            </span>
          </header>
          {entries.length ? (
            <div className="dxp-activity-history">
              {Array.from(groups, ([key, group]) => (
                <section className="dxp-activity-group" key={key}>
                  <h3>{group.label}</h3>
                  <ol className="dxp-activity-list" aria-label={group.label}>
                    {group.entries.map(({ entry, date }) => (
                      <li className="dxp-activity-entry" key={entry.id}>
                        <span
                          className={`dxp-activity-avatar dxp-activity-avatar-${avatarColor(entry.username)}`}
                          aria-hidden="true"
                        >
                          {initials(entry.username) || '?'}
                        </span>
                        <div className="dxp-activity-details">
                          <strong>{entry.username}</strong>
                          <p>{entry.action}</p>
                        </div>
                        {date ? (
                          <time
                            className="dxp-activity-time"
                            dateTime={entry.timestamp}
                            title={date.toLocaleString(undefined, {
                              dateStyle: 'full',
                              timeStyle: 'long',
                            })}
                          >
                            <Clock3 size={12} aria-hidden="true" />
                            {date.toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </time>
                        ) : (
                          <span className="dxp-activity-time">Unknown time</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="dxp-activity-end">You’re all caught up</p>
            </div>
          ) : (
            <div className="dxp-activity-empty">
              <span className="dxp-activity-empty-icon" aria-hidden="true">
                <History size={27} strokeWidth={1.4} />
              </span>
              <h3>No activity yet</h3>
              <p>Changes to this workflow will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
