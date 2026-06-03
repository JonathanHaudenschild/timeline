'use client';

import { MarkdownBlock } from './MarkdownBlock';
import type { TimelineTodo, TodoStatus } from '@/lib/types';

type TodoEditorProps = {
  draft: TimelineTodo;
  onChange: (todo: TimelineTodo) => void;
  onCancel: () => void;
  onSave: () => void;
};

const statuses: TodoStatus[] = ['open', 'doing', 'done'];

export function TodoEditor({ draft, onChange, onCancel, onSave }: TodoEditorProps) {
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
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Due</span>
            <input
              type="date"
              value={draft.dueDate ?? ''}
              onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
            />
          </label>
        </div>
        <label className="check-control">
          <input
            type="checkbox"
            checked={draft.showOnTimeline}
            onChange={(event) => onChange({ ...draft, showOnTimeline: event.target.checked })}
          />
          Show subtle marker on timeline
        </label>
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
        </div>
      </form>
    </div>
  );
}
