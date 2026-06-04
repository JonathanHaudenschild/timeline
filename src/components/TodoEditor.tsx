'use client';

import { MarkdownBlock } from './MarkdownBlock';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { formatTodoStatus } from '@/lib/todos';

type TodoEditorProps = {
  draft: TimelineTodo;
  statuses: TodoStatus[];
  boards?: Array<{ id: string; name: string; locked?: boolean }>;
  onChange: (todo: TimelineTodo) => void;
  onCancel: () => void;
  onSave: () => void;
  onConvertToEvent?: () => void;
};

export function TodoEditor({ draft, statuses, boards = [], onChange, onCancel, onSave, onConvertToEvent }: TodoEditorProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit todo">
      <form
        className="editor-panel modal-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="panel-title">Todo</div>
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
          {boards.length > 1 ? (
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
          <textarea
            value={draft.body}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
            rows={7}
          />
        </label>
        <div className="todo-preview">
          <MarkdownBlock markdown={draft.body} />
        </div>
        <div className="action-row">
          <button type="submit">Save todo</button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          {onConvertToEvent ? (
            <button type="button" className="secondary" onClick={onConvertToEvent}>
              Convert to event
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
