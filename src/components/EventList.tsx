'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus, CalendarX, Eye, EyeOff, History, ListTodo } from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { MarkdownBlock } from './MarkdownBlock';
import { formatShortGermanDateRange } from '@/lib/dateFormat';
import { eventCategoryOptions, eventTypeOptions } from '@/lib/eventOptions';
import type { TimelineEvent } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';

type EventListProps = {
  events: TimelineEvent[];
  canEdit: boolean;
  onAdd: () => void;
  onChange: (event: TimelineEvent) => void;
  onToggleTimeline: (event: TimelineEvent) => void;
  onSetAllTimeline: (visible: boolean) => void;
  onConvertToTodo: (event: TimelineEvent) => void;
  onDelete: (eventId: string) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
};

type SortKey = 'date' | 'time' | 'what' | 'who' | 'type' | 'category' | 'timeline' | 'note';
type SortDirection = 'asc' | 'desc';

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'what', label: 'What' },
  { key: 'who', label: 'Who' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'note', label: 'Note' },
];

export function EventList({
  events,
  canEdit,
  onAdd,
  onChange,
  onToggleTimeline,
  onSetAllTimeline,
  onConvertToTodo,
  onDelete,
  onCopyLink,
  linkCopied,
}: EventListProps) {
  const appDialog = useAppDialog();
  const [sortKey, setSortKey] = usePersistentState<SortKey>('timeline:ui:event-list-sort-key', 'date');
  const [sortDirection, setSortDirection] = usePersistentState<SortDirection>('timeline:ui:event-list-sort-direction', 'asc');
  const [isMinimized, setIsMinimized] = usePersistentState('timeline:ui:event-list-minimized', true);
  const [hidePastEvents, setHidePastEvents] = usePersistentState('timeline:ui:event-list-hide-past', false);
  const [search, setSearch] = useState('');
  const pastEventCount = useMemo(() => events.filter(isPastEvent).length, [events]);
  const eventTypes = useMemo(() => eventTypeOptions(events), [events]);
  const eventCategories = useMemo(() => eventCategoryOptions(events), [events]);
  const sortedEventRows = useMemo(
    () =>
      sortEvents(
        events.filter((event) => (!hidePastEvents || !isPastEvent(event)) && eventMatchesSearch(event, search)),
        sortKey,
        sortDirection,
      ),
    [events, hidePastEvents, search, sortDirection, sortKey],
  );
  const visibleColumns = canEdit
    ? sortableColumns.filter((column) => column.key !== 'timeline')
    : sortableColumns;

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  }

  return (
    <section className="event-list">
      <div className="section-heading">
        <div className="section-title-with-link">
          <h2>Events</h2>
          <button
            type="button"
            className="icon-button secondary copy-link-icon"
            onClick={onCopyLink}
            aria-label="Copy events link"
            title={linkCopied ? 'Copied' : 'Copy events link'}
          >
            {linkCopied ? 'ok' : '§'}
          </button>
        </div>
        <div className="heading-actions event-heading-actions">
          <span className="section-counter">{sortedEventRows.length} / {events.length}</span>
          <label className="search-control event-search-control">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Event, person, note"
            />
          </label>
          {canEdit ? (
            <button
              type="button"
              className="icon-button event-add-button"
              onClick={onAdd}
              aria-label="Add event"
              title="Add event"
            >
              <CalendarPlus size={18} aria-hidden="true" />
            </button>
          ) : null}
          {canEdit ? (
            <div className="desktop-control-group bulk-event-actions">
              <button type="button" className="secondary" onClick={() => onSetAllTimeline(true)}>
                Show all
              </button>
              <button type="button" className="secondary" onClick={() => onSetAllTimeline(false)}>
                Hide all
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`event-table-toggle event-past-toggle ${hidePastEvents ? 'collapsed' : 'expanded'}`}
            onClick={() => setHidePastEvents((hidden) => !hidden)}
            aria-pressed={hidePastEvents}
            aria-label={hidePastEvents ? `Show ${pastEventCount} old events` : `Hide ${pastEventCount} old events`}
            title={hidePastEvents ? `Show ${pastEventCount} old events` : `Hide ${pastEventCount} old events`}
          >
            <History size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`event-table-toggle ${isMinimized ? 'collapsed' : 'expanded'}`}
            onClick={() => setIsMinimized((minimized) => !minimized)}
            aria-expanded={!isMinimized}
            aria-label={isMinimized ? 'Show event table' : 'Hide event table'}
            title={isMinimized ? 'Show event table' : 'Hide event table'}
          >
            {isMinimized ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className={`table-wrap ${isMinimized ? 'minimized-table' : ''}`}>
        <datalist id="event-list-type-suggestions">
          {eventTypes.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
        <datalist id="event-list-category-suggestions">
          {eventCategories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <table>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="table-sort-button"
                    onClick={() => changeSort(column.key)}
                  >
                    {column.label}
                    <span>{sortKey === column.key ? (sortDirection === 'asc' ? 'up' : 'down') : 'sort'}</span>
                  </button>
                </th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sortedEventRows.map((event) => (
              <tr
                key={event.id}
                id={`event-row-${event.id}`}
                className={[
                  event.type.trim().toLowerCase() === 'alt' ? 'event-row-alt' : '',
                  isPastEvent(event) ? 'event-row-past' : '',
                ].filter(Boolean).join(' ')}
              >
                <td className="event-date-cell" data-label="Date">
                  {canEdit ? (
                    <div className="inline-date-range" onClick={(click) => click.stopPropagation()}>
                      <div className="inline-date-row">
                        <input
                          type="date"
                          value={event.date}
                          onChange={(change) => onChange({ ...event, date: change.target.value })}
                          aria-label={`Date for ${event.what}`}
                        />
                        {!event.endDate ? (
                          <button
                            type="button"
                            className="inline-date-add"
                            onClick={() => onChange({ ...event, endDate: event.date })}
                            aria-label={`Add end date for ${event.what}`}
                            title="Add end date"
                          >
                            <CalendarPlus size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      {event.endDate ? (
                        <div className="inline-date-row">
                          <input
                            type="date"
                            value={event.endDate}
                            onChange={(change) => onChange({ ...event, endDate: change.target.value || undefined })}
                            aria-label={`End date for ${event.what}`}
                          />
                          <button
                            type="button"
                            className="inline-date-add"
                            onClick={() => onChange({ ...event, endDate: undefined })}
                            aria-label={`Remove end date for ${event.what}`}
                            title="Remove end date"
                          >
                            <CalendarX size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : formatShortGermanDateRange(event.date, event.endDate)}
                </td>
                <td className="event-time-cell" data-label="Time">
                  {canEdit ? (
                    <input
                      className="event-inline-input"
                      value={event.time}
                      onClick={(click) => click.stopPropagation()}
                      onChange={(change) => onChange({ ...event, time: change.target.value })}
                      aria-label={`Time for ${event.what}`}
                    />
                  ) : event.time}
                </td>
                <td className="event-what-cell" data-label="What">
                  {canEdit ? (
                    <input
                      className="event-inline-input"
                      value={event.what}
                      onClick={(click) => click.stopPropagation()}
                      onChange={(change) => onChange({ ...event, what: change.target.value })}
                      aria-label={`Title for ${event.what}`}
                    />
                  ) : event.what}
                </td>
                <td data-label="Who">
                  {canEdit ? (
                    <input
                      className="event-inline-input"
                      value={event.who}
                      onClick={(click) => click.stopPropagation()}
                      onChange={(change) => onChange({ ...event, who: change.target.value })}
                      aria-label={`Person for ${event.what}`}
                    />
                  ) : event.who}
                </td>
                <td data-label="Type">
                  {canEdit ? (
                    <input
                      className="event-inline-input event-inline-type"
                      list="event-list-type-suggestions"
                      value={event.type}
                      onClick={(click) => click.stopPropagation()}
                      onChange={(change) => onChange({ ...event, type: change.target.value, color: '' })}
                      aria-label={`Type for ${event.what}`}
                    />
                  ) : (
                    <span className="event-badge type-badge">{event.type}</span>
                  )}
                </td>
                <td data-label="Category">
                  {canEdit ? (
                    <input
                      className="event-inline-input"
                      list="event-list-category-suggestions"
                      value={event.category ?? ''}
                      onClick={(click) => click.stopPropagation()}
                      onChange={(change) => onChange({ ...event, category: change.target.value || undefined })}
                      aria-label={`Category for ${event.what}`}
                    />
                  ) : (
                    <span className="event-badge category-badge">{event.category || event.type || 'event'}</span>
                  )}
                </td>
                {!canEdit ? (
                  <td data-label="Timeline">
                    <span className={`event-badge timeline-badge ${event.showOnTimeline === false ? 'hidden' : 'shown'}`}>
                      {event.showOnTimeline === false ? 'hidden' : 'shown'}
                    </span>
                  </td>
                ) : null}
                <td className="event-note-cell" data-label="Note">
                  {canEdit ? (
                    <textarea
                      className="event-inline-note"
                      value={event.note}
                      onClick={(click) => click.stopPropagation()}
                      onChange={(change) => onChange({ ...event, note: change.target.value })}
                      aria-label={`Note for ${event.what}`}
                      placeholder="Note"
                      rows={1}
                    />
                  ) : event.note.trim() ? <MarkdownBlock markdown={event.note} /> : null}
                </td>
                <td data-label="Actions">
                  {canEdit ? (
                    <div className="event-row-actions">
                      <button
                        type="button"
                        className={`timeline-toggle action-toggle ${event.showOnTimeline === false ? 'off' : 'on'}`}
                        onClick={(click) => {
                          click.stopPropagation();
                          onToggleTimeline(event);
                        }}
                        aria-label={`${event.showOnTimeline === false ? 'Show' : 'Hide'} ${event.what} on timeline`}
                        title={event.showOnTimeline === false ? 'Show on timeline' : 'Hide from timeline'}
                      >
                        {event.showOnTimeline === false ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={(click) => {
                          click.stopPropagation();
                          onConvertToTodo(event);
                        }}
                        aria-label={`Convert ${event.what} to todo`}
                        title="Convert to todo"
                      >
                        <ListTodo size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={(click) => {
                          click.stopPropagation();
                          void appDialog
                            .confirm({
                              title: 'Delete event?',
                              message: `Delete "${event.what}"?`,
                              confirmLabel: 'Delete event',
                              tone: 'danger',
                            })
                            .then((confirmed) => {
                              if (confirmed) onDelete(event.id);
                            });
                        }}
                        aria-label={`Delete ${event.what}`}
                      >
                        x
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {appDialog.dialog}
    </section>
  );
}

function sortEvents(events: TimelineEvent[], sortKey: SortKey, sortDirection: SortDirection) {
  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...events].sort((a, b) => {
    const primary = compareValues(eventSortValue(a, sortKey), eventSortValue(b, sortKey));
    if (primary !== 0) return primary * direction;

    const dateCompare = compareValues(a.date, b.date);
    if (dateCompare !== 0) return dateCompare;

    const timeCompare = compareValues(a.time, b.time);
    if (timeCompare !== 0) return timeCompare;

    return compareValues(a.what, b.what);
  });
}

function eventSortValue(event: TimelineEvent, sortKey: SortKey) {
  switch (sortKey) {
    case 'category':
      return event.category || event.type || 'event';
    case 'timeline':
      return event.showOnTimeline === false ? 'hidden' : 'shown';
    default:
      return event[sortKey] ?? '';
  }
}

function compareValues(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function eventMatchesSearch(event: TimelineEvent, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    event.date,
    event.endDate ?? '',
    event.time,
    event.what,
    event.who,
    event.type,
    event.category ?? '',
    event.note,
    event.showOnTimeline === false ? 'hidden' : 'shown',
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function isPastEvent(event: TimelineEvent) {
  const compareDate = event.endDate || event.date;
  return Boolean(compareDate) && compareDate < localDateString(new Date());
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
