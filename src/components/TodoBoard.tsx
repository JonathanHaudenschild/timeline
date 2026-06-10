'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Columns3, Link2, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { FilterBadge } from './FilterBadge';
import { InlineTextInput, SearchInput, SelectField } from './FormControls';
import { MarkdownBlock } from './MarkdownBlock';
import { TodoEditor } from './TodoEditor';
import type { TimelineComment, TimelineTodo, TodoStatus } from '@/lib/types';
import type { DuplicateCandidate } from '@/lib/duplicateHints';
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
import { extractTodoOwners, namesEqual, todoMatchesWho, uniquePeople } from '@/lib/todoFilters';
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

const todoActionIconsClass =
  'mobile-action-icons inline-flex min-w-0 items-center gap-1 max-sm:grid max-sm:w-full max-sm:grid-cols-[repeat(auto-fit,minmax(36px,1fr))]';
const todoColumnsClass =
  'relative z-2 mt-[-12px] flex w-full max-w-full min-w-0 gap-2.5 overflow-x-auto overflow-y-visible overscroll-x-contain py-[18px] pr-0 pb-2.5 pl-0 [scroll-snap-type:x_proximity] [scrollbar-gutter:stable] max-sm:z-[1] max-sm:grid max-sm:grid-cols-1 max-sm:gap-2 max-sm:overflow-visible max-sm:px-0 max-sm:[scroll-snap-type:none]';
const todoColumnClass =
  `${uiCard} relative min-h-[150px] min-w-[300px] flex-[0_0_300px] overflow-visible border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--tag-bg)] p-[9px] shadow-[inset_0_3px_0_color-mix(in_srgb,var(--line)_18%,transparent),0_6px_14px_color-mix(in_srgb,var(--line)_5%,transparent)] [scroll-snap-align:start] hover:z-20 focus-within:z-20 max-sm:w-full max-sm:min-w-0 max-sm:scroll-snap-align-none max-sm:py-[7px] max-sm:pr-[7px] max-sm:pb-[7px] max-sm:pl-3`;
const columnTitleClass =
  'relative z-[3] mb-[4px] grid items-end gap-2 bg-transparent pt-1 pb-[7px] text-[11px] font-black text-[var(--text)] uppercase shadow-none max-sm:gap-1.5';
const columnTitleLabelClass =
  'flex min-w-0 items-center gap-1.5 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_16%,transparent)] bg-[var(--tag-bg)] px-1.5 py-1';
const columnTitleActionsClass =
  'column-title-actions-row inline-flex min-w-0 items-center justify-end gap-1 max-[420px]:justify-start';
const columnMiniButtonClass =
  'icon-button relative inline-grid h-5 max-h-5 min-h-5 w-5 min-w-5 place-items-center rounded-[2px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] p-0 text-[10px] leading-none shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35 disabled:transform-none';
const columnCountClass =
  'inline-grid h-6 max-h-6 min-h-6 w-6 min-w-6 place-items-center rounded-[2px] border border-[color-mix(in_srgb,var(--line)_18%,transparent)] bg-[var(--tag-bg)] text-[10px] leading-none font-black text-[var(--muted)] shadow-none';
const columnAddCardClass =
  'column-add-card relative mb-2.5 ml-auto mt-[-2px] inline-flex min-h-[var(--icon-button-size)] w-full items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-[color-mix(in_srgb,var(--line)_34%,transparent)] bg-[var(--input-bg)] px-2 text-[11px] font-black text-[var(--muted)] uppercase shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)]';

// Inlined from .todo-card-topline
const todoCardToplineClass = 'flex items-start gap-2 max-sm:gap-1.5';

// Inlined from .todo-linked-badge + hover states
const todoLinkedBadgeClass =
  'inline-grid h-5 min-h-5 w-5 min-w-5 place-items-center rounded-[2px] border border-[color-mix(in_srgb,var(--line)_24%,transparent)] bg-[var(--primary)] p-0 text-[var(--on-primary)] shadow-none hover:border-[color-mix(in_srgb,var(--line)_38%,transparent)] hover:bg-[var(--primary-strong)]';

