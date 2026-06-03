import type { TimelineTodo, TodoStatus } from './types';

export const defaultTodoStatuses: TodoStatus[] = ['open', 'doing', 'done'];

export function normalizeTodoStatus(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export function formatTodoStatus(status: string) {
  return normalizeTodoStatus(status)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
