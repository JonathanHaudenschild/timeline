'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { MarkdownBlock } from './MarkdownBlock';
import { TodoEditor } from './TodoEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { defaultTodoStatuses, formatTodoStatus, isTodoCompleted, moveTodoWithinBoard, normalizeTodoStatus } from '@/lib/todos';
import { usePersistentState } from '@/lib/usePersistentState';

type TodoSortKey = 'manual' | 'due-date' | 'a-z' | 'owner' | 'created';

type TodoBoardProps = {
  todos: TimelineTodo[];
  statuses: TodoStatus[];
  completedTodoStatus: TodoStatus;
  boardId: string;
  boardName: string;
  boards: Array<{ id: string; name: string; locked?: boolean }>;
  selectedTodoId?: string;
  onTodoOpened?: () => void;
  onChange: (todos: TimelineTodo[]) => void;
  onMoveTodoToBoard: (todo: TimelineTodo, targetBoardId: string) => void;
  onConvertTodoToEvent: (todo: TimelineTodo) => void;
  onStatusesChange: (statuses: TodoStatus[]) => void;
  onRenameStatus: (fromStatus: TodoStatus, toStatus: TodoStatus) => void;
};

export function TodoBoard({
  todos,
  statuses,
  completedTodoStatus,
  boardId,
  boardName,
  boards,
  selectedTodoId,
  onTodoOpened,
  onChange,
  onMoveTodoToBoard,
  onConvertTodoToEvent,
  onStatusesChange,
  onRenameStatus,
}: TodoBoardProps) {
  const [draftTodo, setDraftTodo] = useState<TimelineTodo | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TodoStatus | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [editingStatus, setEditingStatus] = useState<TodoStatus | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [columnSortKeys, setColumnSortKeys] = usePersistentState<Record<TodoStatus, TodoSortKey>>(
    `timeline:ui:todo-column-sort:${boardId}`,
    {},
  );
  const [search, setSearch] = useState('');
  const selectedTodo = selectedTodoId ? todos.find((todo) => todo.id === selectedTodoId) ?? null : null;
  const activeDraftTodo = selectedTodo && selectedTodo.id !== draftTodo?.id ? selectedTodo : draftTodo;
  const editorDraftTodo = activeDraftTodo ? { ...activeDraftTodo, boardId: activeDraftTodo.boardId ?? boardId } : null;

  function addTodo(status: TodoStatus = visibleStatuses[0] ?? 'open') {
    setDraftTodo({
      id: crypto.randomUUID(),
      boardId,
      title: 'New todo',
      who: '',
      body: '- Add details',
      status,
      dueDate: '',
      showOnTimeline: true,
      order: nextTodoOrder(todos, status),
    });
  }

  function saveTodo(todoToSave: TimelineTodo | null) {
    if (!todoToSave) return;
    const targetBoardId = todoToSave.boardId ?? boardId;
    const todoForSave = { ...todoToSave, boardId: undefined };

    if (targetBoardId !== boardId) {
      onMoveTodoToBoard(todoForSave, targetBoardId);
      setDraftTodo(null);
      onTodoOpened?.();
      return;
    }

    const exists = todos.some((todo) => todo.id === todoToSave.id);
    onChange(exists ? todos.map((todo) => (todo.id === todoForSave.id ? todoForSave : todo)) : [...todos, todoForSave]);
    setDraftTodo(null);
    onTodoOpened?.();
  }

  function moveTodo(todoId: string, status: TodoStatus) {
    onChange(moveTodoWithinBoard(todos, todoId, status));
    setColumnSortKeys((sortKeys) => ({
      ...sortKeys,
      [status]: 'manual',
    }));
  }

  function moveTodoBefore(todoId: string, status: TodoStatus, targetTodoId: string) {
    if (todoId === targetTodoId) return;
    onChange(moveTodoWithinBoard(todos, todoId, status, targetTodoId));
    setColumnSortKeys((sortKeys) => ({
      ...sortKeys,
      [status]: 'manual',
    }));
  }

  function nudgeTodo(todoId: string, status: TodoStatus, direction: -1 | 1) {
    const columnTodoIds = todos
      .filter((todo) => todo.status === status)
      .sort(compareManualTodos)
      .map((todo) => todo.id);
    const index = columnTodoIds.indexOf(todoId);
    const targetIndex = index + direction;

    if (index === -1 || targetIndex < 0 || targetIndex >= columnTodoIds.length) return;

    const reorderedIds = [...columnTodoIds];
    const [movedId] = reorderedIds.splice(index, 1);
    reorderedIds.splice(targetIndex, 0, movedId);
    const nextOrder = new Map(reorderedIds.map((id, orderIndex) => [id, orderIndex + 1]));

    onChange(todos.map((todo) => (nextOrder.has(todo.id) ? { ...todo, order: nextOrder.get(todo.id)! } : todo)));
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

  function nudgeStatus(status: TodoStatus, direction: -1 | 1) {
    const index = visibleStatuses.indexOf(status);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= visibleStatuses.length) return;

    const reorderedStatuses = [...visibleStatuses];
    const [movedStatus] = reorderedStatuses.splice(index, 1);
    reorderedStatuses.splice(targetIndex, 0, movedStatus);
    onStatusesChange(reorderedStatuses);
  }

  return (
    <section className="todo-board">
      <div className="section-heading todo-board-heading">
        <div>
          <h2>{boardName}</h2>
          <div className="todo-board-summary">{totalOpen} open / {todos.length} total</div>
        </div>
        <div className="todo-board-actions">
          <label className="search-control todo-search-control">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Todo, owner, status"
            />
          </label>
          <details className="mobile-control-menu todo-mobile-menu">
            <summary>Actions</summary>
            <div className="mobile-control-panel">
              <StatusForm
                newStatus={newStatus}
                onNewStatusChange={setNewStatus}
                onAddStatus={addStatus}
              />
              <button type="button" onClick={() => addTodo()} aria-label="Add todo" title="Add todo">
                <Plus size={16} aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>
          </details>
          <div className="desktop-control-group todo-board-action-group">
            <StatusForm
              newStatus={newStatus}
              onNewStatusChange={setNewStatus}
              onAddStatus={addStatus}
            />
            <button
              type="button"
              className="icon-button todo-board-add-button"
              onClick={() => addTodo()}
              aria-label="Add todo"
              title="Add todo"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {editorDraftTodo ? (
        <TodoEditor
          draft={editorDraftTodo}
          statuses={visibleStatuses}
          boards={boards}
          onChange={setDraftTodo}
          onCancel={() => {
            setDraftTodo(null);
            onTodoOpened?.();
          }}
          onSave={() => saveTodo(editorDraftTodo)}
          onConvertToEvent={() => {
            onConvertTodoToEvent(editorDraftTodo);
            setDraftTodo(null);
            onTodoOpened?.();
          }}
        />
      ) : null}
      <div className="todo-columns">
        {visibleStatuses.map((status) => {
          const allColumnTodos = todos.filter((todo) => todo.status === status).sort(compareManualTodos);
          const columnSortKey = columnSortKeys[status] ?? 'manual';
          const columnTodos = filteredTodos
            .filter((todo) => todo.status === status)
            .sort((a, b) => compareTodos(a, b, columnSortKey));
          const canRemoveStatus = !defaultTodoStatuses.includes(status) && allColumnTodos.length === 0;

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
                const droppedTodoId = draggedTodoId ?? event.dataTransfer.getData('text/plain');
                if (droppedTodoId) moveTodo(droppedTodoId, status);
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
                    <button type="submit" className="column-rename-action" aria-label="Save column name" title="Save">
                      ok
                    </button>
                    <button
                      type="button"
                      className="column-rename-action"
                      onClick={() => {
                        setEditingStatus(null);
                        setEditingStatusName('');
                      }}
                      aria-label="Cancel column rename"
                      title="Cancel"
                    >
                      x
                    </button>
                  </form>
                ) : (
                  <>
                    <span>{formatTodoStatus(status)}</span>
                    <b>{columnTodos.length}</b>
                    <button
                      type="button"
                      className="column-rename-trigger"
                      onClick={(event) => {
                        event.stopPropagation();
                        startRenameStatus(status);
                      }}
                      aria-label={`Rename ${formatTodoStatus(status)} column`}
                      title="Rename column"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="column-add"
                      onClick={(event) => {
                        event.stopPropagation();
                        addTodo(status);
                      }}
                      aria-label={`Add todo to ${formatTodoStatus(status)}`}
                      title="Add todo"
                    >
                      +
                    </button>
                  </>
                )}
                {editingStatus === status ? null : (
                  <>
                    <button
                      type="button"
                      className="column-move"
                      disabled={visibleStatuses[0] === status}
                      onClick={(event) => {
                        event.stopPropagation();
                        nudgeStatus(status, -1);
                      }}
                      aria-label={`Move ${formatTodoStatus(status)} left`}
                      title="Move column left"
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
                      title="Move column right"
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
                        title="Remove column"
                      >
                        x
                      </button>
                    ) : null}
                  </>
                )}
              </div>
              <label className="column-sort-control">
                <span>Sort</span>
                <select
                  value={columnSortKey}
                  onChange={(event) =>
                    setColumnSortKeys((sortKeys) => ({
                      ...sortKeys,
                      [status]: event.target.value as TodoSortKey,
                    }))
                  }
                >
                  <option value="manual">Manual</option>
                  <option value="due-date">Due date</option>
                  <option value="a-z">A-Z</option>
                  <option value="owner">Owner</option>
                  <option value="created">Created</option>
                </select>
              </label>
              {columnTodos.length ? (
                columnTodos.map((todo) => (
                  <article
                    className={`todo-item ${todoDueClass(todo, completedTodoStatus)} ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                    id={`todo-card-${todo.id}`}
                    key={todo.id}
                    draggable
                    onDragStart={(event) => {
                      event.stopPropagation();
                      setDraggedTodoId(todo.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', todo.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDropStatus(status);
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const droppedTodoId = draggedTodoId ?? event.dataTransfer.getData('text/plain');
                      if (droppedTodoId) moveTodoBefore(droppedTodoId, status, todo.id);
                      setDraggedTodoId(null);
                      setDropStatus(null);
                    }}
                    onDragEnd={() => {
                      setDraggedTodoId(null);
                      setDropStatus(null);
                    }}
                    onClick={() => setDraftTodo({ ...todo, boardId })}
                  >
                    <div className="todo-card-topline">
                      <div className="todo-card-title">{todo.title}</div>
                    </div>
                    {todo.who || todo.dueDate ? (
                      <div className="todo-card-meta">
                        {todo.who ? <span>{todo.who}</span> : null}
                        {todo.dueDate ? (
                          <time className={`todo-due-date ${todoDueClass(todo, completedTodoStatus)}`}>{formatTodoDueDate(todo.dueDate)}</time>
                        ) : null}
                      </div>
                    ) : null}
                    {todo.body.trim() ? (
                      <div className="todo-card-note">
                        <MarkdownBlock markdown={todo.body} />
                      </div>
                    ) : null}
                    <div className="todo-card-actions">
                      <button
                        type="button"
                        className="icon-button secondary"
                        disabled={allColumnTodos[0]?.id === todo.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          nudgeTodo(todo.id, status, -1);
                        }}
                        aria-label={`Move ${todo.title} up`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button secondary"
                        disabled={allColumnTodos.at(-1)?.id === todo.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          nudgeTodo(todo.id, status, 1);
                        }}
                        aria-label={`Move ${todo.title} down`}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-button secondary todo-edit-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDraftTodo({ ...todo, boardId });
                        }}
                        aria-label={`Edit ${todo.title}`}
                        title="Edit"
                      >
                        ✎
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
                        title="Delete"
                      >
                        x
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="todo-empty">Drop here</div>
              )}
              <button
                type="button"
                className="column-add-card"
                onClick={() => addTodo(status)}
                aria-label={`Add todo to ${formatTodoStatus(status)}`}
                title="Add todo"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add todo</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusForm({
  newStatus,
  onNewStatusChange,
  onAddStatus,
}: {
  newStatus: string;
  onNewStatusChange: (status: string) => void;
  onAddStatus: () => void;
}) {
  return (
    <form
      className="add-status-form"
      onSubmit={(event) => {
        event.preventDefault();
        onAddStatus();
      }}
    >
      <input
        value={newStatus}
        onChange={(event) => onNewStatusChange(event.target.value)}
        placeholder="New status"
        aria-label="New todo status"
      />
      <button type="submit" className="icon-button secondary add-status-button" aria-label="Add column" title="Add column">
        <Plus size={16} aria-hidden="true" />
      </button>
    </form>
  );
}

function compareTodos(a: TimelineTodo, b: TimelineTodo, sortKey: TodoSortKey) {
  if (sortKey === 'manual') return compareManualTodos(a, b);
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

function compareManualTodos(a: TimelineTodo, b: TimelineTodo) {
  const orderCompare = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  return orderCompare || a.id.localeCompare(b.id);
}

function nextTodoOrder(todos: readonly TimelineTodo[], status: TodoStatus) {
  const maxOrder = todos
    .filter((todo) => todo.status === status)
    .reduce((max, todo) => Math.max(max, todo.order ?? 0), 0);
  return maxOrder + 1;
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