// Inlined from .todo-card-title
const todoCardTitleClass = 'min-w-0 flex-1 text-[14px] font-[950] leading-[1.15] [overflow-wrap:anywhere]';

// Inlined from .todo-card-meta + .todo-card-meta span/.todo-card-meta > span
const todoCardMetaClass = 'flex min-w-0 flex-wrap items-center justify-start gap-1 text-[9px] font-[900] uppercase text-[var(--muted)]';
const todoCardMetaSpanClass = 'min-w-0 [overflow-wrap:anywhere] border-0 bg-[var(--meta-bg)] px-[5px] py-px';

// Inlined from .todo-due-date (base) — variant classes applied conditionally
const todoBaseDueDateClass = 'min-w-0 [overflow-wrap:anywhere] rounded-[2px] border-0 px-[5px] py-px font-[950] leading-none';

// Inlined from .todo-card-tags
const todoCardTagsClass = '-mt-px flex min-w-0 flex-wrap items-center gap-1';

// Inlined from .todo-tag-chip + active/hover
const todoTagChipBase =
  'inline-flex min-h-[19px] min-w-0 max-w-full items-center gap-1 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--tag-bg)] px-1.5 py-px text-[9px] font-[950] leading-[1.1] uppercase text-[var(--on-primary)] shadow-none hover:border-[color-mix(in_srgb,var(--line)_28%,transparent)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)]';
const todoTagChipActiveClass = 'border-[color-mix(in_srgb,var(--line)_28%,transparent)] bg-[var(--primary)] text-[var(--on-primary)]';

const todoCardNoteClass =
  'max-h-[72px] overflow-auto bg-transparent pt-[2px]';

// Inlined from .card-comments
const cardCommentsClass = 'mt-2 grid gap-[5px]';

// Inlined from .card-comment
const cardCommentClass =
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_16%,transparent)] bg-[var(--input-bg)] px-1.5 py-[5px] text-[11px] leading-[1.35]';

// Inlined from .card-comment time
const cardCommentTimeClass = 'whitespace-nowrap text-[10px] font-[950] leading-[1.35] uppercase text-[var(--muted)]';

// Inlined from .card-comment span
const cardCommentBodyClass = 'min-w-0 [overflow-wrap:anywhere]';

// Inlined from .card-comment-delete (size overrides; tone handled by icon-button danger)
const cardCommentDeleteClass = 'icon-button danger h-4 min-h-4 w-4 min-w-4 border-0 bg-transparent p-0 shadow-none';

// Inlined from .todo-card-footer
const todoCardFooterClass = 'flex min-h-7 flex-wrap items-end justify-between gap-1.5';

