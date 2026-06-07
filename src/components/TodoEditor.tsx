'use client';

import { CalendarPlus, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SelectField, TextField } from './FormControls';
import { MarkdownEditor } from './MarkdownEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { formatTodoStatus, normalizeTodoTag, normalizeTodoTags, todoWithPendingTag } from '@/lib/todos';

type TodoEditorProps = {
  draft: TimelineTodo;
  statuses: TodoStatus[];
  boards?: Array<{ id: string; name: string; locked?: boolean }>;
  protocolOptions?: Array<{ id: string; title: string }>;
  availableTags?: string[];
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit todo">
      <form
        className="editor-panel modal-panel"
        onSubmit={(event) => {
          event.preventDefault();
          saveWithPendingTag();
        }}
      >
        <div className="panel-title">{title}</div>
        <div className="form-grid">
          <TextField
            label="Title"
            value={localDraft.title}
            onValueChange={(title) => updateDraft({ title })}
            required
          />
          <TextField
            label="Who"
            value={localDraft.who}
            onValueChange={(who) => updateDraft({ who })}
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
          <TextField
            label="Due"
            type="date"
            value={localDraft.dueDate ?? ''}
            onValueChange={(dueDate) => updateDraft({ dueDate })}
          />
          <TextField
            label="Created"
            value={formatTodoCreatedAt(localDraft.createdAt)}
            onValueChange={() => undefined}
            readOnly
            inputClassName="readonly-input"
          />
          <div className="todo-tags-field">
            <span className="field-label">Tags</span>
            <div className="todo-editor-tags">
              {selectedTags.length ? (
                <div className="todo-tag-list" aria-label="Todo tags">
                  {selectedTags.map((tag) => (
                    <span
                      className="todo-tag-chip todo-tag-remove"
                      key={tag}
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        className="todo-tag-remove-button"
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
              <div className="todo-tag-input-row">
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
        </div>
        <label>
          <span>Markdown note</span>
          <MarkdownEditor
            value={localDraft.body}
            onChange={(body) => updateDraft({ body })}
            rows={7}
          />
        </label>
        <div className="action-row">
          <button type="submit" className="icon-button modal-action-icon" aria-label={saveLabel} title={saveLabel}>
            <Save size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button tertiary modal-action-icon" onClick={onCancel} aria-label="Cancel" title="Cancel">
            <X size={18} aria-hidden="true" />
          </button>
          {onDelete ? (
            <button type="button" className="icon-button danger modal-action-icon" onClick={onDelete} aria-label="Delete todo" title="Delete todo">
              <Trash2 size={18} aria-hidden="true" />
            </button>
          ) : null}
          {onConvertToEvent ? (
            <button
              type="button"
              className="icon-button secondary modal-action-icon"
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
