import { describe, expect, it } from 'vitest';
import {
  createDefaultProject,
  createHash,
  normalizeHash,
  projectStorageKey,
} from './project';
import { formatShortGermanDate, formatShortGermanDateRange } from './dateFormat';
import { ensureProjectHash } from './storage';
import { isTodoCompleted, normalizeCompletedTodoStatus, normalizeTodoStatuses, renameTodoStatus } from './todos';

describe('project helpers', () => {
  it('normalizes hashes from url fragments and plain strings', () => {
    expect(normalizeHash('# Launch Plan ')).toBe('launch-plan');
    expect(normalizeHash('Project_123')).toBe('project-123');
  });

  it('falls back to a generated hash for empty input', () => {
    expect(normalizeHash('')).toMatch(/^tl-[a-z0-9]+$/);
  });

  it('creates stable localStorage keys', () => {
    expect(projectStorageKey('launch-plan')).toBe('timeline:project:launch-plan');
  });

  it('creates a default project for the supplied hash', () => {
    const project = createDefaultProject('launch-plan');

    expect(project.hash).toBe('launch-plan');
    expect(project.name).toBe('Launch Plan');
    expect(project.events.length).toBeGreaterThan(0);
    expect(project.todos.length).toBeGreaterThan(0);
    expect(project.settings.todoStatuses).toEqual(['open', 'doing', 'done']);
    expect(project.settings.completedTodoStatus).toBe('done');
    expect(project.settings.stickyLinks).toEqual([]);
  });

  it('creates short random hashes', () => {
    expect(createHash()).toMatch(/^tl-[a-z0-9]{6}$/);
  });

  it('preserves reordered default todo statuses', () => {
    expect(normalizeTodoStatuses(['done', 'open', 'doing'])).toEqual(['done', 'open', 'doing']);
  });

  it('does not re-add renamed default todo statuses', () => {
    expect(normalizeTodoStatuses(['backlog', 'doing', 'done'])).toEqual(['backlog', 'doing', 'done']);
  });

  it('renames default todo statuses without keeping the old default key', () => {
    const renamed = renameTodoStatus(
      ['open', 'doing', 'done'],
      [
        {
          id: 'todo-1',
          title: 'Book gear',
          who: 'Ops',
          body: '',
          status: 'open',
          dueDate: '',
          showOnTimeline: false,
        },
      ],
      'open',
      'backlog',
    );

    expect(renamed.statuses).toEqual(['backlog', 'doing', 'done']);
    expect(renamed.todos[0].status).toBe('backlog');
  });

  it('keeps completed todo semantics when the done column is renamed', () => {
    const renamed = renameTodoStatus(
      ['open', 'doing', 'done'],
      [
        {
          id: 'todo-1',
          title: 'Wrap',
          who: 'Ops',
          body: '',
          status: 'done',
          dueDate: '',
          showOnTimeline: false,
        },
      ],
      'done',
      'finished',
      'done',
    );

    expect(renamed.completedStatus).toBe('finished');
    expect(isTodoCompleted(renamed.todos[0], renamed.completedStatus)).toBe(true);
    expect(normalizeCompletedTodoStatus(renamed.statuses, renamed.completedStatus)).toBe('finished');
  });

  it('formats dates for German short display', () => {
    expect(formatShortGermanDate('2026-06-09')).toBe('Di 09.06');
    expect(formatShortGermanDateRange('2026-06-09', '2026-06-12')).toBe('Di 09.06 - Fr 12.06');
  });

  it('uses a stable default project hash when the url has no hash', () => {
    const location = { hash: '' } as Location;

    expect(ensureProjectHash(location)).toBe('timeline');
    expect(location.hash).toBe('timeline');
  });
});
