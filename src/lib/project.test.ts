import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultProject,
  createHash,
  normalizeHash,
  projectStorageKey,
} from './project';
import { renderMarkdown } from '@/components/MarkdownBlock';
import { mergeProjectChanges } from '@/components/TimelineApp';
import { formatShortGermanDate, formatShortGermanDateRange } from './dateFormat';
import {
  createMeetingProtocol,
  createMeetingProtocolTemplate,
  defaultProtocolInstructionTemplate,
  extractProtocolHeadlines,
  formatProtocolDuration,
  mergeMeetingProtocols,
  moveProtocolItem,
  normalizeMeetingProtocols,
  protocolConversionBody,
} from './meetingProtocols';
import { ensureProjectHash } from './storage';
import { moveTodoBetweenBoards, normalizeTodoBoards, syncProjectTodoBoard } from './todoBoards';
import { isTodoCompleted, moveTodoWithinBoard, normalizeCompletedTodoStatus, normalizeTodoStatuses, renameTodoStatus } from './todos';

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

  it('keeps both todo versions when the same todo changes on different devices', () => {
    const baseProject = createDefaultProject('merge-todo-conflict');
    const baseBoard = baseProject.todoBoards?.[0];
    const baseTodo = baseBoard?.todos[0];
    if (!baseBoard || !baseTodo) throw new Error('Expected default todo board with todos');

    const localProject = {
      ...baseProject,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) => (todo.id === baseTodo.id ? { ...todo, title: 'Local title' } : todo)),
        },
      ],
    };
    const remoteProject = {
      ...baseProject,
      revision: 2,
      todoBoards: [
        {
          ...baseBoard,
          todos: baseBoard.todos.map((todo) => (todo.id === baseTodo.id ? { ...todo, title: 'Remote title' } : todo)),
        },
      ],
    };

    const merged = mergeProjectChanges(baseProject, localProject, remoteProject);
    const [mergedBoard] = normalizeTodoBoards(merged);

    expect(mergedBoard.todos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: baseTodo.id, title: 'Local title' }),
        expect.objectContaining({ id: `${baseTodo.id}-other-device`, title: 'Remote title (other device)' }),
      ]),
    );
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

  it('renders extended markdown formatting safely', () => {
    const html = renderMarkdown('_italic_ ++under++ ~~gone~~ [color=#e53935]red **bold**[/color]\n1. One\n- [x] Done\n> Quote');

    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<u>under</u>');
    expect(html).toContain('<s>gone</s>');
    expect(html).toContain('<span class="markdown-color-text" style="color: #e53935">red <strong>bold</strong></span>');
    expect(html).toContain('<ol>');
    expect(html).toContain('type="checkbox" disabled checked');
    expect(html).toContain('<blockquote>Quote</blockquote>');
  });

  it('uses a stable default project hash when the url has no hash', () => {
    const location = { hash: '' } as Location;

    expect(ensureProjectHash(location)).toBe('timeline');
    expect(location.hash).toBe('timeline');
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

    expect(headlines).toContain('Tägliches Platz-Plenum | Datum: Sa. 06.06.26 | Dauer: 01:01:01');
    expect(headlines).not.toContain('Thema 1 (Name)');
  });

  it('renders edited protocol instruction templates with protocol placeholders', () => {
    const body = createMeetingProtocolTemplate('2026-06-06', 61, '# {title}\n{date}\n{duration}\n{endDate}');

    expect(body).toBe('# Tägliches Platz-Plenum\nSa. 06.06.26\n01:01\n06.06.26');
    expect(defaultProtocolInstructionTemplate).toContain('{duration}');
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

  it('keeps both versions when the same protocol entry changes on two devices', () => {
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

    expect(merged.updates).toHaveLength(2);
    expect(merged.updates[0]).toMatchObject({ id: 'update-1', body: 'local device update' });
    expect(merged.updates[1]).toMatchObject({
      id: 'update-1-other-device',
      title: 'Weather (other device)',
      body: 'remote device update',
    });
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
});
