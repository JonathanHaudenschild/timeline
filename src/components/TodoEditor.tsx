'use client';

import { CalendarPlus, Save, Trash2, X } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { formatTodoStatus } from '@/lib/todos';

type TodoEditorProps = {
  draft: TimelineTodo;
  statuses: TodoStatus[];
  boards?: Array<{ id: string; name: string; locked?: boolean }>;
  protocolOptions?: Array<{ id: string; title: string }>;
  title?: string;
  saveLabel?: string;
  forceBoardSelect?: boolean;
  onChange: (todo: TimelineTodo) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onConvertToEvent?: () => void;
};

export function TodoEditor({
  draft,
  statuses,
  boards = [],
  protocolOptions = [],
  title = 'Todo',
  saveLabel = 'Save todo',
  forceBoardSelect = false,
  onChange,
  onCancel,
  onSave,
  onDelete,
  onConvertToEvent,
}: TodoEditorProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit todo">
      <form
        className="editor-panel modal-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
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
