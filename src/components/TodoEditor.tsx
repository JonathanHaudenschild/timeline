'use client';

import { CalendarPlus, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  const [tagInput, setTagInput] = useState('');
  const selectedTags = normalizeTodoTags(draft.tags);
  const suggestionTags = useMemo(() => {
    const selected = new Set(selectedTags.map((tag) => tag.toLocaleLowerCase()));
    return normalizeTodoTags(availableTags)
      .filter((tag) => !selected.has(tag.toLocaleLowerCase()))
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  }, [availableTags, selectedTags]);
  const tagOptionsId = `todo-tag-options-${draft.id}`;

  function addTag(tag: string) {
    const normalizedTag = normalizeTodoTag(tag);
    if (!normalizedTag) return;
    onChange({ ...draft, tags: normalizeTodoTags([...selectedTags, normalizedTag]) });
    setTagInput('');
  }

  function removeTag(tag: string) {
    onChange({
      ...draft,
      tags: selectedTags.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase()),
    });
  }

  function saveWithPendingTag() {
    const todoToSave = todoWithPendingTag(draft, tagInput);
    if (tagInput.trim()) {
      onChange(todoToSave);
      setTagInput('');
    }
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
          <label>
            <span>Title</span>
            <input
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Who</span>
            <input value={draft.who} onChange={(event) => onChange({ ...draft, who: event.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) => onChange({ ...draft, status: event.target.value as TodoStatus })}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatTodoStatus(status)}
                </option>
              ))}
            </select>
          </label>
          {boards.length > 1 || forceBoardSelect ? (
            <label>
              <span>Board</span>
              <select
                value={draft.boardId ?? boards[0]?.id ?? ''}
                onChange={(event) => onChange({ ...draft, boardId: event.target.value })}
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.locked ? 'PIN ' : ''}{board.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {protocolOptions.length ? (
            <label>
              <span>Protocol</span>
              <select
                value={draft.protocolId ?? ''}
                onChange={(event) => onChange({ ...draft, protocolId: event.target.value || undefined })}
              >
                <option value="">No protocol</option>
                {protocolOptions.map((protocol) => (
                  <option key={protocol.id} value={protocol.id}>
                    {protocol.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Due</span>
            <input
              type="date"
              value={draft.dueDate ?? ''}
              onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
            />
          </label>
          <label>
            <span>Created</span>
            <input className="readonly-input" value={formatTodoCreatedAt(draft.createdAt)} readOnly />
          </label>
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
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ',') return;
                    event.preventDefault();
                    addTag(tagInput);
                  }}
                  list={tagOptionsId}
                  placeholder={selectedTags.length ? 'Add tag' : 'Add or reuse tag'}
                  aria-label="Add todo tag"
                />
                <datalist id={tagOptionsId}>
                  {suggestionTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                <button
                  type="button"
                  className="icon-button secondary"
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
            value={draft.body}
            onChange={(body) => onChange({ ...draft, body })}
            rows={7}
          />
        </label>
        <div className="action-row">
          <button type="submit" className="icon-button modal-action-icon" aria-label={saveLabel} title={saveLabel}>
            <Save size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button secondary modal-action-icon" onClick={onCancel} aria-label="Cancel" title="Cancel">
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
