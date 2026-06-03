'use client';

import { useMemo, useState } from 'react';
import { MarkdownBlock } from './MarkdownBlock';
import { formatShortGermanDateRange } from '@/lib/dateFormat';
import type { TimelineEvent } from '@/lib/types';

type EventListProps = {
  events: TimelineEvent[];
  selectedEventId?: string;
  canEdit: boolean;
  onAdd: () => void;
  onSelect: (event: TimelineEvent) => void;
  onEdit: (event: TimelineEvent) => void;
  onToggleTimeline: (event: TimelineEvent) => void;
  onSetAllTimeline: (visible: boolean) => void;
  onDelete: (eventId: string) => void;
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
  selectedEventId,
  canEdit,
  onAdd,
  onSelect,
  onEdit,
  onToggleTimeline,
  onSetAllTimeline,
  onDelete,
}: EventListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isMinimized, setIsMinimized] = useState(true);
  const [search, setSearch] = useState('');
  const sortedEventRows = useMemo(
    () => sortEvents(events.filter((event) => eventMatchesSearch(event, search)), sortKey, sortDirection),
    [events, search, sortDirection, sortKey],
  );

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
        <h2>Events</h2>
        <div className="heading-actions">
          <span>{sortedEventRows.length} / {events.length}</span>
          <label className="search-control event-search-control">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Event, person, note"
            />
          </label>
          <button
            type="button"
            className={`toggle-chip ${isMinimized ? '' : 'active'}`}
            onClick={() => setIsMinimized((minimized) => !minimized)}
          >
            {isMinimized ? 'Expand' : 'Minimize'}
          </button>
          {canEdit ? (
            <button type="button" onClick={onAdd}>
              Add event
            </button>
          ) : null}
          {canEdit ? (
            <details className="mobile-control-menu inline-control-menu event-mobile-menu">
              <summary>Timeline visibility</summary>
              <div className="mobile-control-panel">
                <button type="button" className="secondary" onClick={() => onSetAllTimeline(true)}>
                  Show all
                </button>
                <button type="button" className="secondary" onClick={() => onSetAllTimeline(false)}>
                  Hide all
                </button>
              </div>
            </details>
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
        </div>
      </div>
      <div className={`table-wrap ${isMinimized ? 'minimized-table' : ''}`}>
        <table>
          <thead>
            <tr>
              {sortableColumns.map((column) => (
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
                className={selectedEventId === event.id ? 'selected' : ''}
                onClick={() => onSelect(event)}
              >
                <td className="event-date-cell" data-label="Date">{formatShortGermanDateRange(event.date, event.endDate)}</td>
                <td className="event-time-cell" data-label="Time">{event.time}</td>
                <td className="event-what-cell" data-label="What">{event.what}</td>
                <td data-label="Who">{event.who}</td>
                <td data-label="Type">
                  <span className="event-badge type-badge">{event.type}</span>
                </td>
                <td data-label="Category">
                  <span className="event-badge category-badge">{event.category || event.type || 'event'}</span>
                </td>
                <td data-label="Timeline">
                  {canEdit ? (
                    <button
                      type="button"
                      className={`timeline-toggle ${event.showOnTimeline === false ? 'off' : 'on'}`}
                      onClick={(click) => {
                        click.stopPropagation();
                        onToggleTimeline(event);
                      }}
                    >
                      {event.showOnTimeline === false ? 'show' : 'hide'}
                    </button>
                  ) : (
                    <span className={`event-badge timeline-badge ${event.showOnTimeline === false ? 'hidden' : 'shown'}`}>
                      {event.showOnTimeline === false ? 'hidden' : 'shown'}
                    </span>
                  )}
                </td>
                <td className="event-note-cell" data-label="Note">
                  {event.note.trim() ? <MarkdownBlock markdown={event.note} /> : null}
                </td>
                <td data-label="Actions">
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={(click) => {
                          click.stopPropagation();
                          onEdit(event);
                        }}
                        aria-label={`Edit ${event.what}`}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={(click) => {
                          click.stopPropagation();
                          if (window.confirm(`Delete "${event.what}"?`)) {
                            onDelete(event.id);
                          }
                        }}
                        aria-label={`Delete ${event.what}`}
                      >
                        x
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
