import { describe, expect, it } from 'vitest';
import { extractTodoOwners, todoMatchesWho } from './todoFilters';
import type { TimelineTodo } from './types';

function todoWithOwner(who: string): TimelineTodo {
  return {
    id: 'todo',
    title: 'Todo',
    who,
    body: '',
    status: 'open',
    dueDate: '',
    showOnTimeline: true,
  };
}

describe('todo owner filters', () => {
  it('extracts individual people from combined owner fields', () => {
    expect(extractTodoOwners('Max & Mitch')).toEqual(['Max', 'Mitch']);
    expect(extractTodoOwners('max, mitch, isi')).toEqual(['max', 'mitch', 'isi']);
    expect(extractTodoOwners('Cookie und Mama / Isi')).toEqual(['Cookie', 'Mama', 'Isi']);
  });

  it('matches a selected person against combined owner fields', () => {
    expect(todoMatchesWho(todoWithOwner('Max & Mitch'), 'max')).toBe(true);
    expect(todoMatchesWho(todoWithOwner('max, mitch, isi'), 'Isi')).toBe(true);
    expect(todoMatchesWho(todoWithOwner('Max & Mitch'), 'Isi')).toBe(false);
  });

  it('ignores capitalization in owner options and matching', () => {
    expect(extractTodoOwners('Max, max, MAX')).toEqual(['Max']);
    expect(todoMatchesWho(todoWithOwner('MAX & Mitch'), 'max')).toBe(true);
    expect(todoMatchesWho(todoWithOwner('max & mitch'), 'MITCH')).toBe(true);
  });

  it('keeps exact combined-owner filters working for existing persisted values', () => {
    expect(todoMatchesWho(todoWithOwner('Max & Mitch'), 'max & mitch')).toBe(true);
  });
});
