import { describe, expect, it } from 'vitest';
import {
  createDefaultProject,
  createHash,
  normalizeHash,
  projectStorageKey,
} from './project';
import { formatShortGermanDate, formatShortGermanDateRange } from './dateFormat';
import { ensureProjectHash } from './storage';
import { moveTodoBetweenBoards, normalizeTodoBoards, syncProjectTodoBoard } from './todoBoards';
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
    expect(project.todoBoards?.[0].todos.length).toBe(project.todos.length);
    expect(project.settings.activeTodoBoardId).toBe('board-main');
    expect(project.settings.todoStatuses).toEqual(['open', 'doing', 'done']);
    expect(project.settings.completedTodoStatus).toBe('done');
    expect(project.settings.stickyLinks).toEqual([]);
  });

  it('creates short random hashes', () => {
    expect(createHash()).toMatch(/^tl-[a-z0-9]{6}$/);
  });

  it('migrates legacy single-board todos into a default board', () => {
    const project = createDefaultProject('legacy');
    const legacyProject = { ...project, todoBoards: undefined };
    const boards = normalizeTodoBoards(legacyProject);

    expect(boards).toHaveLength(1);
    expect(boards[0].name).toBe('Main');
    expect(boards[0].todos).toEqual(project.todos);
  });

  it('syncs the active todo board into legacy todo fields without dropping other boards', () => {
    const project = createDefaultProject('boards');
    const boards = [
      {
        id: 'board-a',
        name: 'Ops',
        statuses: ['open', 'done'],
        completedTodoStatus: 'done',
        todos: [
          {
            id: 'todo-a',
            title: 'Ops task',
            who: 'Alex',
            body: '',
            status: 'open',
            dueDate: '',
            showOnTimeline: true,
          },
        ],
      },
      {
        id: 'board-b',
        name: 'Crew',
        statuses: ['todo', 'finished'],
        completedTodoStatus: 'finished',
        todos: [
          {
            id: 'todo-b',
            title: 'Crew task',
            who: 'Sam',
            body: '',
            status: 'todo',
            dueDate: '',
            showOnTimeline: true,
          },
        ],
      },
    ];

    const synced = syncProjectTodoBoard(project, boards, 'board-b');

    expect(synced.settings.activeTodoBoardId).toBe('board-b');
    expect(synced.todos).toEqual(boards[1].todos);
    expect(synced.todoBoards).toHaveLength(2);
    expect(synced.todoBoards?.[0].todos).toEqual(boards[0].todos);
    expect(synced.settings.todoStatuses).toEqual(['todo', 'finished']);
    expect(synced.settings.completedTodoStatus).toBe('finished');
  });

  it('moves todos between boards without losing source or target board state', () => {
    const movingTodo = {
      id: 'todo-move',
      title: 'Move me',
      who: 'Alex',
      body: '- Keep markdown',
      status: 'open',
      dueDate: '2026-06-10',
      showOnTimeline: true,
      order: 1,
    };
    const boards = [
      {
        id: 'board-a',
        name: 'Ops',
        statuses: ['open', 'done'],
        completedTodoStatus: 'done',
        todos: [
          movingTodo,
          {
            id: 'todo-stays',
            title: 'Stay put',
            who: 'Alex',
            body: '',
            status: 'done',
            dueDate: '',
            showOnTimeline: false,
            order: 2,
          },
        ],
      },
      {
        id: 'board-b',
        name: 'Crew',
        statuses: ['queued', 'finished'],
        completedTodoStatus: 'finished',
        todos: [
          {
            id: 'todo-target',
            title: 'Already there',
            who: 'Sam',
            body: '',
            status: 'queued',
            dueDate: '',
            showOnTimeline: true,
            order: 4,
          },
        ],
      },
    ];

    const movedBoards = moveTodoBetweenBoards(boards, movingTodo, 'board-a', 'board-b');
    const sourceBoard = movedBoards.find((board) => board.id === 'board-a');
    const targetBoard = movedBoards.find((board) => board.id === 'board-b');
    const movedTodo = targetBoard?.todos.find((todo) => todo.id === 'todo-move');

    expect(sourceBoard?.todos.map((todo) => todo.id)).toEqual(['todo-stays']);
    expect(targetBoard?.todos.map((todo) => todo.id)).toEqual(['todo-target', 'todo-move']);
    expect(movedTodo?.body).toBe('- Keep markdown');
    expect(movedTodo?.status).toBe('queued');
    expect(movedTodo?.order).toBe(5);
    expect(movedTodo?.boardId).toBeUndefined();
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
