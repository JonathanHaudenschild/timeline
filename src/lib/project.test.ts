import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultProject,
  createHash,
  normalizeHash,
  projectStorageKey,
} from './project';
import { renderMarkdown } from '@/components/MarkdownBlock';
import { mergeProjectChanges, projectPersistenceJson } from '@/components/TimelineApp';
import { formatShortGermanDate, formatShortGermanDateRange } from './dateFormat';
import { eventCategoryOptions, eventTypeOptions } from './eventOptions';
import { preserveImportedProjectLocks } from './importProject';
import {
  createMeetingProtocol,
  createMeetingProtocolTemplate,
  extractProtocolHeadlines,
  formatProtocolDuration,
  mergeMeetingProtocols,
  moveProtocolItem,
  normalizeMeetingProtocols,
  protocolConversionBody,
  seedRecurringProtocolItems,
  toggleRecurringProtocolItem,
} from './meetingProtocols';
import { buildProjectLocationHash, ensureProjectHash, parseProjectLocationHash } from './storage';
import {
  findTodoBoardContainingTodo,
  moveTodoBetweenBoards,
  normalizeTodoBoards,
  replaceTodoInBoard,
  syncProjectTodoBoard,
} from './todoBoards';
import {
  formatTodoStatus,
  isTodoCompleted,
  moveTodoWithinBoard,
  normalizeCompletedTodoStatus,
  normalizeTodoStatus,
  normalizeTodoTags,
  normalizeTodoStatuses,
  renameTodoStatus,
  todoWithPendingTag,
} from './todos';

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
    expect(project.meetingProtocols).toEqual([]);
  });

  it('preserves existing project and board pins when importing a JSON project', () => {
    const existingProject = createDefaultProject('locked-project');
    const importedProject = createDefaultProject('downloaded-project');
    const existingLockedProject = {
      ...existingProject,
      settings: {
        ...existingProject.settings,
        viewPinHash: 'existing-view-pin',
        editPinHash: 'existing-edit-pin',
      },
      todoBoards: [
        {
          ...existingProject.todoBoards![0],
          id: 'board-main',
          pinHash: 'existing-board-pin',
        },
      ],
    };
    const importedLockedProject = {
      ...importedProject,
      settings: {
        ...importedProject.settings,
        viewPinHash: 'imported-view-pin',
        editPinHash: 'imported-edit-pin',
      },
      todoBoards: [
        {
          ...importedProject.todoBoards![0],
          id: 'board-main',
          pinHash: 'imported-board-pin',
        },
        {
          id: 'new-board',
          name: 'Imported locked board',
          todos: [],
          statuses: ['open'],
          completedTodoStatus: 'open',
          pinHash: 'unknown-imported-board-pin',
        },
      ],
    };

    const preserved = preserveImportedProjectLocks(importedLockedProject, existingLockedProject);

    expect(preserved.settings.viewPinHash).toBe('existing-view-pin');
    expect(preserved.settings.editPinHash).toBe('existing-edit-pin');
    expect(preserved.todoBoards?.find((board) => board.id === 'board-main')?.pinHash).toBe('existing-board-pin');
    expect(preserved.todoBoards?.find((board) => board.id === 'new-board')?.pinHash).toBeUndefined();
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

  it('ignores active todo board mirror fields when checking persistent project changes', () => {
    const project = createDefaultProject('active-board-persistence');
    const boards = [
      {
        id: 'board-a',
        name: 'Ops',
        statuses: ['open', 'done'],
        completedTodoStatus: 'done',
        todos: [
          { id: 'todo-a', title: 'A', who: '', body: '', status: 'open', dueDate: '', showOnTimeline: true },
        ],
      },
      {
        id: 'board-b',
        name: 'Crew',
        statuses: ['todo', 'finished'],
        completedTodoStatus: 'finished',
        todos: [
          { id: 'todo-b', title: 'B', who: '', body: '', status: 'todo', dueDate: '', showOnTimeline: true },
        ],
      },
    ];
    const boardAProject = syncProjectTodoBoard(project, boards, 'board-a');
    const boardBProject = syncProjectTodoBoard(project, boards, 'board-b');
    const editedProject = syncProjectTodoBoard(
      project,
      boards.map((board) =>
        board.id === 'board-b'
          ? { ...board, todos: board.todos.map((todo) => ({ ...todo, title: 'Edited B' })) }
          : board,
      ),
      'board-b',
    );

    expect(projectPersistenceJson(boardAProject)).toBe(projectPersistenceJson(boardBProject));
    expect(projectPersistenceJson(boardAProject)).not.toBe(projectPersistenceJson(editedProject));
  });

  it('keeps newly added empty todo columns when syncing a board', () => {
    const project = createDefaultProject('new-empty-column');
    const board = project.todoBoards?.[0];
    if (!board) throw new Error('Expected default todo board');

    const synced = syncProjectTodoBoard(
      project,
      [
        {
          ...board,
          statuses: [...(board.statuses ?? []), 'waiting'],
        },
      ],
      board.id,
    );
    const [syncedBoard] = normalizeTodoBoards(synced);

    expect(syncedBoard.statuses).toContain('waiting');
    expect(synced.settings.todoStatuses).toContain('waiting');
  });

  it('keeps the local active todo board when another device saves from a different board', () => {
    const baseProject = createDefaultProject('merge-active-board');
    const baseBoard = baseProject.todoBoards?.[0];
    if (!baseBoard) throw new Error('Expected default todo board');

    const secondBoard = {
      id: 'board-remote',
      name: 'Remote board',
      statuses: ['open', 'done'],
      completedTodoStatus: 'done',
      todos: [
        {
          id: 'remote-todo',
          title: 'Remote todo',
          who: '',
          body: '',
          status: 'open',
          dueDate: '',
          showOnTimeline: true,
        },
      ],
    };
    const baseWithBoards = {
      ...baseProject,
      settings: { ...baseProject.settings, activeTodoBoardId: baseBoard.id },
      todoBoards: [baseBoard, secondBoard],
    };
    const localProject = {
      ...baseWithBoards,
      settings: { ...baseWithBoards.settings, activeTodoBoardId: baseBoard.id },
    };
    const remoteProject = {
      ...baseWithBoards,
      revision: 2,
      settings: { ...baseWithBoards.settings, activeTodoBoardId: secondBoard.id },
      todoBoards: [
        baseBoard,
        {
          ...secondBoard,
          todos: secondBoard.todos.map((todo) => ({
            ...todo,
            status: 'done',
            updatedAt: '2026-06-06T10:00:00.000Z',
          })),
        },
      ],
    };

    const merged = mergeProjectChanges(baseWithBoards, localProject, remoteProject);
    const boards = normalizeTodoBoards(merged);

    expect(merged.settings.activeTodoBoardId).toBe(baseBoard.id);
    expect(merged.todos).toEqual(baseBoard.todos);
    expect(boards.find((board) => board.id === secondBoard.id)?.todos[0].status).toBe('done');
  });

  it('keeps both versions when cross-device project text changes conflict', () => {
    const baseProject = createDefaultProject('merge-text');
    const localProject = {
      ...baseProject,
      infoMarkdown: 'local info',
      protocolInstructionTemplate: 'local instruction',
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      infoMarkdown: 'remote info',
      protocolInstructionTemplate: 'remote instruction',
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);

    expect(merged.infoMarkdown).toContain('local info');
    expect(merged.infoMarkdown).toContain('remote info');
    expect(merged.infoMarkdown).toContain('Version from another device');
    expect(merged.protocolInstructionTemplate).toContain('local instruction');
    expect(merged.protocolInstructionTemplate).toContain('remote instruction');
  });

  it('merges todo board status columns without dropping columns from another device', () => {
    const baseProject = createDefaultProject('merge-statuses');
    const baseBoard = baseProject.todoBoards?.[0];
    if (!baseBoard) throw new Error('Expected default board');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          statuses: [...(baseBoard.statuses ?? []), 'blocked'],
        },
      ],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          statuses: [...(baseBoard.statuses ?? []), 'review'],
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);

    expect(mergedBoard.statuses).toEqual(['open', 'doing', 'done', 'review', 'blocked']);
  });

  it('keeps todos added on different devices during sync', () => {
    const baseProject = createDefaultProject('merge-todo-additions');
    const baseBoard = baseProject.todoBoards?.[0];
    if (!baseBoard) throw new Error('Expected default board');

    const localTodo = {
      id: 'local-todo',
      title: 'Local todo',
      who: 'Alex',
      body: 'Local details',
      status: 'open',
      dueDate: '',
      showOnTimeline: true,
      order: 99,
    };
    const remoteTodo = {
      id: 'remote-todo',
      title: 'Remote todo',
      who: 'Sam',
      body: 'Remote details',
      status: 'doing',
      dueDate: '',
      showOnTimeline: true,
      order: 100,
    };
    const localProject = {
      ...baseProject,
      todoBoards: [{ ...baseBoard, todos: [...baseBoard.todos, localTodo] }],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [{ ...baseBoard, todos: [...baseBoard.todos, remoteTodo] }],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);

    expect(mergedBoard.todos.map((todo) => todo.id)).toEqual(expect.arrayContaining(['local-todo', 'remote-todo']));
  });

  it('normalizes todo tags without changing legacy todos that have none', () => {
    const project = createDefaultProject('todo-tags');
    const baseBoard = project.todoBoards?.[0];
    if (!baseBoard) throw new Error('Expected default board');

    const taggedTodo = {
      id: 'todo-tagged',
      title: 'Tagged todo',
      who: '',
      body: '',
      status: 'open',
      dueDate: '',
      showOnTimeline: true,
      tags: ['  Bar ', 'bar', 'Urgent Work'],
    };
    const boards = normalizeTodoBoards({
      ...project,
      todoBoards: [{ ...baseBoard, todos: [...baseBoard.todos, taggedTodo] }],
    });
    const normalizedTaggedTodo = boards[0].todos.find((todo) => todo.id === taggedTodo.id);

    expect(normalizedTaggedTodo?.tags).toEqual(['Bar', 'Urgent Work']);
    expect(boards[0].todos.find((todo) => todo.id !== taggedTodo.id && !todo.tags)?.tags).toBeUndefined();
    expect(normalizeTodoTags(['Foo', ' foo ', '', 'Team Ops'])).toEqual(['Foo', 'Team Ops']);
  });

  it('keeps a pending typed todo tag when saving without pressing add first', () => {
    const todo = {
      id: 'todo-pending-tag',
      title: 'Tagged todo',
      who: '',
      body: '',
      status: 'open',
      dueDate: '',
      showOnTimeline: true,
      tags: ['Ops'],
    };

    expect(todoWithPendingTag(todo, '  urgent  ')).toMatchObject({
      tags: ['Ops', 'urgent'],
    });
    expect(todoWithPendingTag(todo, 'ops')).toMatchObject({
      tags: ['Ops'],
    });
  });

  it('merges concurrent edits to the same todo without creating duplicate cards', () => {
    const baseProject = createDefaultProject('merge-todo-conflict');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? { ...todo, title: 'Local title', tags: ['local'], body: 'Local body', updatedAt: '2026-06-06T10:00:00.000Z' }
              : todo,
          ),
        },
      ],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? { ...todo, title: 'Remote title', tags: ['remote'], dueDate: '2026-06-30', updatedAt: '2026-06-06T10:05:00.000Z' }
              : todo,
          ),
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);
    const mergedTodos = mergedBoard.todos.filter((todo) => todo.id === baseTodo.id || todo.id.startsWith(`${baseTodo.id}-other-device`));

    expect(mergedTodos).toHaveLength(1);
    expect(mergedTodos[0]).toMatchObject({
      id: baseTodo.id,
      title: 'Remote title',
      body: 'Local body',
      dueDate: '2026-06-30',
      updatedAt: '2026-06-06T10:05:00.000Z',
      tags: ['remote', 'local'],
    });
  });

  it('keeps remote board fields when local edits todos in the same board', () => {
    const baseProject = createDefaultProject('merge-board-fields');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? { ...todo, title: 'Local todo edit', updatedAt: '2026-06-06T10:00:00.000Z' }
              : todo,
          ),
        },
      ],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          name: 'Remote board name',
          pinHash: 'remote-board-pin',
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);

    expect(mergedBoard.name).toBe('Remote board name');
    expect(mergedBoard.pinHash).toBe('remote-board-pin');
    expect(mergedBoard.todos[0].title).toBe('Local todo edit');
  });

  it('keeps comments added to the same todo on different devices', () => {
    const baseProject = createDefaultProject('merge-todo-comments');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    {
                      id: 'comment-local',
                      body: 'Local comment',
                      createdAt: '2026-06-06T10:00:00.000Z',
                      updatedAt: '2026-06-06T10:00:00.000Z',
                    },
                  ],
                  updatedAt: '2026-06-06T10:00:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    {
                      id: 'comment-remote',
                      body: 'Remote comment',
                      createdAt: '2026-06-06T10:05:00.000Z',
                      updatedAt: '2026-06-06T10:05:00.000Z',
                    },
                  ],
                  updatedAt: '2026-06-06T10:05:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);
    const mergedTodo = mergedBoard.todos.find((todo) => todo.id === baseTodo.id);

    expect(mergedTodo?.comments?.map((comment) => comment.body)).toEqual(['Local comment', 'Remote comment']);
  });

  it('keeps a remotely edited todo comment when local deletes the same comment', () => {
    const baseProject = createDefaultProject('merge-todo-comment-delete-vs-edit');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const baseComment = {
      id: 'comment-base',
      body: 'Original comment',
      createdAt: '2026-06-06T10:00:00.000Z',
      updatedAt: '2026-06-06T10:00:00.000Z',
    };
    const baseWithComment = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id ? { ...todo, comments: [baseComment] } : todo,
          ),
        },
      ],
    };

    // local deletes the comment
    const localProject = {
      ...baseWithComment,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id ? { ...todo, comments: [] } : todo,
          ),
        },
      ],
    };
    // remote edits the same comment
    const remoteProject = {
      ...baseWithComment,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    { ...baseComment, body: 'Remote edit of comment', updatedAt: '2026-06-06T10:05:00.000Z' },
                  ],
                  updatedAt: '2026-06-06T10:05:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };

    const merged = mergeProjectChanges(baseWithComment, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);
    const mergedTodo = mergedBoard.todos.find((todo) => todo.id === baseTodo.id);

    // remote edit wins over local delete — the edited comment is preserved
    expect(mergedTodo?.comments?.map((comment) => comment.body)).toEqual(['Remote edit of comment']);
  });

  it('syncs todo comment deletion while keeping comments added on another device', () => {
    const baseProject = createDefaultProject('merge-todo-comment-delete-vs-add');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const baseComment = {
      id: 'comment-base',
      body: 'Delete me',
      createdAt: '2026-06-06T10:00:00.000Z',
      updatedAt: '2026-06-06T10:00:00.000Z',
    };
    const baseWithComment = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id ? { ...todo, comments: [baseComment] } : todo,
          ),
        },
      ],
    };
    const localProject = {
      ...baseWithComment,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id ? { ...todo, comments: [] } : todo,
          ),
        },
      ],
    };
    const remoteProject = {
      ...baseWithComment,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    baseComment,
                    {
                      id: 'comment-remote',
                      body: 'Remote new comment',
                      createdAt: '2026-06-06T10:05:00.000Z',
                      updatedAt: '2026-06-06T10:05:00.000Z',
                    },
                  ],
                  updatedAt: '2026-06-06T10:05:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };

    const merged = mergeProjectChanges(baseWithComment, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);
    const mergedTodo = mergedBoard.todos.find((todo) => todo.id === baseTodo.id);

    expect(mergedTodo?.comments?.map((comment) => comment.body)).toEqual(['Remote new comment']);
  });

  it('keeps a remote todo comment when the same todo is edited locally', () => {
    const baseProject = createDefaultProject('merge-todo-edit-comment');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  title: 'Locally edited title',
                  body: 'Locally edited body',
                  updatedAt: '2026-06-06T10:00:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    {
                      id: 'comment-remote',
                      body: 'Remote comment while editing',
                      createdAt: '2026-06-06T10:05:00.000Z',
                      updatedAt: '2026-06-06T10:05:00.000Z',
                    },
                  ],
                  updatedAt: '2026-06-06T10:05:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);
    const mergedTodo = mergedBoard.todos.find((todo) => todo.id === baseTodo.id);

    expect(mergedTodo).toMatchObject({
      title: 'Locally edited title',
      body: 'Locally edited body',
    });
    expect(mergedTodo?.comments?.map((comment) => comment.body)).toEqual(['Remote comment while editing']);
  });

  it('keeps a local todo card move when another device comments on the same todo', () => {
    const baseProject = createDefaultProject('merge-todo-move-comment');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const movedTodos = moveTodoWithinBoard(baseBoard.todos, baseTodo.id, 'doing');
    const localProject = {
      ...baseProject,
      todoBoards: [{ ...baseBoard, todos: movedTodos }],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    {
                      id: 'comment-remote',
                      body: 'Remote comment during move',
                      createdAt: '2026-06-06T10:05:00.000Z',
                      updatedAt: '2026-06-06T10:05:00.000Z',
                    },
                  ],
                  updatedAt: '2026-06-06T10:05:00.000Z',
                }
              : todo,
          ),
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);
    const mergedTodo = mergedBoard.todos.find((todo) => todo.id === baseTodo.id);

    expect(mergedTodo).toMatchObject({ status: 'doing' });
    expect(mergedTodo?.comments?.map((comment) => comment.body)).toEqual(['Remote comment during move']);
  });

  it('keeps a todo on the moved board when another device comments during a board move', () => {
    const baseProject = createDefaultProject('merge-todo-board-move-comment');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const targetBoard = {
      id: 'board-target',
      name: 'Target',
      statuses: ['open', 'done'],
      completedTodoStatus: 'done',
      todos: [],
    };
    const baseWithBoards = {
      ...baseProject,
      todoBoards: [baseBoard, targetBoard],
    };
    const localBoards = moveTodoBetweenBoards(
      normalizeTodoBoards(baseWithBoards),
      baseTodo,
      baseBoard.id,
      targetBoard.id,
    );
    const localProject = {
      ...baseWithBoards,
      todoBoards: localBoards,
    };
    const remoteProject = {
      ...baseWithBoards,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id
              ? {
                  ...todo,
                  comments: [
                    {
                      id: 'comment-remote-board-move',
                      body: 'Remote comment during board move',
                      createdAt: '2026-06-06T10:05:00.000Z',
                      updatedAt: '2026-06-06T10:05:00.000Z',
                    },
                  ],
                  updatedAt: '2026-06-06T10:05:00.000Z',
                }
              : todo,
          ),
        },
        targetBoard,
      ],
    };

    const merged = mergeProjectChanges(baseWithBoards, localProject, remoteProject);
    const mergedBoards = normalizeTodoBoards(merged);
    const sourceBoard = mergedBoards.find((board) => board.id === baseBoard.id);
    const movedBoard = mergedBoards.find((board) => board.id === targetBoard.id);
    const movedTodo = movedBoard?.todos.find((todo) => todo.id === baseTodo.id);

    expect(sourceBoard?.todos.some((todo) => todo.id === baseTodo.id)).toBe(false);
    expect(movedBoard?.todos.filter((todo) => todo.id === baseTodo.id)).toHaveLength(1);
    expect(movedTodo?.comments?.map((comment) => comment.body)).toEqual(['Remote comment during board move']);
  });

  it('does not create todo duplicates across repeated autosave conflict merges', () => {
    const baseProject = createDefaultProject('repeated-todo-conflicts');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id ? { ...todo, title: 'Local title', tags: ['local'] } : todo,
          ),
        },
      ],
    };
    const firstRemoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) =>
            todo.id === baseTodo.id ? { ...todo, dueDate: '2026-06-30', tags: ['remote'] } : todo,
          ),
        },
      ],
    };

    const firstMerge = mergeProjectChanges(baseProject, localProject, firstRemoteProject);
    const secondRemoteProject = {
      ...firstMerge,
      revision: 3,
      todoBoards: normalizeTodoBoards(firstMerge).map((board) =>
        board.id === baseBoard.id
          ? {
            ...board,
            todos: [
              ...board.todos,
              {
                id: 'remote-added-todo',
                title: 'Remote added todo',
                who: '',
                body: '',
                status: 'open',
                dueDate: '',
                showOnTimeline: true,
              },
            ],
          }
          : board,
      ),
    };
    const secondMerge = mergeProjectChanges(firstRemoteProject, firstMerge, secondRemoteProject);
    const [mergedBoard] = normalizeTodoBoards(secondMerge);
    const repeatedTodoIds = mergedBoard.todos
      .filter((todo) => todo.id === baseTodo.id || todo.id.startsWith(`${baseTodo.id}-other-device`))
      .map((todo) => todo.id);

    expect(repeatedTodoIds).toEqual([baseTodo.id]);
    expect(mergedBoard.todos.map((todo) => todo.id)).toContain('remote-added-todo');
  });

  it('drops generated other-device todo duplicates when the original todo still exists', () => {
    const project = createDefaultProject('dedupe-generated-todos');
    const baseBoard = project.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const boards = normalizeTodoBoards({
      ...project,
      todoBoards: [
        {
          ...baseBoard,
          todos: [
            baseTodo,
            { ...baseTodo, id: `${baseTodo.id}-other-device`, title: `${baseTodo.title} (other device)` },
            { ...baseTodo, id: `${baseTodo.id}-other-device-2`, title: `${baseTodo.title} (other device)` },
          ],
        },
      ],
    });

    expect(boards[0].todos.map((todo) => todo.id)).toEqual([baseTodo.id]);
  });

  it('keeps a remotely edited event when local deletes the stale event', () => {
    const baseProject = createDefaultProject('merge-event-remote-edit-local-delete');
    const baseEvent = baseProject.events[0];
    if (!baseEvent) throw new Error('Expected default project with events');

    const localProject = {
      ...baseProject,
      events: baseProject.events.filter((event) => event.id !== baseEvent.id),
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      events: baseProject.events.map((event) =>
        event.id === baseEvent.id ? { ...event, what: 'Remote edit survives' } : event,
      ),
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);

    expect(merged.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: baseEvent.id, what: 'Remote edit survives' })]),
    );
  });

  it('keeps a locally edited event when remote deletes the stale event', () => {
    const baseProject = createDefaultProject('merge-event-local-edit-remote-delete');
    const baseEvent = baseProject.events[0];
    if (!baseEvent) throw new Error('Expected default project with events');

    const localProject = {
      ...baseProject,
      events: baseProject.events.map((event) =>
        event.id === baseEvent.id ? { ...event, what: 'Local edit survives' } : event,
      ),
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      events: baseProject.events.filter((event) => event.id !== baseEvent.id),
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);

    expect(merged.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: baseEvent.id, what: 'Local edit survives' })]),
    );
  });

  it('merges concurrent edits to the same event without creating duplicate events', () => {
    const baseProject = createDefaultProject('merge-event-conflict');
    const baseEvent = baseProject.events[0];
    if (!baseEvent) throw new Error('Expected default project with events');

    const localProject = {
      ...baseProject,
      events: baseProject.events.map((event) =>
        event.id === baseEvent.id ? { ...event, what: 'Local kickoff', note: 'local note' } : event,
      ),
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      events: baseProject.events.map((event) =>
        event.id === baseEvent.id
          ? {
              ...event,
              what: 'Remote kickoff',
              note: 'remote note',
              who: 'Remote team',
              endDate: '2026-06-04',
              endTime: '17:30',
            }
          : event,
      ),
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const mergedEvents = merged.events.filter((event) => event.id === baseEvent.id || event.id.startsWith(`${baseEvent.id}-other-device`));

    expect(mergedEvents).toHaveLength(1);
    expect(mergedEvents[0]).toMatchObject({
      id: baseEvent.id,
      what: 'Local kickoff\n\n--- Version from another device ---\n\nRemote kickoff',
      who: 'Remote team',
      endDate: '2026-06-04',
      endTime: '17:30',
      note: 'local note\n\n--- Version from another device ---\n\nremote note',
    });
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

  it('finds and replaces a todo in a specific board without changing other boards', () => {
    const boards = [
      {
        id: 'board-a',
        name: 'Ops',
        statuses: ['open', 'done'],
        completedTodoStatus: 'done',
        todos: [
          { id: 'todo-a', title: 'A', who: '', body: '', status: 'open', dueDate: '', showOnTimeline: true },
        ],
      },
      {
        id: 'board-b',
        name: 'Crew',
        statuses: ['todo', 'finished'],
        completedTodoStatus: 'finished',
        todos: [
          { id: 'todo-b', title: 'B', who: '', body: '', status: 'todo', dueDate: '', showOnTimeline: true },
        ],
      },
    ];

    expect(findTodoBoardContainingTodo(boards, 'todo-b')?.id).toBe('board-b');

    const updatedBoards = replaceTodoInBoard(boards, 'board-b', {
      id: 'todo-b',
      title: 'Updated B',
      who: '',
      body: '',
      status: 'finished',
      dueDate: '',
      showOnTimeline: true,
      boardId: 'board-a',
    });

    expect(updatedBoards.find((board) => board.id === 'board-a')?.todos.map((todo) => todo.id)).toEqual(['todo-a']);
    expect(updatedBoards.find((board) => board.id === 'board-b')?.todos).toEqual([
      expect.objectContaining({ id: 'todo-b', title: 'Updated B', status: 'finished', boardId: undefined }),
    ]);

    const project = createDefaultProject('external-todo-edit');
    const synced = syncProjectTodoBoard(
      { ...project, settings: { ...project.settings, activeTodoBoardId: 'board-a' } },
      updatedBoards,
      'board-a',
    );

    expect(synced.settings.activeTodoBoardId).toBe('board-a');
    expect(synced.todos).toEqual(boards[0].todos);
    expect(synced.todoBoards?.find((board) => board.id === 'board-b')?.todos[0].title).toBe('Updated B');
  });

  it('reorders todo cards inside the same column by target card', () => {
    const todos = [
      { id: 'a', title: 'A', who: '', body: '', status: 'open', dueDate: '', showOnTimeline: true, order: 1 },
      { id: 'b', title: 'B', who: '', body: '', status: 'open', dueDate: '', showOnTimeline: true, order: 2 },
      { id: 'c', title: 'C', who: '', body: '', status: 'open', dueDate: '', showOnTimeline: true, order: 3 },
    ];

    const moved = moveTodoWithinBoard(todos, 'c', 'open', 'a');

    expect(moved.filter((todo) => todo.status === 'open').sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((todo) => todo.id))
      .toEqual(['c', 'a', 'b']);
  });

  it('moves todo cards to another column before a target card', () => {
    const todos = [
      { id: 'a', title: 'A', who: '', body: '', status: 'open', dueDate: '', showOnTimeline: true, order: 1 },
      { id: 'b', title: 'B', who: '', body: '', status: 'doing', dueDate: '', showOnTimeline: true, order: 1 },
      { id: 'c', title: 'C', who: '', body: '', status: 'doing', dueDate: '', showOnTimeline: true, order: 2 },
    ];

    const moved = moveTodoWithinBoard(todos, 'a', 'doing', 'c');

    expect(moved.find((todo) => todo.id === 'a')).toMatchObject({ status: 'doing', order: 2 });
    expect(moved.filter((todo) => todo.status === 'doing').sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((todo) => todo.id))
      .toEqual(['b', 'a', 'c']);
  });

  it('preserves reordered default todo statuses', () => {
    expect(normalizeTodoStatuses(['done', 'open', 'doing'])).toEqual(['done', 'open', 'doing']);
  });

  it('does not re-add renamed default todo statuses', () => {
    expect(normalizeTodoStatuses(['backlog', 'doing', 'done'])).toEqual(['backlog', 'doing', 'done']);
  });

  it('preserves printable symbols in todo column names', () => {
    expect(normalizeTodoStatus('Needs review / Max & Mitch!')).toBe('needs review / max & mitch!');
    expect(normalizeTodoStatus('  Bühne ✅\nCheck  ')).toBe('bühne ✅ check');
    expect(normalizeTodoStatuses(['Needs review / Max & Mitch!', 'needs review / max & mitch!'])).toEqual([
      'needs review / max & mitch!',
    ]);
    expect(formatTodoStatus('needs review / max & mitch!')).toBe('Needs Review / Max & Mitch!');
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

  it('builds event type and category options from defaults and existing events', () => {
    const events = [
      { id: 'a', date: '2026-06-09', time: '10:00', what: 'A', who: '', type: 'Workshop', category: 'Session', showOnTimeline: true, note: '' },
      { id: 'b', date: '2026-06-10', time: '11:00', what: 'B', who: '', type: ' workshop ', category: '', showOnTimeline: true, note: '' },
      { id: 'c', date: '2026-06-11', time: '12:00', what: 'C', who: '', type: 'Ops', showOnTimeline: true, note: '' },
    ];

    expect(eventTypeOptions(events)).toEqual(expect.arrayContaining(['milestone', 'meeting', 'Workshop', 'workshop', 'Ops']));
    expect(eventCategoryOptions(events)).toEqual(expect.arrayContaining(['event', 'deadline', 'Session', 'Ops']));
    expect(eventCategoryOptions(events)).not.toContain('');
  });

  it('renders extended markdown formatting safely', () => {
    const html = renderMarkdown('_italic_ ++under++ ~~gone~~ [color=#e53935]red **bold**[/color]\n1. One\n- [x] Done\n> Quote');

    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<u>under</u>');
    expect(html).toContain('<s>gone</s>');
    expect(html).toContain('<span class="markdown-color-text" style="color: #e53935">red <strong>bold</strong></span>');
    expect(html).toContain('<ol type="1">');
    expect(html).toContain('type="checkbox" disabled checked');
    expect(html).toContain('<blockquote>Quote</blockquote>');
  });

  it('renders indented markdown lists and task items', () => {
    const html = renderMarkdown('  - Bullet\n  1. Number\n  - [ ] Task', { interactiveTasks: true });

    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Bullet</li>');
    expect(html).toContain('<ol type="1">');
    expect(html).toContain('<li>Number</li>');
    expect(html).toContain('data-markdown-task-line');
    expect(html).toContain('Task');
  });

  it('renders markdown links and bare urls safely', () => {
    const html = renderMarkdown(
      '[Open **site**](https://example.com?a=1&b=2) www.example.org https://example.net/test. [bad](javascript:alert(1)) [safe](mailto:test@example.com) <script>',
    );

    expect(html).toContain(
      '<a href="https://example.com?a=1&amp;b=2" target="_blank" rel="noreferrer">Open <strong>site</strong></a>',
    );
    expect(html).toContain('<a href="https://www.example.org" target="_blank" rel="noreferrer">www.example.org</a>');
    expect(html).toContain('<a href="https://example.net/test" target="_blank" rel="noreferrer">https://example.net/test</a>.');
    expect(html).toContain('[bad](javascript:alert(1))');
    expect(html).toContain('<a href="mailto:test@example.com" target="_blank" rel="noreferrer">safe</a>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });

  it('uses a stable default project hash when the url has no hash', () => {
    const location = { hash: '' } as Location;

    expect(ensureProjectHash(location)).toBe('timeline');
    expect(location.hash).toBe('timeline');
  });

  it('keeps section and protocol targets separate from the project hash', () => {
    expect(parseProjectLocationHash('#camp?timeline')).toEqual({
      projectHash: 'camp',
      target: { section: 'timeline' },
    });
    expect(parseProjectLocationHash('#camp?protocol=protocol-1')).toEqual({
      projectHash: 'camp',
      target: { section: 'protocol', protocolId: 'protocol-1' },
    });
    expect(buildProjectLocationHash('camp', { section: 'protocol', protocolId: 'protocol-1' })).toBe('camp?protocol=protocol-1');
  });

  it('normalizes meeting protocols without losing saved body text', () => {
    const protocols = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '06.06.26',
        title: '',
        updates: [{ title: 'Update A', owner: 'Alex', body: '- Info' }],
        topics: [{ title: 'Thema A', owner: 'Mika', body: '- Discuss' }],
        todos: [{ title: 'Todo A', owner: 'Sam', body: '- Do it' }],
        body: 'Samstag 06.06.26\n1. Updates 06.06.26\nCustom update',
      },
    ]);

    expect(protocols[0].date).toBe('2026-06-06');
    expect(protocols[0].title).toBe('Tägliches Platz-Plenum');
    expect(protocols[0].body).toContain('Custom update');
    expect(protocols[0].updates[0].title).toBe('Update A');
    expect(protocols[0].topics[0].owner).toBe('Mika');
    expect(protocols[0].todos[0].body).toBe('- Do it');
  });

  it('normalizes meeting protocol item todo and event links without losing them', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        todos: [{ id: 'item-1', title: 'Build', convertedTodoId: 'todo-1', convertedEventId: 'event-1' }],
      },
    ]);

    expect(protocol.todos[0].convertedTodoId).toBe('todo-1');
    expect(protocol.todos[0].convertedEventId).toBe('event-1');
  });

  it('normalizes recurring protocol item metadata', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'item-1', title: 'Repeat me', recurring: true, recurringSourceId: 'source-1' }],
      },
    ]);

    expect(protocol.updates[0]).toMatchObject({
      recurring: true,
      recurringSourceId: 'source-1',
    });
  });

  it('seeds later protocols with fresh copies of recurring items', () => {
    const [sourceProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        time: '10:00',
        updates: [
          {
            id: 'update-1',
            title: 'Recurring update',
            owner: 'Alex',
            body: 'Carry forward',
            convertedEventId: 'event-1',
            comments: [{ id: 'comment-1', body: 'Do not copy', createdAt: '2026-06-06T10:00:00.000Z' }],
            recurring: true,
          },
        ],
        topics: [{ id: 'topic-1', title: 'One-off topic', recurring: false }],
      },
    ]);
    const [targetProtocol] = normalizeMeetingProtocols([
      { id: 'protocol-2', date: '2026-06-07', time: '10:00' },
    ]);

    const seeded = seedRecurringProtocolItems(targetProtocol, [sourceProtocol]);

    expect(seeded.updates).toHaveLength(1);
    expect(seeded.updates[0]).toMatchObject({
      title: 'Recurring update',
      owner: 'Alex',
      body: 'Carry forward',
      recurring: true,
      recurringSourceId: 'update-1',
    });
    expect(seeded.updates[0].id).not.toBe('update-1');
    expect(seeded.updates[0].convertedEventId).toBeUndefined();
    expect(seeded.updates[0].comments).toBeUndefined();
    expect(seeded.topics).toHaveLength(0);
  });

  it('stops seeding recurring items after a later copy is turned off', () => {
    const protocols = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Recurring update', recurring: true }],
      },
      {
        id: 'protocol-2',
        date: '2026-06-07',
        updates: [{ id: 'update-2', title: 'Recurring update', recurring: false, recurringSourceId: 'update-1' }],
      },
      { id: 'protocol-3', date: '2026-06-08' },
    ]);
    const sourceProtocol = protocols.find((protocol) => protocol.id === 'protocol-1')!;
    const stoppedProtocol = protocols.find((protocol) => protocol.id === 'protocol-2')!;
    const targetProtocol = protocols.find((protocol) => protocol.id === 'protocol-3')!;

    const seeded = seedRecurringProtocolItems(targetProtocol, [sourceProtocol, stoppedProtocol]);

    expect(seeded.updates).toHaveLength(0);
  });

  it('populates existing future protocols when a protocol item is toggled recurring', () => {
    const protocols = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        time: '10:00',
        updates: [{ id: 'update-1', title: 'Recurring update', owner: 'Alex', body: 'Carry forward' }],
      },
      {
        id: 'protocol-2',
        date: '2026-06-07',
        time: '10:00',
        updates: [],
      },
    ]);

    const updated = toggleRecurringProtocolItem(
      protocols,
      'protocol-1',
      'updates',
      'update-1',
      '2026-06-06T10:05:00.000Z',
    );
    const source = updated.find((protocol) => protocol.id === 'protocol-1')!;
    const future = updated.find((protocol) => protocol.id === 'protocol-2')!;

    expect(source.updates[0]).toMatchObject({
      recurring: true,
      recurringSourceId: 'update-1',
    });
    expect(future.updates).toHaveLength(1);
    expect(future.updates[0]).toMatchObject({
      title: 'Recurring update',
      owner: 'Alex',
      body: 'Carry forward',
      recurring: true,
      recurringSourceId: 'update-1',
    });
    expect(future.updates[0].id).not.toBe('update-1');
  });

  it('does not duplicate existing future recurring protocol copies', () => {
    const protocols = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        time: '10:00',
        updates: [{ id: 'update-1', title: 'Recurring update', recurring: false }],
      },
      {
        id: 'protocol-2',
        date: '2026-06-07',
        time: '10:00',
        updates: [{ id: 'update-2', title: 'Existing copy', recurring: true, recurringSourceId: 'update-1' }],
      },
    ]);

    const updated = toggleRecurringProtocolItem(
      protocols,
      'protocol-1',
      'updates',
      'update-1',
      '2026-06-06T10:05:00.000Z',
    );
    const future = updated.find((protocol) => protocol.id === 'protocol-2')!;

    expect(future.updates).toHaveLength(1);
    expect(future.updates[0].id).toBe('update-2');
  });

  it('stops existing future recurring copies when an earlier copy is toggled off', () => {
    const protocols = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        time: '10:00',
        updates: [{ id: 'update-1', title: 'Recurring update', recurring: true }],
      },
      {
        id: 'protocol-2',
        date: '2026-06-07',
        time: '10:00',
        updates: [{ id: 'update-2', title: 'Existing copy', recurring: true, recurringSourceId: 'update-1' }],
      },
      {
        id: 'protocol-3',
        date: '2026-06-08',
        time: '10:00',
        updates: [{ id: 'update-3', title: 'Later copy', recurring: true, recurringSourceId: 'update-1' }],
      },
    ]);

    const updated = toggleRecurringProtocolItem(
      protocols,
      'protocol-2',
      'updates',
      'update-2',
      '2026-06-07T10:05:00.000Z',
    );
    const source = updated.find((protocol) => protocol.id === 'protocol-1')!;
    const stopped = updated.find((protocol) => protocol.id === 'protocol-2')!;
    const later = updated.find((protocol) => protocol.id === 'protocol-3')!;

    expect(source.updates[0].recurring).toBe(true);
    expect(stopped.updates[0].recurring).toBe(false);
    expect(later.updates[0].recurring).toBe(false);
    expect(later.updates[0].title).toBe('Later copy');
  });

  it('preserves spaces in protocol titles and entry headlines', () => {
    const protocols = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        title: 'My protocol title ',
        updates: [{ title: 'Update with spaces ', body: 'Details' }],
      },
    ]);

    expect(protocols[0].title).toBe('My protocol title ');
    expect(protocols[0].updates[0].title).toBe('Update with spaces ');
  });

  it('creates new meeting protocols with the current local date and a stopped duration counter', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 6, 11, 30));

      const protocol = createMeetingProtocol();

      expect(protocol.date).toBe('2026-06-06');
      expect(protocol.durationSeconds).toBe(0);
      expect(protocol.timerStartedAt).toBeUndefined();
      expect(protocol.title).toBe('Tägliches Platz-Plenum');
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalizes and formats meeting protocol durations', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        durationSeconds: 3661.8,
        timerStartedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);

    expect(protocol.durationSeconds).toBe(3661);
    expect(protocol.timerStartedAt).toBe('2026-06-06T10:00:00.000Z');
    expect(formatProtocolDuration(protocol.durationSeconds)).toBe('01:01:01');
    expect(protocolConversionBody(protocol)).toContain('Duration: 01:01:01');
  });

  it('keeps plenum guidance as instruction text outside protocol content', () => {
    const body = createMeetingProtocolTemplate('2026-06-06', 3661);
    const headlines = extractProtocolHeadlines(body).map((headline) => headline.text);

    expect(headlines).not.toContain('Thema 1 (Name)');
  });

  it('renders edited protocol instruction templates with protocol placeholders', () => {
    const body = createMeetingProtocolTemplate('2026-06-06', 61, '# {title}\n{date}\n{duration}\n{endDate}');

    expect(body).toBe('# Tägliches Platz-Plenum\nSa. 06.06.26\n01:01\n06.06.26');
  });

  it('extracts markdown headings from protocol bodies', () => {
    const headlines = extractProtocolHeadlines('# Main\nText\n## Thema A\n- detail').map((headline) => headline.text);

    expect(headlines).toEqual(['Main', 'Thema A']);
  });

  it('reorders protocol entries within the same section without dropping entries', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'First' },
          { id: 'update-2', title: 'Second' },
          { id: 'update-3', title: 'Third' },
        ],
        topics: [{ id: 'topic-1', title: 'Topic' }],
      },
    ]);

    const moved = moveProtocolItem(protocol, 'updates', 'update-3', 'updates', 'update-1', '2026-06-06T11:00:00.000Z');

    expect(moved.updates.map((item) => item.id)).toEqual(['update-3', 'update-1', 'update-2']);
    expect(moved.topics.map((item) => item.id)).toEqual(['topic-1']);
    expect(moved.updates[0].updatedAt).toBe('2026-06-06T11:00:00.000Z');
    expect(moved.updatedAt).toBe('2026-06-06T11:00:00.000Z');
  });

  it('moves protocol entries between sections without dropping source or target entries', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'Update' },
          { id: 'update-2', title: 'Move me' },
        ],
        topics: [
          { id: 'topic-1', title: 'Topic A' },
          { id: 'topic-2', title: 'Topic B' },
        ],
      },
    ]);

    const moved = moveProtocolItem(protocol, 'updates', 'update-2', 'topics', 'topic-2', '2026-06-06T11:00:00.000Z');

    expect(moved.updates.map((item) => item.id)).toEqual(['update-1']);
    expect(moved.topics.map((item) => item.id)).toEqual(['topic-1', 'update-2', 'topic-2']);
    expect(moved.topics[1]).toMatchObject({ id: 'update-2', title: 'Move me' });
  });

  it('keeps protocol unchanged when moving a missing entry', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Update' }],
      },
    ]);

    expect(moveProtocolItem(protocol, 'updates', 'missing', 'topics')).toBe(protocol);
  });

  it('merges different nested protocol edits without dropping either side', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        title: 'Samstag 06.06.26',
        updates: [{ id: 'update-1', title: 'Update A', owner: 'Alex', body: 'base update' }],
        topics: [{ id: 'topic-1', title: 'Topic A', owner: 'Mika', body: 'base topic' }],
        todos: [],
        body: 'base notes',
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [{ ...baseProtocol.updates[0], body: 'local update' }],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      topics: [{ ...baseProtocol.topics[0], body: 'remote topic' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates[0].body).toBe('local update');
    expect(merged.topics[0].body).toBe('remote topic');
    expect(merged.updatedAt).toBe('2026-06-06T10:06:00.000Z');
  });

  it('keeps both body versions when the same protocol entry body changes on two devices', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Weather', owner: 'Alex', body: 'base update' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [{ ...baseProtocol.updates[0], body: 'local device update' }],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [{ ...baseProtocol.updates[0], body: 'remote device update' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates).toHaveLength(1);
    expect(merged.updates[0].body).toContain('local device update');
    expect(merged.updates[0].body).toContain('remote device update');
    expect(merged.updates[0].body).toContain('Version from another device');
  });

  it('combines independent protocol todo and event conversion links from different devices', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        todos: [{ id: 'todo-item-1', title: 'Build shelf', owner: 'Alex', body: 'base todo' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      todos: [{ ...baseProtocol.todos[0], convertedTodoId: 'todo-1', updatedAt: '2026-06-06T10:05:00.000Z' }],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      todos: [{ ...baseProtocol.todos[0], convertedEventId: 'event-1', updatedAt: '2026-06-06T10:06:00.000Z' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.todos).toHaveLength(1);
    expect(merged.todos[0]).toMatchObject({
      id: 'todo-item-1',
      convertedTodoId: 'todo-1',
      convertedEventId: 'event-1',
    });
  });

  it('keeps one protocol entry when the same conversion link conflicts', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        todos: [{ id: 'todo-item-1', title: 'Build shelf', owner: 'Alex', body: 'base todo' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      todos: [{ ...baseProtocol.todos[0], convertedTodoId: 'todo-local', updatedAt: '2026-06-06T10:05:00.000Z' }],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      todos: [{ ...baseProtocol.todos[0], convertedTodoId: 'todo-remote', updatedAt: '2026-06-06T10:06:00.000Z' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.todos).toHaveLength(1);
    expect(merged.todos[0]).toMatchObject({
      id: 'todo-item-1',
      convertedTodoId: 'todo-remote',
    });
  });

  it('keeps one protocol entry and uses newer headline when headline edits conflict', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Weather', owner: 'Alex', body: 'base update' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [{ ...baseProtocol.updates[0], title: 'Local weather', updatedAt: '2026-06-06T10:05:00.000Z' }],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [{ ...baseProtocol.updates[0], title: 'Remote weather', updatedAt: '2026-06-06T10:06:00.000Z' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates).toHaveLength(1);
    expect(merged.updates[0]).toMatchObject({
      id: 'update-1',
      title: 'Remote weather',
    });
  });

  it('drops generated other-device protocol entry duplicates when the original entry still exists', () => {
    const [protocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'Weather' },
          { id: 'update-1-other-device', title: 'Weather (other device)' },
          { id: 'update-1-other-device-2', title: 'Weather (other device)' },
        ],
      },
    ]);

    expect(protocol.updates.map((item) => item.id)).toEqual(['update-1']);
  });

  it('keeps local protocol entry order when another device has no order change', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'First' },
          { id: 'update-2', title: 'Second' },
          { id: 'update-3', title: 'Third' },
        ],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [baseProtocol.updates[2], baseProtocol.updates[0], baseProtocol.updates[1]],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates.map((item) => item.id)).toEqual(['update-3', 'update-1', 'update-2']);
  });

  it('keeps remote protocol additions when local device reorders entries', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'First' },
          { id: 'update-2', title: 'Second' },
        ],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [baseProtocol.updates[1], baseProtocol.updates[0]],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [...baseProtocol.updates, { id: 'update-3', title: 'Remote addition', owner: '', body: '', createdAt: '2026-06-06T10:06:00.000Z', updatedAt: '2026-06-06T10:06:00.000Z' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates.map((item) => item.id)).toEqual(['update-2', 'update-1', 'update-3']);
  });

  it('applies remote protocol item moves between sections when local device is unchanged', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'Stay update' },
          { id: 'update-2', title: 'Move me' },
        ],
        topics: [{ id: 'topic-1', title: 'Topic' }],
        todos: [{ id: 'todo-1', title: 'Todo' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = { ...baseProtocol };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [baseProtocol.updates[0]],
      topics: [baseProtocol.topics[0], { ...baseProtocol.updates[1], updatedAt: '2026-06-06T10:06:00.000Z' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates.map((item) => item.id)).toEqual(['update-1']);
    expect(merged.topics.map((item) => item.id)).toEqual(['topic-1', 'update-2']);
    expect(merged.todos.map((item) => item.id)).toEqual(['todo-1']);
  });

  it('keeps local protocol item edits when another device moves that item between sections', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'Stay update' },
          { id: 'update-2', title: 'Move me', body: 'base body' },
        ],
        topics: [{ id: 'topic-1', title: 'Topic' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [
        baseProtocol.updates[0],
        { ...baseProtocol.updates[1], body: 'local edited body', updatedAt: '2026-06-06T10:05:00.000Z' },
      ],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [baseProtocol.updates[0]],
      topics: [baseProtocol.topics[0], { ...baseProtocol.updates[1], updatedAt: '2026-06-06T10:06:00.000Z' }],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates.map((item) => item.id)).toEqual(['update-1']);
    expect(merged.topics.map((item) => item.id)).toEqual(['topic-1', 'update-2']);
    expect(merged.topics[1].body).toBe('local edited body');
  });

  it('keeps a moved protocol item in the moved section when another device comments on it', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          { id: 'update-1', title: 'Stay update' },
          { id: 'update-2', title: 'Move me', body: 'base body' },
        ],
        topics: [{ id: 'topic-1', title: 'Topic' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = moveProtocolItem(
      baseProtocol,
      'updates',
      'update-2',
      'topics',
      'topic-1',
      '2026-06-06T10:05:00.000Z',
    );
    const remoteProtocol = {
      ...baseProtocol,
      updates: [
        baseProtocol.updates[0],
        {
          ...baseProtocol.updates[1],
          comments: [
            {
              id: 'comment-remote-move',
              body: 'Remote comment during protocol item move',
              createdAt: '2026-06-06T10:06:00.000Z',
              updatedAt: '2026-06-06T10:06:00.000Z',
            },
          ],
          updatedAt: '2026-06-06T10:06:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates.map((item) => item.id)).toEqual(['update-1']);
    expect(merged.topics.map((item) => item.id)).toEqual(['update-2', 'topic-1']);
    expect(merged.topics[0].comments?.map((comment) => comment.body)).toEqual([
      'Remote comment during protocol item move',
    ]);
  });

  it('keeps both versions when protocol notes change on two devices', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        body: 'base notes',
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      body: 'local notes',
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      body: 'remote notes',
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.body).toContain('local notes');
    expect(merged.body).toContain('remote notes');
    expect(merged.body).toContain('Version from another device');
  });

  it('keeps comments added to the same protocol item on different devices', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Weather', owner: 'Alex', body: 'base update' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          comments: [
            {
              id: 'comment-local',
              body: 'Local protocol comment',
              createdAt: '2026-06-06T10:05:00.000Z',
              updatedAt: '2026-06-06T10:05:00.000Z',
            },
          ],
          updatedAt: '2026-06-06T10:05:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          comments: [
            {
              id: 'comment-remote',
              body: 'Remote protocol comment',
              createdAt: '2026-06-06T10:06:00.000Z',
              updatedAt: '2026-06-06T10:06:00.000Z',
            },
          ],
          updatedAt: '2026-06-06T10:06:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates[0].comments?.map((comment) => comment.body)).toEqual([
      'Local protocol comment',
      'Remote protocol comment',
    ]);
  });

  it('syncs protocol item comment deletion while keeping comments added on another device', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          {
            id: 'update-1',
            title: 'Weather',
            owner: 'Alex',
            body: 'base update',
            comments: [
              {
                id: 'comment-base',
                body: 'Delete protocol comment',
                createdAt: '2026-06-06T10:00:00.000Z',
                updatedAt: '2026-06-06T10:00:00.000Z',
              },
            ],
          },
        ],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          comments: [],
          updatedAt: '2026-06-06T10:05:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          comments: [
            ...(baseProtocol.updates[0].comments ?? []),
            {
              id: 'comment-remote',
              body: 'Remote protocol comment',
              createdAt: '2026-06-06T10:06:00.000Z',
              updatedAt: '2026-06-06T10:06:00.000Z',
            },
          ],
          updatedAt: '2026-06-06T10:06:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates[0].comments?.map((comment) => comment.body)).toEqual(['Remote protocol comment']);
  });

  it('keeps a remote protocol item comment when the same item is edited locally', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Weather', owner: 'Alex', body: 'base update' }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          title: 'Locally edited update',
          body: 'Locally edited update body',
          updatedAt: '2026-06-06T10:05:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          comments: [
            {
              id: 'comment-remote',
              body: 'Remote protocol comment while editing',
              createdAt: '2026-06-06T10:06:00.000Z',
              updatedAt: '2026-06-06T10:06:00.000Z',
            },
          ],
          updatedAt: '2026-06-06T10:06:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates[0]).toMatchObject({
      title: 'Locally edited update',
      body: 'Locally edited update body',
    });
    expect(merged.updates[0].comments?.map((comment) => comment.body)).toEqual([
      'Remote protocol comment while editing',
    ]);
  });

  it('merges recurring toggles on protocol items from another device', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [{ id: 'update-1', title: 'Weather', body: 'base update', recurring: false }],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          body: 'local edited body',
          updatedAt: '2026-06-06T10:05:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          recurring: true,
          recurringSourceId: 'update-1',
          updatedAt: '2026-06-06T10:06:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates[0]).toMatchObject({
      body: 'local edited body',
      recurring: true,
      recurringSourceId: 'update-1',
    });
  });

  it('merges recurring toggle-off on protocol items from another device', () => {
    const [baseProtocol] = normalizeMeetingProtocols([
      {
        id: 'protocol-1',
        date: '2026-06-06',
        updates: [
          {
            id: 'update-1',
            title: 'Weather',
            body: 'base update',
            recurring: true,
            recurringSourceId: 'update-1',
          },
        ],
        updatedAt: '2026-06-06T10:00:00.000Z',
      },
    ]);
    const localProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          body: 'local edited body',
          updatedAt: '2026-06-06T10:05:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:05:00.000Z',
    };
    const remoteProtocol = {
      ...baseProtocol,
      updates: [
        {
          ...baseProtocol.updates[0],
          recurring: false,
          updatedAt: '2026-06-06T10:06:00.000Z',
        },
      ],
      updatedAt: '2026-06-06T10:06:00.000Z',
    };

    const [merged] = mergeMeetingProtocols([baseProtocol], [localProtocol], [remoteProtocol]);

    expect(merged.updates[0]).toMatchObject({
      body: 'local edited body',
      recurring: false,
      recurringSourceId: 'update-1',
    });
  });
});
