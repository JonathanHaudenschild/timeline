import type { TimelineTodo, TodoStatus } from './types';

export const defaultTodoStatuses: TodoStatus[] = ['open', 'doing', 'done'];

export function normalizeTodoStatus(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTodoTag(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

export function normalizeTodoTags(tags: readonly string[] | undefined) {
  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const tag of tags ?? []) {
    const normalizedTag = normalizeTodoTag(tag);
    const key = normalizedTag.toLocaleLowerCase();
    if (!normalizedTag || seen.has(key)) continue;
    seen.add(key);
    normalizedTags.push(normalizedTag);
  }

  return normalizedTags;
}

export function normalizeTodo(todo: TimelineTodo): TimelineTodo {
  const tags = normalizeTodoTags(todo.tags);

  return {
    ...todo,
    tags: tags.length ? tags : undefined,
  };
}

export function todoWithPendingTag(todo: TimelineTodo, pendingTag: string): TimelineTodo {
  return normalizeTodo({
    ...todo,
    tags: normalizeTodoTags([...(todo.tags ?? []), pendingTag]),
  });
}

export function normalizeTodoStatuses(statuses: readonly string[] | undefined, todos: readonly TimelineTodo[] = []) {
  const values = [...(statuses?.length ? statuses : defaultTodoStatuses), ...todos.map((todo) => todo.status)]
    .map(normalizeTodoStatus)
    .filter(Boolean);

  return [...new Set(values)];
}

export function normalizeCompletedTodoStatus(
  statuses: readonly string[] | undefined,
  completedStatus?: string,
) {
  const normalizedStatuses = normalizeTodoStatuses(statuses);
  const normalizedCompletedStatus = completedStatus ? normalizeTodoStatus(completedStatus) : '';

  if (normalizedCompletedStatus && normalizedStatuses.includes(normalizedCompletedStatus)) {
    return normalizedCompletedStatus;
  }

  if (normalizedStatuses.includes('done')) return 'done';

  return normalizedStatuses.at(-1) ?? 'done';
}

export function isTodoCompleted(todo: TimelineTodo, completedStatus: string) {
  return normalizeTodoStatus(todo.status) === normalizeTodoStatus(completedStatus);
}

export function renameTodoStatus(
  statuses: readonly string[],
  todos: readonly TimelineTodo[],
  fromStatus: string,
  toStatus: string,
  completedStatus?: string,
) {
  const from = normalizeTodoStatus(fromStatus);
  const to = normalizeTodoStatus(toStatus);
  const currentStatuses = statuses.length ? statuses.map(normalizeTodoStatus).filter(Boolean) : defaultTodoStatuses;
  const currentCompletedStatus = normalizeCompletedTodoStatus(currentStatuses, completedStatus);

  if (!from || !to || from === to || currentStatuses.includes(to)) {
    return {
      statuses: currentStatuses,
      todos: [...todos],
      completedStatus: currentCompletedStatus,
    };
  }

  return {
    statuses: currentStatuses.map((status) => (status === from ? to : status)),
    todos: todos.map((todo) => (todo.status === from ? { ...todo, status: to } : todo)),
    completedStatus: currentCompletedStatus === from ? to : currentCompletedStatus,
  };
}

export function moveTodoWithinBoard(
  todos: readonly TimelineTodo[],
  todoId: string,
  targetStatus: TodoStatus,
  targetTodoId?: string,
) {
  const movingTodo = todos.find((todo) => todo.id === todoId);
  if (!movingTodo) return [...todos];
  if (todoId === targetTodoId) return [...todos];

  const remainingTodos = todos.filter((todo) => todo.id !== todoId);
  const targetTodoIds = remainingTodos
    .filter((todo) => todo.status === targetStatus)
    .sort(compareTodoOrder)
    .map((todo) => todo.id);
  const targetIndex = targetTodoId ? targetTodoIds.indexOf(targetTodoId) : -1;
  const insertIndex = targetIndex >= 0 ? targetIndex : targetTodoIds.length;
  const orderedTargetIds = [
    ...targetTodoIds.slice(0, insertIndex),
    todoId,
    ...targetTodoIds.slice(insertIndex),
  ];
  const nextOrders = new Map(orderedTargetIds.map((id, index) => [id, index + 1]));

  if (movingTodo.status !== targetStatus) {
    remainingTodos
      .filter((todo) => todo.status === movingTodo.status)
      .sort(compareTodoOrder)
      .forEach((todo, index) => nextOrders.set(todo.id, index + 1));
  }

  return todos.map((todo) => {
    if (todo.id === todoId) {
      return {
        ...todo,
        status: targetStatus,
        order: nextOrders.get(todo.id),
      };
    }

    const nextOrder = nextOrders.get(todo.id);
    return nextOrder ? { ...todo, order: nextOrder } : todo;
  });
}

export function formatTodoStatus(status: string) {
  return normalizeTodoStatus(status)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function compareTodoOrder(a: TimelineTodo, b: TimelineTodo) {
  const orderCompare = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  return orderCompare || a.id.localeCompare(b.id);
}
