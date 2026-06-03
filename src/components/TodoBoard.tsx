'use client';

import { useState } from 'react';
import { TodoEditor } from './TodoEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { defaultTodoStatuses, formatTodoStatus, normalizeTodoStatus } from '@/lib/todos';

type TodoBoardProps = {
  todos: TimelineTodo[];
  statuses: TodoStatus[];
  onChange: (todos: TimelineTodo[]) => void;
  onStatusesChange: (statuses: TodoStatus[]) => void;
};

export function TodoBoard({ todos, statuses, onChange, onStatusesChange }: TodoBoardProps) {
  const [draftTodo, setDraftTodo] = useState<TimelineTodo | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TodoStatus | null>(null);
  const [newStatus, setNewStatus] = useState('');

  function addTodo() {
    setDraftTodo({
      id: crypto.randomUUID(),
      title: 'New todo',
      who: '',
      body: '- Add details',
      status: 'open',
      dueDate: '',
      showOnTimeline: false,
    });
  }

  function updateTodo(todo: TimelineTodo) {
    onChange(todos.map((item) => (item.id === todo.id ? todo : item)));
  }

  function saveTodo() {
    if (!draftTodo) return;
    const exists = todos.some((todo) => todo.id === draftTodo.id);
    onChange(exists ? todos.map((todo) => (todo.id === draftTodo.id ? draftTodo : todo)) : [...todos, draftTodo]);
    setDraftTodo(null);
  }

  function moveTodo(todoId: string, status: TodoStatus) {
    onChange(todos.map((todo) => (todo.id === todoId ? { ...todo, status } : todo)));
  }

  const totalOpen = todos.filter((todo) => todo.status !== 'done').length;
  const visibleStatuses = statuses.length ? statuses : defaultTodoStatuses;

  function addStatus() {
    const status = normalizeTodoStatus(newStatus);
    if (!status || visibleStatuses.includes(status)) return;
    onStatusesChange([...visibleStatuses, status]);
    setNewStatus('');
  }

  function removeStatus(status: TodoStatus) {
    if (defaultTodoStatuses.includes(status)) return;
    if (todos.some((todo) => todo.status === status)) return;
    onStatusesChange(visibleStatuses.filter((item) => item !== status));
  }

  function moveStatus(status: TodoStatus, targetStatus: TodoStatus) {
    if (status === targetStatus) return;

    const withoutDragged = visibleStatuses.filter((item) => item !== status);
    const targetIndex = withoutDragged.indexOf(targetStatus);
    if (targetIndex === -1) return;

    onStatusesChange([
      ...withoutDragged.slice(0, targetIndex),
      status,
      ...withoutDragged.slice(targetIndex),
    ]);
  }

  function nudgeStatus(status: TodoStatus, direction: -1 | 1) {
    const index = visibleStatuses.indexOf(status);
    const targetStatus = visibleStatuses[index + direction];
    if (!targetStatus) return;
    moveStatus(status, targetStatus);
  }

  return (
    <section className="todo-board">
      <div className="section-heading">
        <div>
          <h2>Todos</h2>
          <div className="todo-board-summary">{totalOpen} open / {todos.length} total</div>
        </div>
        <div className="todo-board-actions">
          <form
            className="add-status-form"
            onSubmit={(event) => {
              event.preventDefault();
              addStatus();
            }}
          >
            <input
              value={newStatus}
              onChange={(event) => setNewStatus(event.target.value)}
              placeholder="New status"
              aria-label="New todo status"
            />
            <button type="submit" className="secondary">Add column</button>
          </form>
          <button type="button" onClick={addTodo}>
            Add todo
          </button>
        </div>
      </div>
      {draftTodo ? (
        <TodoEditor
          draft={draftTodo}
          statuses={visibleStatuses}
          onChange={setDraftTodo}
          onCancel={() => setDraftTodo(null)}
          onSave={saveTodo}
        />
      ) : null}
      <div className="todo-columns">
        {visibleStatuses.map((status) => {
          const columnTodos = todos
            .filter((todo) => todo.status === status)
            .sort(compareTodos);
          const canRemoveStatus = !defaultTodoStatuses.includes(status) && columnTodos.length === 0;

          return (
            <div
              className={`todo-column ${dropStatus === status ? 'drop-target' : ''}`}
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setDropStatus(status);
              }}
              onDragLeave={() => setDropStatus(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedTodoId) moveTodo(draggedTodoId, status);
                setDraggedTodoId(null);
                setDropStatus(null);
              }}
            >
              <div
                className="column-title"
              >
                <span>{formatTodoStatus(status)}</span>
                <b>{columnTodos.length}</b>
                <button
                  type="button"
                  className="column-move"
                  disabled={visibleStatuses[0] === status}
                  onClick={(event) => {
                    event.stopPropagation();
                    nudgeStatus(status, -1);
                  }}
                  aria-label={`Move ${formatTodoStatus(status)} left`}
                >
                  &lt;
                </button>
                <button
                  type="button"
                  className="column-move"
                  disabled={visibleStatuses.at(-1) === status}
                  onClick={(event) => {
                    event.stopPropagation();
                    nudgeStatus(status, 1);
                  }}
                  aria-label={`Move ${formatTodoStatus(status)} right`}
                >
                  &gt;
                </button>
                {canRemoveStatus ? (
                  <button
                    type="button"
                    className="column-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeStatus(status);
                    }}
                    aria-label={`Remove ${formatTodoStatus(status)} column`}
                  >
                    x
                  </button>
                ) : null}
              </div>
              {columnTodos.length ? (
                columnTodos.map((todo) => (
                  <article
                    className={`todo-item ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                    key={todo.id}
                    draggable
                    onDragStart={(event) => {
                      event.stopPropagation();
                      setDraggedTodoId(todo.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDraggedTodoId(null);
                      setDropStatus(null);
                    }}
                    onClick={() => setDraftTodo(todo)}
                  >
                    <div className="todo-card-topline">
                      <span className="todo-drag-grip" aria-hidden="true">drag</span>
                      <div className="todo-card-title">{todo.title}</div>
                    </div>
                    <div className="todo-card-meta">
                      <span>{todo.who || 'No owner'}</span>
                      {todo.dueDate ? <time>{todo.dueDate}</time> : <span>No due date</span>}
                    </div>
                    {todo.body.trim() ? <p className="todo-card-note">{todoExcerpt(todo.body)}</p> : null}
                    <div className="todo-meta">
                      <label className="check-control compact">
                        <input
                          type="checkbox"
                          checked={todo.showOnTimeline}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateTodo({ ...todo, showOnTimeline: event.target.checked })
                          }
                        />
                        Timeline
                      </label>
                      <button
                        type="button"
                        className="mini-button secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDraftTodo(todo);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          onChange(todos.filter((item) => item.id !== todo.id));
                        }}
                        aria-label={`Delete ${todo.title}`}
                      >
                        x
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="todo-empty">Drop here</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function compareTodos(a: TimelineTodo, b: TimelineTodo) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.title.localeCompare(b.title);
}

function todoExcerpt(markdown: string) {
  const plainText = markdown
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.length > 96 ? `${plainText.slice(0, 93)}...` : plainText;
}
