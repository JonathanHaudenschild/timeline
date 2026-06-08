import type { TimelineTodo } from './types';

const ownerSeparatorPattern = /\s*(?:,|;|\/|\+|&|\band\b|\bund\b|\n)\s*/i;

export function extractTodoOwners(who: string) {
  return uniquePeople(who.split(ownerSeparatorPattern));
}

export function todoMatchesWho(todo: TimelineTodo, whoFilter: string) {
  const filter = whoFilter.trim();
  if (!filter) return true;

  return namesEqual(todo.who, filter) || extractTodoOwners(todo.who).some((owner) => namesEqual(owner, filter));
}

export function uniquePeople(values: string[]) {
  const unique = new Map<string, string>();

  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized) return;

    const key = normalized.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, normalized);
  });

  return [...unique.values()];
}

export function namesEqual(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
