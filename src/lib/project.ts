import type { TimelineProject } from './types';
import { defaultTypeColors } from './colors';
import { defaultProtocolInstructionTemplate, normalizeMeetingProtocols } from './meetingProtocols';
import { defaultTodoStatuses } from './todos';

export const defaultProjectBackgroundColor = '#fffff4';

export function createHash() {
  return `tl-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeHash(input: string) {
  const clean = input
    .replace(/^#/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return clean || createHash();
}

export function projectStorageKey(hash: string) {
  return `timeline:project:${normalizeHash(hash)}`;
}

export function titleFromHash(hash: string) {
  return normalizeHash(hash)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeProjectBackgroundColor(color: string | undefined) {
  return /^#[0-9a-f]{6}$/i.test(color ?? '') ? color! : defaultProjectBackgroundColor;
}

export function createDefaultProject(hash: string): TimelineProject {
  const normalizedHash = normalizeHash(hash);
  const defaultTodoCreatedAt = '2026-06-01T09:00:00.000Z';

  return {
    version: 1,
    hash: normalizedHash,
    name: titleFromHash(normalizedHash) || 'New Timeline',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    infoMarkdown:
      '# Important info\n\nUse this section for context, decisions, links, and facts that should stay visible while reviewing the timeline.',
    protocolInstructionTemplate: defaultProtocolInstructionTemplate,
    events: [
      {
        id: 'event-kickoff',
        date: '2026-06-03',
        time: '09:00',
        what: 'Kickoff',
        who: 'Project team',
        type: 'milestone',
        category: 'milestone',
        color: '#d7ff2f',
        showOnTimeline: true,
        note: 'Initial timeline project created.',
      },
      {
        id: 'event-review-window',
        date: '2026-06-10',
        endDate: '2026-06-12',
        time: '10:00',
        what: 'Review window',
        who: 'Stakeholders',
        type: 'review',
        category: 'event',
        color: '#b985ff',
        showOnTimeline: true,
        note: 'Multi-day period example.',
      },
    ],
    meetingProtocols: normalizeMeetingProtocols(undefined),
    todos: [
      {
        id: 'todo-first',
        title: 'Add first real event',
        who: 'Project team',
        body: '- Switch to edit mode\n- Click the timeline\n- Save the event',
        status: 'open',
        dueDate: '2026-06-05',
        createdAt: defaultTodoCreatedAt,
        updatedAt: defaultTodoCreatedAt,
        showOnTimeline: true,
      },
    ],
    todoBoards: [
      {
        id: 'board-main',
        name: 'Main',
        todos: [
          {
            id: 'todo-first',
            title: 'Add first real event',
            who: 'Project team',
            body: '- Switch to edit mode\n- Click the timeline\n- Save the event',
            status: 'open',
            dueDate: '2026-06-05',
            createdAt: defaultTodoCreatedAt,
            updatedAt: defaultTodoCreatedAt,
            showOnTimeline: true,
          },
        ],
        statuses: defaultTodoStatuses,
        completedTodoStatus: 'done',
      },
    ],
    settings: {
      mode: 'view',
      showTodosOnTimeline: true,
      typeColors: defaultTypeColors,
      backgroundColor: defaultProjectBackgroundColor,
      todoStatuses: defaultTodoStatuses,
      completedTodoStatus: 'done',
      activeTodoBoardId: 'board-main',
      stickyLinks: [],
    },
  };
}