// Inlined from .todo-updated-meta
const todoUpdatedMetaClass = 'min-w-0 whitespace-nowrap text-[8px] font-[700] normal-case text-[var(--muted)]';

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
  duplicateCandidates?: DuplicateCandidate[];
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
  duplicateCandidates = [],
}: TodoBoardProps) {
  const appDialog = useAppDialog();
  const [draftTodo, setDraftTodo] = useState<TimelineTodo | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TodoStatus | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
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
      uniquePeople(todos.flatMap((todo) => extractTodoOwners(todo.who)))
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

  async function deleteTodoComment(todo: TimelineTodo, comment: TimelineComment) {
    if (
      !(await appDialog.confirm({
        title: 'Delete comment?',
        message: 'Delete this comment?',
        confirmLabel: 'Delete comment',
        tone: 'danger',
        cancelIcon: <X size={18} aria-hidden="true" />,
        confirmIcon: <Trash2 size={18} aria-hidden="true" />,
      }))
    ) {
      return;
    }

    const now = new Date().toISOString();
    const nextTodo = touchTodo({
      ...todo,
      comments: todo.comments?.filter((item) => item.id !== comment.id),
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

  async function addStatus() {
    const name = await appDialog.prompt({
      title: 'Add column',
      label: 'Column name',
      placeholder: 'New status',
      confirmLabel: 'Add column',
      confirmIcon: <Columns3 size={18} aria-hidden="true" />,
      cancelIcon: <X size={18} aria-hidden="true" />,
    });
    const status = normalizeTodoStatus(name ?? '');
    if (!status || visibleStatuses.includes(status)) return;
    onStatusesChange([...visibleStatuses, status]);
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
          <details className="mobile-control-menu todo-mobile-menu relative sm:hidden">
            <summary className="min-h-[36px] inline-grid place-items-center border border-[color-mix(in_srgb,var(--line)_32%,transparent)] rounded-[2px] bg-[var(--primary)] text-[var(--on-primary)] shadow-[var(--punk-shadow)] cursor-pointer text-[12px] font-[950] list-none px-[10px] uppercase [&::-webkit-details-marker]:hidden open:bg-[var(--hot)]">Actions</summary>
              <div className="mobile-control-panel absolute right-0 top-[calc(100%+8px)] z-20 w-[min(280px,calc(100vw-24px))] grid gap-2 border border-[color-mix(in_srgb,var(--line)_24%,transparent)] rounded-[3px] bg-[var(--panel)] shadow-[0_14px_36px_color-mix(in_srgb,var(--line)_16%,transparent)] p-[10px] [&>button]:w-full [&>button]:inline-flex [&>button]:items-center [&>button]:justify-center [&>button]:gap-[7px] [&_.icon-button]:w-[var(--icon-button-size)] [&_.icon-button]:min-w-[var(--icon-button-size)] [&_.icon-button]:min-h-[var(--icon-button-size)] [&_.mobile-action-icons_.icon-button]:w-full [&_.mobile-action-icons_.icon-button]:min-w-0">
                {renderBoardActions ? (
                <div className={todoActionIconsClass}>{renderBoardActions()}</div>
              ) : null}
              {canEdit ? (
                <AddColumnButton onAddStatus={addStatus} />
              ) : null}
              <button type="button" onClick={() => addTodo()} aria-label="Add todo" title="Add todo">
                <Plus size={16} aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>
          </details>
          <div className="contents max-sm:!hidden">
            {canEdit ? (
              <AddColumnButton onAddStatus={addStatus} />
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
          key={`${editorDraftTodo.id}:${editorDraftTodo.boardId ?? boardId}`}
          draft={editorDraftTodo}
          statuses={visibleStatuses}
          boards={boards}
          availableTags={availableTags}
          duplicateCandidates={duplicateCandidates}
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
        {visibleStatuses.map((status) => {
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
                  'bg-[var(--date-bg)] outline outline-3 outline-[var(--hot)] outline-offset-[-6px]',
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
                          className={`column-add ${columnMiniButtonClass} bg-[var(--primary)] text-[var(--on-primary)]`}
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
                      <div className="h-[3px] rounded-[2px] bg-[var(--hot)] mx-[2px] mb-[5px] pointer-events-none shrink-0" aria-hidden="true" />
                    ) : null}
                    <article
                      className={`relative grid gap-[5px] border-0 rounded-[2px] p-[7px_7px_7px_11px] mb-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_16%,transparent),var(--shadow-sm)] cursor-grab overflow-visible z-0 hover:z-[12] focus-within:z-[12] active:cursor-grabbing hover:translate-y-[-1px] max-sm:hover:translate-y-0 hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_16%,transparent),0_10px_18px_color-mix(in_srgb,var(--line)_8%,transparent)] before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:h-auto ${todoDueClass(todo, completedTodoStatus) === 'done' || (todo.protocolId && todoDueClass(todo, completedTodoStatus) === 'done') ? 'bg-[var(--done-bg)] shadow-none before:bg-[var(--bar-done)]' : todoDueClass(todo, completedTodoStatus) === 'due-soon' ? 'bg-[var(--card-bg)] before:bg-[var(--hot)]' : todoDueClass(todo, completedTodoStatus) === 'overdue' ? 'bg-[var(--card-bg)] before:bg-[var(--danger)]' : 'bg-[var(--card-bg)] before:bg-[var(--bar-default)]'} ${draggedTodoId === todo.id ? 'opacity-[0.45]' : ''}`}
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
                    <div className={todoCardToplineClass}>
                      <div className={todoCardTitleClass}>{todo.title}</div>
                      {todo.protocolId ? (
                        <button
                          type="button"
                          className={todoLinkedBadgeClass}
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
                      <div className={todoCardMetaClass}>
                        {todo.who ? <span className={todoCardMetaSpanClass}>{todo.who}</span> : null}
                        {todo.dueDate ? (
                          <time
                            className={cn(
                              todoBaseDueDateClass,
                              todoDueClass(todo, completedTodoStatus) === 'scheduled' && 'bg-[var(--scheduled-bg)] text-[var(--text)]',
                              todoDueClass(todo, completedTodoStatus) === 'due-soon' && 'bg-[var(--danger)] text-white',
                              todoDueClass(todo, completedTodoStatus) === 'overdue' && 'bg-[var(--danger)] text-white',
                              todoDueClass(todo, completedTodoStatus) === 'done' && 'bg-[var(--done-badge-bg)] text-[var(--muted)]',
                              todoDueClass(todo, completedTodoStatus) === 'no-due' && 'bg-[var(--primary)] text-[var(--on-primary)]',
                            )}
                          >{formatTodoDueDate(todo.dueDate)}</time>
                        ) : null}
                      </div>
                    ) : null}
                    {todo.tags?.length ? (
                      <div className={todoCardTagsClass} aria-label="Todo tags">
                        {normalizeTodoTags(todo.tags).map((tag) => (
                          <button
                            type="button"
                            className={cn(todoTagChipBase, tagsEqual(tag, tagFilter) && todoTagChipActiveClass)}
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
                      <div className={todoCardNoteClass}>
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
                      <div className={cardCommentsClass} aria-label="Todo comments">
                        {todo.comments.map((comment) => (
                          <div className={cardCommentClass} key={comment.id}>
                            <time className={cardCommentTimeClass} dateTime={comment.createdAt}>{formatTodoUpdatedAt(comment.createdAt)}</time>
                            <span className={cardCommentBodyClass}>{comment.body}</span>
                            <button
                              type="button"
                              className={cardCommentDeleteClass}
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteTodoComment(todo, comment);
                              }}
                              aria-label="Delete comment"
                              title="Delete comment"
                            >
                              <Trash2 size={11} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className={todoCardFooterClass}>
                      {todo.updatedAt || todo.createdAt ? (
                        <time className={todoUpdatedMetaClass} dateTime={todo.updatedAt ?? todo.createdAt}>
                          upd {formatTodoUpdatedAt(todo.updatedAt ?? todo.createdAt)}
                        </time>
                      ) : <span />}
                      <div className="todo-card-actions flex gap-1 items-center justify-end flex-none ml-auto overflow-visible border-0 rounded-none bg-transparent shadow-none">
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
                <div className="grid min-h-[58px] place-items-center rounded-[2px] border border-dashed border-[var(--muted-border)] text-[12px] font-black uppercase text-[var(--muted)] mb-2">Drop here</div>
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

function AddColumnButton({ onAddStatus }: { onAddStatus: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      className="icon-button secondary h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0 max-sm:w-full"
      onClick={() => void onAddStatus()}
      aria-label="Add column"
      title="Add column"
    >
      <Columns3 size={16} aria-hidden="true" />
      <span className="sr-only">Add column</span>
    </button>
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

function tagsEqual(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
