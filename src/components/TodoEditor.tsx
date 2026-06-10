'use client';

import { CalendarPlus, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SelectField, TextField } from './FormControls';
import { DuplicateHints } from './DuplicateHints';
import { MarkdownEditor } from './MarkdownEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import type { DuplicateCandidate } from '@/lib/duplicateHints';
import { formatTodoStatus, normalizeTodoTag, normalizeTodoTags, todoWithPendingTag } from '@/lib/todos';

type TodoEditorProps = {
  draft: TimelineTodo;
  statuses: TodoStatus[];
  boards?: Array<{ id: string; name: string; locked?: boolean }>;
  protocolOptions?: Array<{ id: string; title: string }>;
  availableTags?: string[];
  duplicateCandidates?: DuplicateCandidate[];
  title?: string;
  saveLabel?: string;
  forceBoardSelect?: boolean;
  onChange: (todo: TimelineTodo) => void;
  onCancel: () => void;
  onSave: (todo?: TimelineTodo) => void;
  onDelete?: () => void;
  onConvertToEvent?: () => void;
};

export function TodoEditor({
  draft,
  statuses,
  boards = [],
  protocolOptions = [],
  availableTags = [],
  duplicateCandidates = [],
  title = 'Todo',
  saveLabel = 'Save todo',
  forceBoardSelect = false,
  onChange,
  onCancel,
  onSave,
  onDelete,
  onConvertToEvent,
}: TodoEditorProps) {
  const [localDraft, setLocalDraft] = useState(draft);
  const [tagInput, setTagInput] = useState('');
  const selectedTags = normalizeTodoTags(localDraft.tags);
  const suggestionTags = useMemo(() => {
    const selected = new Set(selectedTags.map((tag) => tag.toLocaleLowerCase()));
    return normalizeTodoTags(availableTags)
      .filter((tag) => !selected.has(tag.toLocaleLowerCase()))
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  }, [availableTags, selectedTags]);
  const tagOptionsId = `todo-tag-options-${localDraft.id}`;

  function updateDraft(patch: Partial<TimelineTodo>) {
    setLocalDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  function addTag(tag: string) {
    const normalizedTag = normalizeTodoTag(tag);
    if (!normalizedTag) return;
    updateDraft({ tags: normalizeTodoTags([...selectedTags, normalizedTag]) });
    setTagInput('');
  }

  function removeTag(tag: string) {
    updateDraft({
      tags: selectedTags.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase()),
    });
  }

  function saveWithPendingTag() {
    const todoToSave = todoWithPendingTag(localDraft, tagInput);
    if (tagInput.trim()) {
      setTagInput('');
    }
    onChange(todoToSave);
    onSave(todoToSave);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-[18px] bg-[rgba(18,24,22,0.42)]" role="dialog" aria-modal="true" aria-label="Edit todo">
      <form
        className="bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[14px] w-[min(720px,100%)] max-h-[calc(100vh-36px)] overflow-auto shadow-[0_20px_60px_color-mix(in_srgb,var(--line)_20%,transparent)]"
        onSubmit={(event) => {
          event.preventDefault();
          saveWithPendingTag();
        }}
      >
        <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="text-[18px] font-[950] mb-0 uppercase">{title}</div>
          <div className="flex min-w-0 flex-wrap justify-end gap-x-2 gap-y-0.5 text-[10px] font-black uppercase text-[var(--muted)]">
            <time dateTime={localDraft.createdAt}>created {formatTodoCreatedAt(localDraft.createdAt)}</time>
            <time dateTime={localDraft.updatedAt ?? localDraft.createdAt}>
              updated {formatTodoCreatedAt(localDraft.updatedAt ?? localDraft.createdAt)}
            </time>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <TextField
              label="Title"
              value={localDraft.title}
              onValueChange={(title) => updateDraft({ title })}
              required
            />
            <DuplicateHints
              draftId={`todo:${localDraft.id}`}
              title={localDraft.title}
              body={localDraft.body}
              candidates={duplicateCandidates}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
            <TextField
              label="Who"
              value={localDraft.who}
              onValueChange={(who) => updateDraft({ who })}
            />
            <TextField
              label="Due"
              type="date"
              value={localDraft.dueDate ?? ''}
              onValueChange={(dueDate) => updateDraft({ dueDate })}
            />
            <SelectField
              label="Status"
              value={localDraft.status}
              onValueChange={(status) => updateDraft({ status: status as TodoStatus })}
              className="max-w-none"
            >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatTodoStatus(status)}
                  </option>
                ))}
            </SelectField>
            {boards.length > 1 || forceBoardSelect ? (
              <SelectField
                label="Board"
                value={localDraft.boardId ?? boards[0]?.id ?? ''}
                onValueChange={(boardId) => updateDraft({ boardId })}
                className="max-w-none"
              >
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.locked ? 'PIN ' : ''}{board.name}
                    </option>
                  ))}
              </SelectField>
            ) : null}
            {protocolOptions.length ? (
              <SelectField
                label="Protocol"
                value={localDraft.protocolId ?? ''}
                onValueChange={(protocolId) => updateDraft({ protocolId: protocolId || undefined })}
                className="max-w-none"
              >
                  <option value="">No protocol</option>
                  {protocolOptions.map((protocol) => (
                    <option key={protocol.id} value={protocol.id}>
                      {protocol.title}
                    </option>
                  ))}
              </SelectField>
            ) : null}
          </div>
          <div className="col-span-full grid grid-cols-[minmax(0,1fr)_180px] gap-2.5 max-sm:grid-cols-1 items-end">
            <div className="min-w-0">
              <span className="text-[var(--muted)] text-xs">Tags</span>
              <div className="grid gap-[6px] min-w-0 border border-[var(--soft-line)] rounded-[2px] bg-[var(--card-bg)] p-[5px]">
                {selectedTags.length ? (
                  <div className="flex flex-wrap gap-1 items-center min-w-0" aria-label="Todo tags">
                    {selectedTags.map((tag) => (
                      <span
                        className="inline-flex min-h-[19px] min-w-0 max-w-full items-center gap-1 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--card-bg)] px-1.5 py-px text-[9px] font-[950] leading-[1.1] uppercase text-[var(--text)] shadow-none cursor-default"
                        key={tag}
                      >
                        <span className="min-w-0 [overflow-wrap:anywhere]">{tag}</span>
                        <button
                          type="button"
                          className="inline-grid place-items-center w-4 min-w-4 h-4 min-h-4 border-0 rounded-[2px] bg-transparent shadow-none text-[var(--muted)] p-0 hover:bg-[var(--danger)] hover:text-white focus-visible:bg-[var(--danger)] focus-visible:text-white"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                          title="Remove tag"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="grid [grid-template-columns:minmax(0,1fr)_var(--icon-button-size)] gap-[6px] items-center min-w-0">
                  <TextField
                    label="Add todo tag"
                    hideLabel
                    value={tagInput}
                    onValueChange={setTagInput}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ',') return;
                      event.preventDefault();
                      addTag(tagInput);
                    }}
                    list={tagOptionsId}
                    placeholder={selectedTags.length ? 'Add tag' : 'Add or reuse tag'}
                    aria-label="Add todo tag"
                    className="min-w-0 flex-1"
                  />
                  <datalist id={tagOptionsId}>
                    {suggestionTags.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => addTag(tagInput)}
                    aria-label="Add tag"
                    title="Add tag"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <label className="grid gap-[5px] content-start">
              <span className="flex items-center justify-between gap-2 text-[var(--muted)] text-xs">
                <span>Importance</span>
                {localDraft.importance ? (
                  <span
                    className="rounded-[2px] px-[6px] py-px text-[11px] font-[950] leading-none"
                    style={{
                      backgroundColor: importanceCssColor(localDraft.importance),
                      color: localDraft.importance < 34 ? 'var(--on-primary)' : 'white',
                    }}
                  >
                    {localDraft.importance}
                  </span>
                ) : (
                  <span className="text-[11px] font-[900] text-[var(--muted)]">none</span>
                )}
              </span>
              <div className="flex items-center gap-2 min-w-0 border border-[var(--soft-line)] rounded-[2px] bg-[var(--card-bg)] p-[5px]">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={localDraft.importance ?? ''}
                  placeholder="0 – 100"
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, Number(e.target.value)));
                    updateDraft({ importance: val > 0 ? val : undefined });
                  }}
                  className="min-h-[var(--icon-button-size)] min-w-0 flex-1 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] px-2 text-[13px] font-[950] shadow-none focus:border-[var(--text)] focus:outline focus:outline-2 focus:outline-[rgba(221,248,90,0.5)] focus:outline-offset-2"
                  aria-label="Importance 0–100"
                />
                {localDraft.importance ? (
                  <button
                    type="button"
                    className="icon-button tertiary h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
                    onClick={() => updateDraft({ importance: undefined })}
                    aria-label="Clear importance"
                    title="Clear"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        </div>
        <label className="mt-3 block">
          <span>Markdown note</span>
          <MarkdownEditor
            value={localDraft.body}
            onChange={(body) => updateDraft({ body })}
            rows={7}
          />
        </label>
        <div className="flex gap-2 items-center flex-wrap mt-[10px]">
          <button type="submit" className="icon-button w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0" aria-label={saveLabel} title={saveLabel}>
            <Save size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button tertiary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0" onClick={onCancel} aria-label="Cancel" title="Cancel">
            <X size={18} aria-hidden="true" />
          </button>
          {onDelete ? (
            <button type="button" className="icon-button danger w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0" onClick={onDelete} aria-label="Delete todo" title="Delete todo">
              <Trash2 size={18} aria-hidden="true" />
            </button>
          ) : null}
          {onConvertToEvent ? (
            <button
              type="button"
              className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
              onClick={onConvertToEvent}
              aria-label="Convert to event"
              title="Convert to event"
            >
              <CalendarPlus size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function importanceCssColor(importance: number) {
  if (importance >= 67) return 'var(--danger)';
  if (importance >= 34) return 'var(--hot)';
  return 'var(--primary)';
}

function formatTodoCreatedAt(createdAt?: string) {
  if (!createdAt) return 'Unknown';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
