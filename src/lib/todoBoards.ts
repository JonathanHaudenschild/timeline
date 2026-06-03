import { defaultTodoStatuses, normalizeCompletedTodoStatus, normalizeTodoStatuses } from './todos';
import type { TimelineProject, TimelineTodo, TimelineTodoBoard } from './types';

export const defaultTodoBoardId = 'board-main';

export function normalizeTodoBoards(project: TimelineProject) {
  const sourceBoards =
    project.todoBoards?.length
      ? project.todoBoards
      : [
          {
            id: defaultTodoBoardId,
            name: 'Main',
            todos: project.todos,
            statuses: project.settings.todoStatuses,
            completedTodoStatus: project.settings.completedTodoStatus,
          },
        ];

  return sourceBoards.map((board, index) => {
    const id = board.id || `${defaultTodoBoardId}-${index + 1}`;
    const statuses = normalizeTodoStatuses(board.statuses, board.todos);

    return {
      ...board,
      id,
      name: board.name?.trim() || `Board ${index + 1}`,
      todos: board.todos ?? [],
      statuses,
      completedTodoStatus: normalizeCompletedTodoStatus(statuses, board.completedTodoStatus),
    };
  });
}

export function activeTodoBoard(project: TimelineProject) {
  const boards = normalizeTodoBoards(project);
  return boards.find((board) => board.id === project.settings.activeTodoBoardId) ?? boards[0];
}

export function syncProjectTodoBoard(project: TimelineProject, boards: TimelineTodoBoard[], activeBoardId: string) {
  const normalizedBoards = boards.length
    ? boards.map((board) => {
        const statuses = normalizeTodoStatuses(board.statuses, board.todos);
        return {
          ...board,
          statuses,
          completedTodoStatus: normalizeCompletedTodoStatus(statuses, board.completedTodoStatus),
        };
      })
    : [
        {
          id: defaultTodoBoardId,
          name: 'Main',
          todos: [],
          statuses: defaultTodoStatuses,
          completedTodoStatus: 'done',
        },
      ];
  const activeBoard = normalizedBoards.find((board) => board.id === activeBoardId) ?? normalizedBoards[0];

  return {
    ...project,
    todos: activeBoard.todos,
    todoBoards: normalizedBoards,
    settings: {
      ...project.settings,
      activeTodoBoardId: activeBoard.id,
      todoStatuses: activeBoard.statuses,
      completedTodoStatus: activeBoard.completedTodoStatus,
    },
  };
}

export function moveTodoBetweenBoards(
  boards: TimelineTodoBoard[],
  todo: TimelineTodo,
  sourceBoardId: string,
  targetBoardId: string,
) {
  const normalizedBoards = boards.map((board) => {
    const statuses = normalizeTodoStatuses(board.statuses, board.todos);

    return {
      ...board,
      statuses,
      completedTodoStatus: normalizeCompletedTodoStatus(statuses, board.completedTodoStatus),
    };
  });
  const sourceBoard = normalizedBoards.find((board) => board.id === sourceBoardId);
  const targetBoard = normalizedBoards.find((board) => board.id === targetBoardId);
  if (!sourceBoard || !targetBoard) return normalizedBoards;

  const targetStatuses = normalizeTodoStatuses(targetBoard.statuses, targetBoard.todos);
  const targetStatus = targetStatuses.includes(todo.status) ? todo.status : targetStatuses[0] ?? 'open';
  const movedTodo = {
    ...todo,
    boardId: undefined,
    status: targetStatus,
    order: targetBoard.todos.reduce((max, item) => Math.max(max, item.order ?? 0), 0) + 1,
  };

  return normalizedBoards.map((board) => {
    if (board.id === sourceBoardId) {
      return { ...board, todos: board.todos.filter((item) => item.id !== todo.id) };
    }

    if (board.id === targetBoardId) {
      return { ...board, todos: [...board.todos.filter((item) => item.id !== todo.id), movedTodo] };
    }

    return board;
  });
}
