import '../../styles/base.css';
import '../../styles/shared.css';
import { Clock3, History } from 'lucide-react';
import { useId } from 'react';
import { type ActivityEntry, formatActivity } from '../../lib/activity';
import { useBuilderI18n } from '../../lib/i18nContext';
import './ActivityPanel.css';

export interface ActivityPanelProps {
  entries: readonly ActivityEntry[];
}

function calendarDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function initials(username: string, locale: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase(locale);
}

function avatarColor(username: string) {
  let hash = 0;
  for (const character of username) hash = (hash + (character.codePointAt(0) ?? 0)) % 4;
  return hash;
}

export function ActivityPanel({ entries }: ActivityPanelProps) {
  const { t, locale } = useBuilderI18n();
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
          ? t('activityPanel.today')
          : key === calendarDay(yesterday)
            ? t('activityPanel.yesterday')
            : (item.date?.toLocaleDateString(locale, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }) ?? t('activityPanel.unknownDate'));
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
              <h2 id={headingId}>{t('activityPanel.recentActivity')}</h2>
              <p>{t('activityPanel.seeWhoChangedThisWorkflowAndWhen')}</p>
            </div>
            <span className="dxp-activity-count" aria-live="polite" aria-atomic="true">
              {t('activity.actionCount', { count: entries.length })}
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
                          {initials(entry.username, locale) || '?'}
                        </span>
                        <div className="dxp-activity-details">
                          <strong>{entry.username}</strong>
                          <p>{formatActivity(entry, t)}</p>
                        </div>
                        {date ? (
                          <time
                            className="dxp-activity-time"
                            dateTime={entry.timestamp}
                            title={date.toLocaleString(locale, {
                              dateStyle: 'full',
                              timeStyle: 'long',
                            })}
                          >
                            <Clock3 size={12} aria-hidden="true" />
                            {date.toLocaleTimeString(locale, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </time>
                        ) : (
                          <span className="dxp-activity-time">
                            {t('activityPanel.unknownTime')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="dxp-activity-end">{t('activityPanel.youReAllCaughtUp')}</p>
            </div>
          ) : (
            <div className="dxp-activity-empty">
              <span className="dxp-activity-empty-icon" aria-hidden="true">
                <History size={27} strokeWidth={1.4} />
              </span>
              <h3>{t('activityPanel.noActivityYet')}</h3>
              <p>{t('activityPanel.changesToThisWorkflowWillAppearHere')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
