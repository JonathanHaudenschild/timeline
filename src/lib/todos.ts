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
  const values = [...(statuses?.length ? statuses : defaultTodoStatuses), ...todos.map((todo) => todo.status), ...defaultTodoStatuses]
    .map(normalizeTodoStatus)
    .filter(Boolean);

  return [...new Set(values)];
}

export function formatTodoStatus(status: string) {
  return normalizeTodoStatus(status)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
