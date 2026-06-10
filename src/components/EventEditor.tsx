'use client';

import { Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { TimelineEvent } from '@/lib/types';
import { colorForType } from '@/lib/colors';
import type { DuplicateCandidate } from '@/lib/duplicateHints';
import { eventCategoryOptions, eventTypeOptions } from '@/lib/eventOptions';
import { ColorSwatch } from './ColorSwatch';
import { DuplicateHints } from './DuplicateHints';
import { TextField } from './FormControls';
import { MarkdownEditor } from './MarkdownEditor';

type EventEditorProps = {
  draft: TimelineEvent;
  events: TimelineEvent[];
  typeColors: Record<string, string>;
  duplicateCandidates?: DuplicateCandidate[];
  onChange: (event: TimelineEvent) => void;
  onCancel: () => void;
  onSave: (event?: TimelineEvent) => void;
  onDelete?: () => void;
  modal?: boolean;
};

export function EventEditor({ draft, events, typeColors, duplicateCandidates = [], onChange, onCancel, onSave, onDelete, modal = false }: EventEditorProps) {
  const [localDraft, setLocalDraft] = useState(draft);
  const eventTypes = eventTypeOptions(events);
  const eventCategories = eventCategoryOptions(events);

  function updateDraft(patch: Partial<TimelineEvent>) {
    setLocalDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  const form = (
    <form
      className={modal ? 'bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[14px] w-[min(720px,100%)] max-h-[calc(100vh-36px)] overflow-auto shadow-[0_20px_60px_color-mix(in_srgb,var(--line)_20%,transparent)]' : 'bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[14px]'}
      onSubmit={(event) => {
        event.preventDefault();
        onChange(localDraft);
        onSave(localDraft);
      }}
    >
      <div className="text-[18px] font-[950] mb-[10px] uppercase">Event</div>
      <div className="grid [grid-template-columns:repeat(2,minmax(0,1fr))] gap-[10px] mb-[10px] max-sm:grid-cols-1">
        <TextField
          label="Date"
          type="date"
          value={localDraft.date}
          onValueChange={(date) => updateDraft({ date })}
          required
        />
        <TextField
          label="End"
          type="date"
          value={localDraft.endDate ?? ''}
          onValueChange={(endDate) =>
            updateDraft({
              endDate: endDate || undefined,
              endTime: endDate ? localDraft.endTime : undefined,
            })
          }
        />
        <TextField
          label="Time"
          type="time"
          value={localDraft.time}
          onValueChange={(time) => updateDraft({ time, endTime: time ? localDraft.endTime : undefined })}
        />
        <TextField
          label="End time"
          type="time"
          value={localDraft.endTime ?? ''}
          disabled={!localDraft.endDate || !localDraft.time}
          onValueChange={(endTime) => updateDraft({ endTime: endTime || undefined })}
        />
        <TextField
          label="Type"
          list="event-type-suggestions"
          value={localDraft.type}
          onValueChange={(type) => updateDraft({ type, color: '' })}
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
          value={localDraft.category ?? ''}
          onValueChange={(category) => updateDraft({ category })}
          placeholder="event, milestone, deadline..."
        />
          <datalist id="event-category-suggestions">
            {eventCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        <label>
          <span>Color</span>
          <div className="grid [grid-template-columns:var(--icon-button-size)_minmax(0,1fr)] gap-[6px] items-center">
            <ColorSwatch
              value={localDraft.color || colorForType(localDraft.type, typeColors)}
              onChange={(color) => updateDraft({ color })}
              label="Event color"
            />
            <input
              value={localDraft.color || ''}
              onChange={(event) => updateDraft({ color: event.target.value })}
              placeholder={colorForType(localDraft.type, typeColors)}
              aria-label="Event color hex"
            />
          </div>
        </label>
        <TextField
          label="What"
          value={localDraft.what}
          onValueChange={(what) => updateDraft({ what })}
          required
        />
        <div className="col-span-full">
          <DuplicateHints
            draftId={`event:${localDraft.id}`}
            title={localDraft.what}
            body={localDraft.note}
            candidates={duplicateCandidates}
          />
        </div>
        <TextField
          label="Who"
          value={localDraft.who}
          onValueChange={(who) => updateDraft({ who })}
        />
        <label className="relative min-h-[var(--icon-button-size)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[2px] bg-[var(--input-bg)] shadow-none pl-[42px] pr-[10px] font-[950] uppercase focus-within:border-[var(--text)] focus-within:outline focus-within:outline-2 focus-within:outline-[rgba(221,248,90,0.5)] focus-within:outline-offset-2 self-end w-full col-span-full max-sm:col-auto">
          <input
            type="checkbox"
            checked={localDraft.showOnTimeline !== false}
            onChange={(event) => updateDraft({ showOnTimeline: event.target.checked })}
            className="absolute left-2 top-1/2 w-[25px] h-[15px] m-0 appearance-none border border-[color-mix(in_srgb,var(--line)_34%,transparent)] rounded-full bg-[var(--input-bg)] cursor-pointer -translate-y-1/2 checked:border-[var(--hot)] checked:bg-[var(--primary)] before:content-[''] before:absolute before:w-[9px] before:h-[9px] before:left-[2px] before:top-[2px] before:bg-[var(--line)] before:rounded-full before:transition-transform before:duration-[120ms] before:ease-[ease] checked:before:translate-x-[10px] checked:before:bg-[var(--hot)]"
          />
          <span>Show on timeline</span>
        </label>
      </div>
      <label>
        <span>Markdown note</span>
        <MarkdownEditor
          value={localDraft.note}
          onChange={(note) => updateDraft({ note })}
          rows={5}
        />
      </label>
      <div className="flex gap-2 items-center flex-wrap mt-[10px]">
        <button type="submit" className="icon-button w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0" aria-label="Save event" title="Save event">
          <Save size={18} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button tertiary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0" onClick={onCancel} aria-label="Cancel" title="Cancel">
          <X size={18} aria-hidden="true" />
        </button>
        {onDelete ? (
          <button type="button" className="icon-button danger w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0" onClick={onDelete} aria-label="Delete event" title="Delete event">
            <Trash2 size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </form>
  );

  if (!modal) return form;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-[18px] bg-[rgba(18,24,22,0.42)]" role="dialog" aria-modal="true" aria-label="Edit event">
      {form}
    </div>
  );
}
