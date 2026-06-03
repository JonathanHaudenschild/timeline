'use client';

import type { TimelineEvent } from '@/lib/types';
import { colorForType } from '@/lib/colors';
import { MarkdownBlock } from './MarkdownBlock';

type EventEditorProps = {
  draft: TimelineEvent;
  events: TimelineEvent[];
  typeColors: Record<string, string>;
  onChange: (event: TimelineEvent) => void;
  onCancel: () => void;
  onSave: () => void;
  modal?: boolean;
};

const defaultEventTypes = ['milestone', 'meeting', 'decision', 'incident', 'review', 'note'];
const defaultEventCategories = ['event', 'milestone', 'deadline', 'period'];

export function EventEditor({ draft, events, typeColors, onChange, onCancel, onSave, modal = false }: EventEditorProps) {
  const eventTypes = uniqueValues([...defaultEventTypes, ...events.map((event) => event.type)]);
  const eventCategories = uniqueValues([
    ...defaultEventCategories,
    ...events.map((event) => event.category || event.type),
  ]);

  const form = (
    <form
      className={modal ? 'editor-panel modal-panel' : 'editor-panel'}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="panel-title">Event</div>
      <div className="form-grid">
        <label>
          <span>Date</span>
          <input
            type="date"
            value={draft.date}
            onChange={(event) => onChange({ ...draft, date: event.target.value })}
            required
          />
        </label>
        <label>
          <span>End</span>
          <input
            type="date"
            value={draft.endDate ?? ''}
            onChange={(event) => onChange({ ...draft, endDate: event.target.value || undefined })}
          />
        </label>
        <label>
          <span>Time</span>
          <input
            type="time"
            value={draft.time}
            onChange={(event) => onChange({ ...draft, time: event.target.value })}
          />
        </label>
        <label>
          <span>Type</span>
          <input
            list="event-type-suggestions"
            value={draft.type}
            onChange={(event) => onChange({ ...draft, type: event.target.value, color: '' })}
            placeholder="milestone, outage, call, custom..."
          />
          <datalist id="event-type-suggestions">
            {eventTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label>
          <span>Category</span>
          <input
            list="event-category-suggestions"
            value={draft.category ?? ''}
            onChange={(event) => onChange({ ...draft, category: event.target.value })}
            placeholder="event, milestone, deadline..."
          />
          <datalist id="event-category-suggestions">
            {eventCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        <label>
          <span>Color</span>
          <div className="color-row">
            <input
              type="color"
              value={draft.color || colorForType(draft.type, typeColors)}
              onChange={(event) => onChange({ ...draft, color: event.target.value })}
              aria-label="Event color"
            />
            <input
              value={draft.color || ''}
              onChange={(event) => onChange({ ...draft, color: event.target.value })}
              placeholder={colorForType(draft.type, typeColors)}
              aria-label="Event color hex"
            />
          </div>
        </label>
        <label>
          <span>What</span>
          <input
            value={draft.what}
            onChange={(event) => onChange({ ...draft, what: event.target.value })}
            required
          />
        </label>
        <label>
          <span>Who</span>
          <input
            value={draft.who}
            onChange={(event) => onChange({ ...draft, who: event.target.value })}
          />
        </label>
      </div>
      <label className="check-control switch-control">
        <input
          type="checkbox"
          checked={draft.showOnTimeline !== false}
          onChange={(event) => onChange({ ...draft, showOnTimeline: event.target.checked })}
        />
        <span>Show on timeline</span>
      </label>
      <label>
        <span>Markdown note</span>
        <textarea
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          rows={5}
        />
      </label>
      {draft.note.trim() ? (
        <div className="event-note-preview">
          <MarkdownBlock markdown={draft.note} />
        </div>
      ) : null}
      <div className="action-row">
        <button type="submit">Save event</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );

  if (!modal) return form;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit event">
      {form}
    </div>
  );
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
