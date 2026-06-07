'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Columns3, Link2, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { FilterBadge } from './FilterBadge';
import { InlineTextInput, SearchInput, SelectField, TextField } from './FormControls';
import { MarkdownBlock } from './MarkdownBlock';
import { TodoEditor } from './TodoEditor';
import type { TimelineTodo, TodoStatus } from '@/lib/types';
import { createTimelineComment } from '@/lib/comments';
import {
  defaultTodoStatuses,
  formatTodoStatus,
  isTodoCompleted,
  moveTodoWithinBoard,
  normalizeTodo,
  normalizeTodoStatus,
  normalizeTodoTags,
  touchTodo,
} from '@/lib/todos';
import { cn } from '@/lib/cn';
import { uiCard, uiSurface } from '@/lib/ui';
import { usePersistentState } from '@/lib/usePersistentState';

type TodoSortKey = 'manual' | 'due-date' | 'a-z' | 'owner' | 'created';

const todoBoardClass =
  `${uiSurface} min-w-0 max-w-full overflow-visible p-3.5 max-sm:p-2.5`;
const todoHeadingClass =
  'relative z-[5] mb-0.5 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3 pb-2 max-sm:z-[5] max-sm:grid-cols-1 max-sm:items-stretch max-sm:gap-2';
const todoActionsClass =
  'flex min-w-0 items-end justify-end gap-2 flex-wrap max-sm:grid max-sm:w-full max-sm:grid-cols-1 max-sm:items-stretch';
const todoActionGroupClass =
  'inline-flex min-w-0 items-center gap-1.5';
const todoActionIconsClass =
  'mobile-action-icons inline-flex min-w-0 items-center gap-1 max-sm:grid max-sm:w-full max-sm:grid-cols-[repeat(auto-fit,minmax(36px,1fr))]';
const todoColumnsClass =
  'relative z-[2] mt-[-12px] flex w-full max-w-full min-w-0 gap-2.5 overflow-x-auto overflow-y-visible overscroll-x-contain py-[18px] pr-0 pb-2.5 pl-0 [scroll-snap-type:x_proximity] [scrollbar-gutter:stable] max-sm:z-[1] max-sm:grid max-sm:grid-cols-1 max-sm:gap-2 max-sm:overflow-visible max-sm:px-0 max-sm:[scroll-snap-type:none]';
const todoColumnClass =
  `${uiCard} relative min-h-[150px] min-w-[300px] flex-[0_0_300px] overflow-visible border-[rgba(36,34,29,0.22)] bg-[#fbfee9] p-[9px] shadow-[inset_0_3px_0_rgba(36,34,29,0.18),0_6px_14px_rgba(36,34,29,0.05)] [scroll-snap-align:start] hover:z-20 focus-within:z-20 max-sm:w-full max-sm:min-w-0 max-sm:scroll-snap-align-none max-sm:py-[7px] max-sm:pr-[7px] max-sm:pb-[7px] max-sm:pl-3`;
const columnTitleClass =
  'relative z-[3] mb-[4px] grid items-end gap-2 bg-transparent pt-1 pb-[7px] text-[11px] font-black text-[var(--text)] uppercase shadow-none max-sm:gap-1.5';
const columnTitleLabelClass =
  'flex min-w-0 items-center gap-1.5 rounded-[2px] border border-[rgba(36,34,29,0.16)] bg-[#f5fbdc] px-1.5 py-1';
const columnTitleActionsClass =
  'column-title-actions-row inline-flex min-w-0 items-center justify-end gap-1 max-[420px]:justify-start';
const columnMiniButtonClass =
  'icon-button relative inline-grid h-5 max-h-5 min-h-5 w-5 min-w-5 place-items-center rounded-[2px] border border-[rgba(36,34,29,0.22)] bg-[#fffdf8] p-0 text-[10px] leading-none shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35 disabled:transform-none';
const columnCountClass =
  'inline-grid h-6 max-h-6 min-h-6 w-6 min-w-6 place-items-center rounded-[2px] border border-[rgba(36,34,29,0.18)] bg-[#fbfee9] text-[10px] leading-none font-black text-[var(--muted)] shadow-none';
