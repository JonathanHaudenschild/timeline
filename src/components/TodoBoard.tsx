'use client';

import { useState } from 'react';
import { MarkdownBlock } from './MarkdownBlock';
import { TodoEditor } from './TodoEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { defaultTodoStatuses, formatTodoStatus, isTodoCompleted, normalizeTodoStatus } from '@/lib/todos';

type TodoSortKey = 'due-date' | 'a-z' | 'owner' | 'created';

type TodoBoardProps = {
  todos: TimelineTodo[];
  statuses: TodoStatus[];
  completedTodoStatus: TodoStatus;
  selectedTodoId?: string;
  onTodoOpened?: () => void;
  onChange: (todos: TimelineTodo[]) => void;
  onStatusesChange: (statuses: TodoStatus[]) => void;
  onRenameStatus: (fromStatus: TodoStatus, toStatus: TodoStatus) => void;
};

export function TodoBoard({
  todos,
  statuses,
  completedTodoStatus,
  selectedTodoId,
  onTodoOpened,
  onChange,
  onStatusesChange,
  onRenameStatus,
}: TodoBoardProps) {
  const [draftTodo, setDraftTodo] = useState<TimelineTodo | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TodoStatus | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [editingStatus, setEditingStatus] = useState<TodoStatus | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [sortKey, setSortKey] = useState<TodoSortKey>('due-date');
  const [search, setSearch] = useState('');
  const selectedTodo = selectedTodoId ? todos.find((todo) => todo.id === selectedTodoId) ?? null : null;
  const activeDraftTodo = selectedTodo && selectedTodo.id !== draftTodo?.id ? selectedTodo : draftTodo;

  function addTodo() {
    setDraftTodo({
      id: crypto.randomUUID(),
      title: 'New todo',
      who: '',
      body: '- Add details',
      status: 'open',
      dueDate: '',
      showOnTimeline: true,
    });
  }

  function saveTodo(todoToSave: TimelineTodo | null) {
    if (!todoToSave) return;
    const exists = todos.some((todo) => todo.id === todoToSave.id);
    onChange(exists ? todos.map((todo) => (todo.id === todoToSave.id ? todoToSave : todo)) : [...todos, todoToSave]);
    setDraftTodo(null);
    onTodoOpened?.();
  }

  function moveTodo(todoId: string, status: TodoStatus) {
    onChange(todos.map((todo) => (todo.id === todoId ? { ...todo, status } : todo)));
  }

  const totalOpen = todos.filter((todo) => !isTodoCompleted(todo, completedTodoStatus)).length;
  const visibleStatuses = statuses.length ? statuses : defaultTodoStatuses;
  const filteredTodos = todos.filter((todo) => todoMatchesSearch(todo, search));

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

  function startRenameStatus(status: TodoStatus) {
    setEditingStatus(status);
    setEditingStatusName(formatTodoStatus(status));
  }

  function renameStatus(status: TodoStatus) {
    const nextStatus = normalizeTodoStatus(editingStatusName);
    if (!nextStatus || nextStatus === status) {
      setEditingStatus(null);
      return;
    }

    if (visibleStatuses.includes(nextStatus)) return;

    onRenameStatus(status, nextStatus);
    setEditingStatus(null);
    setEditingStatusName('');
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
          <label className="todo-sort-control">
            <span>Sort</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as TodoSortKey)}>
              <option value="due-date">Due date</option>
              <option value="a-z">A-Z</option>
              <option value="owner">Owner</option>
              <option value="created">Created</option>
            </select>
          </label>
          <label className="search-control todo-search-control">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Todo, owner, status"
            />
          </label>
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
      {activeDraftTodo ? (
        <TodoEditor
          draft={activeDraftTodo}
          statuses={visibleStatuses}
          onChange={setDraftTodo}
          onCancel={() => {
            setDraftTodo(null);
            onTodoOpened?.();
          }}
          onSave={() => saveTodo(activeDraftTodo)}
        />
      ) : null}
      <div className="todo-columns">
        {visibleStatuses.map((status) => {
          const columnTodos = filteredTodos
            .filter((todo) => todo.status === status)
            .sort((a, b) => compareTodos(a, b, sortKey));
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
                {editingStatus === status ? (
                  <form
                    className="column-rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      renameStatus(status);
                    }}
                  >
                    <input
                      value={editingStatusName}
                      onChange={(event) => setEditingStatusName(event.target.value)}
                      autoFocus
                      aria-label={`Rename ${formatTodoStatus(status)} column`}
                    />
                    <button type="submit" className="column-move">ok</button>
                    <button
                      type="button"
                      className="column-move"
                      onClick={() => {
                        setEditingStatus(null);
                        setEditingStatusName('');
                      }}
                    >
                      cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span>{formatTodoStatus(status)}</span>
                    <b>{columnTodos.length}</b>
                    <button
                      type="button"
                      className="column-move"
                      onClick={(event) => {
                        event.stopPropagation();
                        startRenameStatus(status);
                      }}
                      aria-label={`Rename ${formatTodoStatus(status)} column`}
                    >
                      edit
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="column-move"
                  disabled={editingStatus === status || visibleStatuses[0] === status}
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
                  disabled={editingStatus === status || visibleStatuses.at(-1) === status}
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
                      if (window.confirm(`Remove "${formatTodoStatus(status)}" column?`)) {
                        removeStatus(status);
                      }
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
                    className={`todo-item ${todoDueClass(todo, completedTodoStatus)} ${draggedTodoId === todo.id ? 'dragging' : ''}`}
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
                      {todo.dueDate ? (
                        <time className={`todo-due-date ${todoDueClass(todo, completedTodoStatus)}`}>{formatTodoDueDate(todo.dueDate)}</time>
                      ) : (
                        <span>No due date</span>
                      )}
                    </div>
                    {todo.body.trim() ? (
                      <div className="todo-card-note">
                        <MarkdownBlock markdown={todo.body} />
                      </div>
                    ) : null}
                    <div className="todo-meta">
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
                          if (window.confirm(`Delete "${todo.title}"?`)) {
                            onChange(todos.filter((item) => item.id !== todo.id));
                          }
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

function compareTodos(a: TimelineTodo, b: TimelineTodo, sortKey: TodoSortKey) {
  if (sortKey === 'created') return a.id.localeCompare(b.id);
  if (sortKey === 'a-z') return compareText(a.title, b.title);
  if (sortKey === 'owner') {
    const ownerCompare = compareText(a.who || 'zzzz', b.who || 'zzzz');
    return ownerCompare || compareText(a.title, b.title);
  }

  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return compareText(a.title, b.title);
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function todoDueClass(todo: TimelineTodo, completedTodoStatus: string) {
  if (isTodoCompleted(todo, completedTodoStatus)) return 'done';
  if (!todo.dueDate) return 'no-due';

  const today = localDateString(new Date());
  if (todo.dueDate < today) return 'overdue';

  const daysUntilDue = Math.ceil((new Date(`${todo.dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  if (daysUntilDue <= 1) return 'due-soon';

  return 'scheduled';
}

function formatTodoDueDate(date: string) {
  const [, , month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${day}.${month}` : date;
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todoMatchesSearch(todo: TimelineTodo, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    todo.title,
    todo.who,
    todo.body,
    todo.status,
    todo.dueDate ?? '',
    formatTodoStatus(todo.status),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}
