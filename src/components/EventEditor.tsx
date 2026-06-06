'use client';

import { Save, Trash2, X } from 'lucide-react';
import type { TimelineEvent } from '@/lib/types';
import { colorForType } from '@/lib/colors';
import { eventCategoryOptions, eventTypeOptions } from '@/lib/eventOptions';
import { TextField } from './FormControls';
import { MarkdownEditor } from './MarkdownEditor';

type EventEditorProps = {
  draft: TimelineEvent;
  events: TimelineEvent[];
  typeColors: Record<string, string>;
  onChange: (event: TimelineEvent) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  modal?: boolean;
};

export function EventEditor({ draft, events, typeColors, onChange, onCancel, onSave, onDelete, modal = false }: EventEditorProps) {
  const eventTypes = eventTypeOptions(events);
  const eventCategories = eventCategoryOptions(events);

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
        <TextField
          label="Date"
          type="date"
          value={draft.date}
          onValueChange={(date) => onChange({ ...draft, date })}
          required
        />
        <TextField
          label="End"
          type="date"
          value={draft.endDate ?? ''}
          onValueChange={(endDate) =>
            onChange({
              ...draft,
              endDate: endDate || undefined,
              endTime: endDate ? draft.endTime : undefined,
            })
          }
        />
        <TextField
          label="Time"
          type="time"
          value={draft.time}
          onValueChange={(time) => onChange({ ...draft, time })}
        />
        <TextField
          label="End time"
          type="time"
          value={draft.endTime ?? ''}
          disabled={!draft.endDate}
          onValueChange={(endTime) => onChange({ ...draft, endTime: endTime || undefined })}
        />
        <TextField
          label="Type"
          list="event-type-suggestions"
          value={draft.type}
          onValueChange={(type) => onChange({ ...draft, type, color: '' })}
          placeholder="milestone, outage, call, custom..."
        />
          <datalist id="event-type-suggestions">
            {eventTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        <TextField
          label="Category"
          list="event-category-suggestions"
          value={draft.category ?? ''}
          onValueChange={(category) => onChange({ ...draft, category })}
          placeholder="event, milestone, deadline..."
        />
          <datalist id="event-category-suggestions">
            {eventCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
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
        <TextField
          label="What"
          value={draft.what}
          onValueChange={(what) => onChange({ ...draft, what })}
          required
        />
        <TextField
          label="Who"
          value={draft.who}
          onValueChange={(who) => onChange({ ...draft, who })}
        />
        <label className="check-control switch-control event-timeline-switch">
          <input
            type="checkbox"
            checked={draft.showOnTimeline !== false}
            onChange={(event) => onChange({ ...draft, showOnTimeline: event.target.checked })}
          />
          <span>Show on timeline</span>
        </label>
      </div>
      <label>
        <span>Markdown note</span>
        <MarkdownEditor
          value={draft.note}
          onChange={(note) => onChange({ ...draft, note })}
          rows={5}
        />
      </label>
      <div className="action-row">
        <button type="submit" className="icon-button modal-action-icon" aria-label="Save event" title="Save event">
          <Save size={18} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button tertiary modal-action-icon" onClick={onCancel} aria-label="Cancel" title="Cancel">
          <X size={18} aria-hidden="true" />
        </button>
        {onDelete ? (
          <button type="button" className="icon-button danger modal-action-icon" onClick={onDelete} aria-label="Delete event" title="Delete event">
            <Trash2 size={18} aria-hidden="true" />
          </button>
        ) : null}
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