const columnAddCardClass =
  'column-add-card relative mb-2.5 ml-auto mt-[-2px] inline-flex min-h-[var(--icon-button-size)] w-full items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-[rgba(36,34,29,0.34)] bg-white px-2 text-[11px] font-black text-[var(--muted)] uppercase shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)] hover:text-[var(--text)]';

type TodoBoardProps = {
  todos: TimelineTodo[];
  statuses: TodoStatus[];
  completedTodoStatus: TodoStatus;
  boardId: string;
  boardName: string;
  boards: Array<{ id: string; name: string; locked?: boolean }>;
  canEdit?: boolean;
  selectedTodoId?: string;
  onTodoOpened?: () => void;
  onChange: (todos: TimelineTodo[]) => void;
  onMoveTodoToBoard: (todo: TimelineTodo, targetBoardId: string) => void;
  onConvertTodoToEvent: (todo: TimelineTodo) => boolean | void | Promise<boolean | void>;
  onOpenProtocolItem?: (todo: TimelineTodo) => void;
  onStatusesChange: (statuses: TodoStatus[]) => void;
  onRenameStatus: (fromStatus: TodoStatus, toStatus: TodoStatus) => void;
  renderBoardActions?: () => ReactNode;
};

export function TodoBoard({
  todos,
  statuses,
  completedTodoStatus,
  boardId,
  boardName,
  boards,
  canEdit = false,
  selectedTodoId,
  onTodoOpened,
  onChange,
  onMoveTodoToBoard,
  onConvertTodoToEvent,
  onOpenProtocolItem,
  onStatusesChange,
  onRenameStatus,
  renderBoardActions,
}: TodoBoardProps) {
  const appDialog = useAppDialog();
  const [draftTodo, setDraftTodo] = useState<TimelineTodo | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TodoStatus | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [editingStatus, setEditingStatus] = useState<TodoStatus | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [columnSortKeys, setColumnSortKeys] = usePersistentState<Record<TodoStatus, TodoSortKey>>(
    `timeline:ui:todo-column-sort:${boardId}`,
    {},
  );
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = usePersistentState(`timeline:ui:todo-tag-filter:${boardId}`, '');
  const [whoFilter, setWhoFilter] = usePersistentState(`timeline:ui:todo-who-filter:${boardId}`, '');
  const selectedTodo = selectedTodoId ? todos.find((todo) => todo.id === selectedTodoId) ?? null : null;
  const activeDraftTodo = selectedTodo && selectedTodo.id !== draftTodo?.id ? selectedTodo : draftTodo;
  const editorDraftTodo = activeDraftTodo ? { ...activeDraftTodo, boardId: activeDraftTodo.boardId ?? boardId } : null;
  const availableTags = useMemo(
    () =>
      normalizeTodoTags(todos.flatMap((todo) => todo.tags ?? []))
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' })),
    [todos],
  );
  const availableOwners = useMemo(
    () =>
      uniqueStrings(todos.map((todo) => todo.who))
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' })),
    [todos],
  );

  function addTodo(status: TodoStatus = visibleStatuses[0] ?? 'open') {
    const now = new Date().toISOString();
    setDraftTodo({
      id: crypto.randomUUID(),
      boardId,
      title: 'New todo',
      who: '',
      body: '- Add details',
      status,
      dueDate: '',
      createdAt: now,
      updatedAt: now,
      tags: [],
      showOnTimeline: true,
      order: nextTodoOrder(todos, status),
    });
  }

  function saveTodo(todoToSave: TimelineTodo | null) {
    if (!todoToSave) return;
    const targetBoardId = todoToSave.boardId ?? boardId;
    const todoForSave = normalizeTodo(touchTodo({ ...todoToSave, boardId: undefined }));

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

  async function deleteTodo(todoToDelete: TimelineTodo) {
    if (
      !(await appDialog.confirm({
        title: 'Delete todo?',
        message: `Delete todo "${todoToDelete.title || 'New todo'}"?`,
        confirmLabel: 'Delete todo',
        tone: 'danger',
      }))
    ) {
      return;
    }
    onChange(todos.filter((todo) => todo.id !== todoToDelete.id));
    setDraftTodo(null);
    onTodoOpened?.();
  }

  function confirmRemoveStatus(status: TodoStatus) {
    return appDialog.confirm({
      title: 'Remove column?',
      message: `Remove "${formatTodoStatus(status)}" column?`,
      confirmLabel: 'Remove column',
      tone: 'danger',
    });
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

  async function addTodoComment(todo: TimelineTodo) {
    const body = await appDialog.prompt({
      title: 'Add comment',
      label: 'Comment',
      confirmLabel: 'Add comment',
      confirmIcon: <MessageCircle size={18} aria-hidden="true" />,
      cancelIcon: <X size={18} aria-hidden="true" />,
    });
    if (!body?.trim()) return;

    const now = new Date().toISOString();
    const nextTodo = touchTodo({
      ...todo,
      comments: [...(todo.comments ?? []), createTimelineComment(body, now)],
    }, now);

    onChange(todos.map((item) => (item.id === todo.id ? nextTodo : item)));
  }

  const totalOpen = todos.filter((todo) => !isTodoCompleted(todo, completedTodoStatus)).length;
  const visibleStatuses = statuses.length ? statuses : defaultTodoStatuses;
  const filteredTodos = todos.filter((todo) =>
    todoMatchesSearch(todo, search) &&
    todoMatchesTag(todo, tagFilter) &&
    todoMatchesWho(todo, whoFilter),
  );
  const hasActiveFilter = Boolean(search.trim()) || Boolean(tagFilter.trim()) || Boolean(whoFilter.trim());

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
    <section className={todoBoardClass}>
      <div className={todoHeadingClass}>
        <div>
          <h2 className="m-0 text-[13px] font-black uppercase tracking-normal">{boardName}</h2>
          <div className="mt-px text-[11px] font-black text-[var(--muted)] uppercase">
            {totalOpen} open / {todos.length} total
          </div>
        </div>
        <div className={todoActionsClass}>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Todo, owner, status, tag"
            className="todo-search-control flex-[1_1_320px] sm:max-w-[380px] max-sm:max-w-none"
          />
          <SelectField
            label="Tag"
            value={tagFilter}
            onValueChange={setTagFilter}
            className="todo-tag-filter-control flex-[0_1_240px] sm:max-w-[240px] max-sm:max-w-none"
          >
              <option value="">All tags</option>
              {tagFilter && !availableTags.some((tag) => tagsEqual(tag, tagFilter)) ? (
                <option value={tagFilter}>{tagFilter}</option>
              ) : null}
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
          </SelectField>
          <SelectField
            label="Who"
            value={whoFilter}
            onValueChange={setWhoFilter}
            className="todo-who-filter-control flex-[0_1_220px] sm:max-w-[220px] max-sm:max-w-none"
          >
              <option value="">All people</option>
              {whoFilter && !availableOwners.some((owner) => namesEqual(owner, whoFilter)) ? (
                <option value={whoFilter}>{whoFilter}</option>
              ) : null}
              {availableOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
          </SelectField>
          <FilterBadge
            active={hasActiveFilter}
            label={`${filteredTodos.length} / ${todos.length}`}
            detail="Todo filters active"
            onClear={() => {
              setSearch('');
              setTagFilter('');
              setWhoFilter('');
            }}
            clearLabel="Clear todo filters"
            className="max-sm:w-full"
          />
          <details className="mobile-control-menu todo-mobile-menu">
            <summary>Actions</summary>
              <div className="mobile-control-panel">
                {renderBoardActions ? (
                <div className={todoActionIconsClass}>{renderBoardActions()}</div>
              ) : null}
              {canEdit ? (
                <StatusForm
                  newStatus={newStatus}
                  onNewStatusChange={setNewStatus}
                  onAddStatus={addStatus}
                />
              ) : null}
              <button type="button" onClick={() => addTodo()} aria-label="Add todo" title="Add todo">
                <Plus size={16} aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>
          </details>
          <div className={`desktop-control-group ${todoActionGroupClass}`}>
            {canEdit ? (
              <StatusForm
                newStatus={newStatus}
                onNewStatusChange={setNewStatus}
                onAddStatus={addStatus}
              />
            ) : null}
            <button
              type="button"
              className="icon-button h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
              onClick={() => addTodo()}
              aria-label="Add todo"
              title="Add todo"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            {renderBoardActions ? (
              <div className={todoActionIconsClass}>{renderBoardActions()}</div>
            ) : null}
          </div>
        </div>
      </div>
      {editorDraftTodo ? (
        <TodoEditor
          draft={editorDraftTodo}
          statuses={visibleStatuses}
          boards={boards}
          availableTags={availableTags}
          onChange={setDraftTodo}
          onCancel={() => {
            setDraftTodo(null);
            onTodoOpened?.();
          }}
          onSave={(todoToSave) => saveTodo(todoToSave ?? editorDraftTodo)}
          onDelete={() => void deleteTodo(editorDraftTodo)}
          onConvertToEvent={async () => {
            const converted = await onConvertTodoToEvent(editorDraftTodo);
            if (converted === false) return;
            setDraftTodo(null);
            onTodoOpened?.();
          }}
        />
      ) : null}
      <div className={todoColumnsClass}>
        {visibleStatuses.map((status, colIndex) => {
          const allColumnTodos = todos.filter((todo) => todo.status === status).sort(compareManualTodos);
          const columnSortKey = columnSortKeys[status] ?? 'manual';
          const columnTodos = filteredTodos
            .filter((todo) => todo.status === status)
            .sort((a, b) => compareTodos(a, b, columnSortKey));
          const canRemoveStatus = !defaultTodoStatuses.includes(status) && allColumnTodos.length === 0;

          return (
            <div
              className={cn(
                todoColumnClass,
                dropStatus === status &&
                  'bg-[#fff8d8] outline outline-3 outline-[var(--hot)] outline-offset-[-6px]',
              )}
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setDropStatus(status);
              }}
              onDragLeave={() => { setDropStatus(null); setDropTargetId(null); }}
              onDrop={(event) => {
                event.preventDefault();
                const droppedTodoId = draggedTodoId ?? event.dataTransfer.getData('text/plain');
                if (droppedTodoId) moveTodo(droppedTodoId, status);
                setDraggedTodoId(null);
                setDropStatus(null);
                setDropTargetId(null);
              }}
            >
              <div className={`${columnTitleClass} ${canEdit ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1'}`}>
                {editingStatus === status ? (
	                  <form
	                    className="col-span-full grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 max-sm:grid-cols-[minmax(0,1fr)_repeat(3,28px)]"
	                    onSubmit={(event) => {
	                      event.preventDefault();
	                      renameStatus(status);
                    }}
                  >
                    <InlineTextInput
                      className="min-h-7 px-1.5 py-1 text-xs"
                      value={editingStatusName}
                      onValueChange={setEditingStatusName}
                      autoFocus
                      aria-label={`Rename ${formatTodoStatus(status)} column`}
                    />
	                    <button
	                      type="submit"
	                      className={columnMiniButtonClass}
	                      aria-label="Save column name"
	                      title="Save"
	                    >
	                      ok
	                    </button>
	                    <button
	                      type="button"
	                      className={columnMiniButtonClass}
	                      onClick={() => {
	                        setEditingStatus(null);
	                        setEditingStatusName('');
                      }}
                      aria-label="Cancel column rename"
                      title="Cancel"
	                    >
	                      x
	                    </button>
	                    {canRemoveStatus ? (
	                      <button
	                        type="button"
	                        className={`column-remove ${columnMiniButtonClass} danger`}
	                        onClick={(event) => {
	                          event.stopPropagation();
	                          void confirmRemoveStatus(status).then((confirmed) => {
	                            if (confirmed) {
	                              removeStatus(status);
	                              setEditingStatus(null);
	                              setEditingStatusName('');
	                            }
	                          });
	                        }}
	                        aria-label={`Remove ${formatTodoStatus(status)} column`}
	                        title="Remove column"
	                      >
	                        <X size={13} aria-hidden="true" />
	                      </button>
	                    ) : null}
	                  </form>
                ) : (
                  <>
                    <div className={columnTitleLabelClass}>
                      <span className="min-w-0 flex-1 break-words">{formatTodoStatus(status)}</span>
                      <b className={columnCountClass}>
                        {columnTodos.length}
                      </b>
                    </div>
                    {canEdit ? (
                      <div className={columnTitleActionsClass}>
                        <button
                          type="button"
                          className={`column-rename-trigger ${columnMiniButtonClass}`}
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
                          className={`column-add ${columnMiniButtonClass} bg-[var(--primary)] text-[var(--text)]`}
                          onClick={(event) => {
                            event.stopPropagation();
                            addTodo(status);
                          }}
                          aria-label={`Add todo to ${formatTodoStatus(status)}`}
                          title="Add todo"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`column-move ${columnMiniButtonClass}`}
                          disabled={visibleStatuses[0] === status}
                          onClick={(event) => {
                            event.stopPropagation();
                            nudgeStatus(status, -1);
                          }}
                          aria-label={`Move ${formatTodoStatus(status)} left`}
                          title="Move column left"
                        >
                          <ArrowLeft size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`column-move ${columnMiniButtonClass}`}
                          disabled={visibleStatuses.at(-1) === status}
                          onClick={(event) => {
                            event.stopPropagation();
                            nudgeStatus(status, 1);
                          }}
                          aria-label={`Move ${formatTodoStatus(status)} right`}
                          title="Move column right"
                        >
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              <SelectField
                label="Sort"
                value={columnSortKey}
                onValueChange={(sortKey) =>
                  setColumnSortKeys((sortKeys) => ({
                    ...sortKeys,
                    [status]: sortKey as TodoSortKey,
                  }))
                }
                className="mb-[9px] mt-[-4px] w-full max-w-none"
              >
                <option value="manual">Manual</option>
                <option value="due-date">Due date</option>
                <option value="a-z">A-Z</option>
                <option value="owner">Owner</option>
                <option value="created">Created</option>
              </SelectField>
              {columnTodos.length ? (
                columnTodos.map((todo) => (
                  <Fragment key={todo.id}>
                    {dropTargetId === todo.id && draggedTodoId !== todo.id ? (
                      <div className="todo-drop-indicator" aria-hidden="true" />
                    ) : null}
                    <article
                      className={`todo-item ${todo.protocolId ? 'linked' : ''} ${todoDueClass(todo, completedTodoStatus)} ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                      id={`todo-card-${todo.id}`}
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
                        setDropTargetId(todo.id);
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const droppedTodoId = draggedTodoId ?? event.dataTransfer.getData('text/plain');
                        if (droppedTodoId) moveTodoBefore(droppedTodoId, status, todo.id);
                        setDraggedTodoId(null);
                        setDropStatus(null);
                        setDropTargetId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedTodoId(null);
                        setDropStatus(null);
                        setDropTargetId(null);
                      }}
                    onClick={() => setDraftTodo({ ...todo, boardId })}
                  >
                    <div className="todo-card-topline">
                      <div className="todo-card-title">{todo.title}</div>
                      {todo.protocolId ? (
                        <button
                          type="button"
                          className="todo-linked-badge"
                          title="Open linked protocol item"
                          aria-label="Open linked protocol item"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenProtocolItem?.(todo);
                          }}
                        >
                          <Link2 size={12} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    {todo.who || todo.dueDate ? (
                      <div className="todo-card-meta">
                        {todo.who ? <span>{todo.who}</span> : null}
                        {todo.dueDate ? (
                          <time className={`todo-due-date ${todoDueClass(todo, completedTodoStatus)}`}>{formatTodoDueDate(todo.dueDate)}</time>
                        ) : null}
                      </div>
                    ) : null}
                    {todo.tags?.length ? (
                      <div className="todo-card-tags" aria-label="Todo tags">
                        {normalizeTodoTags(todo.tags).map((tag) => (
                          <button
                            type="button"
                            className={`todo-tag-chip ${tagsEqual(tag, tagFilter) ? 'active' : ''}`}
                            key={tag}
                            onClick={(event) => {
                              event.stopPropagation();
                              setTagFilter(tagsEqual(tag, tagFilter) ? '' : tag);
                            }}
                            aria-label={`Filter by tag ${tag}`}
                            title="Filter by tag"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {todo.body.trim() ? (
                      <div className="todo-card-note">
                        <MarkdownBlock
                          markdown={todo.body}
                          onTaskToggle={canEdit ? (lineIndex) => {
                            onChange(todos.map((item) =>
                              item.id === todo.id
                                ? touchTodo({ ...item, body: toggleMarkdownTask(item.body, lineIndex) })
                                : item,
                            ));
                          } : undefined}
                        />
                      </div>
                    ) : null}
                    {todo.comments?.length ? (
                      <div className="card-comments" aria-label="Todo comments">
                        {todo.comments.map((comment) => (
                          <div className="card-comment" key={comment.id}>
                            <time dateTime={comment.createdAt}>{formatTodoUpdatedAt(comment.createdAt)}</time>
                            <span>{comment.body}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="todo-card-footer">
                      {todo.updatedAt || todo.createdAt ? (
                        <time className="todo-updated-meta" dateTime={todo.updatedAt ?? todo.createdAt}>
                          upd {formatTodoUpdatedAt(todo.updatedAt ?? todo.createdAt)}
                        </time>
                      ) : <span />}
                      <div className="todo-card-actions">
                        <button
                          type="button"
                          className="icon-button tertiary"
                          disabled={allColumnTodos[0]?.id === todo.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            nudgeTodo(todo.id, status, -1);
                          }}
                          aria-label={`Move ${todo.title} up`}
                          title="Move up"
                        >
                          <ArrowUp size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button tertiary"
                          disabled={allColumnTodos.at(-1)?.id === todo.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            nudgeTodo(todo.id, status, 1);
                          }}
                          aria-label={`Move ${todo.title} down`}
                          title="Move down"
                        >
                          <ArrowDown size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button tertiary todo-edit-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDraftTodo({ ...todo, boardId });
                          }}
                          aria-label={`Edit ${todo.title}`}
                          title="Edit"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button tertiary"
                          onClick={(event) => {
                            event.stopPropagation();
                            void addTodoComment(todo);
                          }}
                          aria-label={`Comment on ${todo.title}`}
                          title="Comment"
                        >
                          <MessageCircle size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            void appDialog
                              .confirm({
                                title: 'Delete todo?',
                                message: `Delete "${todo.title}"?`,
                                confirmLabel: 'Delete todo',
                                tone: 'danger',
                              })
                              .then((confirmed) => {
                                if (confirmed) onChange(todos.filter((item) => item.id !== todo.id));
                              });
                          }}
                          aria-label={`Delete ${todo.title}`}
                          title="Delete"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    </article>
                  </Fragment>
                ))
              ) : (
                <div className="grid min-h-[58px] place-items-center rounded-[2px] border border-dashed border-[#8f897a] text-[12px] font-black uppercase text-[var(--muted)] mb-2">Drop here</div>
              )}
                <button
                  type="button"
                  className={columnAddCardClass}
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
      {appDialog.dialog}
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
      className="flex w-auto min-w-0 items-center gap-1.5 max-sm:w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onAddStatus();
      }}
    >
      <TextField
        label="New status"
        hideLabel
        value={newStatus}
        onValueChange={onNewStatusChange}
        placeholder="New status"
        aria-label="New todo status"
        className="w-[150px] max-sm:min-w-0 max-sm:flex-1"
      />
      <button
        type="submit"
        className="icon-button secondary h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
        aria-label="Add column"
        title="Add column"
      >
        <Columns3 size={16} aria-hidden="true" />
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

function formatTodoUpdatedAt(value: string | undefined) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const time = formatClockTime(date);
  if (localDateString(date) === localDateString(new Date())) return time;

  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')} ${time}`;
}

function toggleMarkdownTask(markdown: string, lineIndex: number) {
  return markdown
    .split('\n')
    .map((line, index) => {
      if (index !== lineIndex) return line;

      return line.replace(/^(\s*[-*]\s+\[)([ xX])(\]\s+)/, (_match, prefix: string, checked: string, suffix: string) =>
        `${prefix}${checked.toLowerCase() === 'x' ? ' ' : 'x'}${suffix}`,
      );
    })
    .join('\n');
}

function formatClockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
    ...(todo.comments ?? []).map((comment) => comment.body),
    todo.status,
    todo.dueDate ?? '',
    ...(todo.tags ?? []),
    formatTodoStatus(todo.status),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function todoMatchesTag(todo: TimelineTodo, tagFilter: string) {
  const filter = tagFilter.trim();
  if (!filter) return true;

  return normalizeTodoTags(todo.tags).some((tag) => tagsEqual(tag, filter));
}

function todoMatchesWho(todo: TimelineTodo, whoFilter: string) {
  const filter = whoFilter.trim();
  if (!filter) return true;

  return namesEqual(todo.who, filter);
}

function tagsEqual(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function namesEqual(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function uniqueStrings(values: string[]) {
  const unique = new Map<string, string>();

  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized) return;

    const key = normalized.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, normalized);
  });

  return [...unique.values()];
}
