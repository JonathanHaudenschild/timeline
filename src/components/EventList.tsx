'use client';

import { sortedEvents } from '@/lib/timeline';
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
  return (
    <section className="event-list">
      <div className="section-heading">
        <h2>Events</h2>
        <div className="heading-actions">
          <span>{events.length}</span>
          {canEdit ? (
            <>
              <button type="button" onClick={onAdd}>
                Add event
              </button>
              <button type="button" className="secondary" onClick={() => onSetAllTimeline(true)}>
                Show all
              </button>
              <button type="button" className="secondary" onClick={() => onSetAllTimeline(false)}>
                Hide all
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>What</th>
              <th>Who</th>
              <th>Type</th>
              <th>Category</th>
              <th>Timeline</th>
              <th>Note</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sortedEvents(events).map((event) => (
              <tr
                key={event.id}
                className={selectedEventId === event.id ? 'selected' : ''}
                onClick={() => onSelect(event)}
              >
                <td>{event.endDate ? `${event.date} - ${event.endDate}` : event.date}</td>
                <td>{event.time}</td>
                <td>{event.what}</td>
                <td>{event.who}</td>
                <td>{event.type}</td>
                <td>{event.category || event.type || 'event'}</td>
                <td>
                  {canEdit ? (
                    <button
                      type="button"
                      className={event.showOnTimeline === false ? 'secondary mini-button' : 'mini-button'}
                      onClick={(click) => {
                        click.stopPropagation();
                        onToggleTimeline(event);
                      }}
                    >
                      {event.showOnTimeline === false ? 'show' : 'hide'}
                    </button>
                  ) : event.showOnTimeline === false ? 'hidden' : 'shown'}
                </td>
                <td>{event.note}</td>
                <td>
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
                          onDelete(event.id);
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
