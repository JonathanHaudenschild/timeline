import { defaultTodoStatuses, normalizeCompletedTodoStatus, normalizeTodo, normalizeTodoStatuses, touchTodo } from './todos';
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
    const todos = removeGeneratedTodoConflictDuplicates((board.todos ?? []).map(normalizeTodo));
    const statuses = normalizeTodoStatuses(board.statuses, todos);

    return {
      ...board,
      id,
      name: board.name?.trim() || `Board ${index + 1}`,
      todos,
      statuses,
      completedTodoStatus: normalizeCompletedTodoStatus(statuses, board.completedTodoStatus),
    };
  });
}

export function activeTodoBoard(project: TimelineProject) {
  const boards = normalizeTodoBoards(project);
  return boards.find((board) => board.id === project.settings.activeTodoBoardId) ?? boards[0];
}

export function findTodoBoardContainingTodo(boards: TimelineTodoBoard[], todoId: string) {
  return boards.find((board) => board.todos.some((todo) => todo.id === todoId));
}

export function replaceTodoInBoard(boards: TimelineTodoBoard[], boardId: string, todo: TimelineTodo) {
  return boards.map((board) => {
    if (board.id !== boardId) return board;

    const todos = board.todos.map((item) =>
      item.id === todo.id ? normalizeTodo(touchTodo({ ...todo, boardId: undefined })) : item,
    );
    const statuses = normalizeTodoStatuses(board.statuses, todos);

    return {
      ...board,
      todos,
      statuses,
      completedTodoStatus: normalizeCompletedTodoStatus(statuses, board.completedTodoStatus),
    };
  });
}

export function syncProjectTodoBoard(project: TimelineProject, boards: TimelineTodoBoard[], activeBoardId: string) {
  const normalizedBoards = boards.length
    ? boards.map((board) => {
        const todos = removeGeneratedTodoConflictDuplicates((board.todos ?? []).map(normalizeTodo));
        const statuses = normalizeTodoStatuses(board.statuses, todos);
        return {
          ...board,
          todos,
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
    const todos = (board.todos ?? []).map(normalizeTodo);
    const statuses = normalizeTodoStatuses(board.statuses, todos);

    return {
      ...board,
      todos,
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
    ...touchTodo(todo),
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

function removeGeneratedTodoConflictDuplicates(todos: TimelineTodo[]) {
  const todoIds = new Set(todos.map((todo) => todo.id));

  return todos.filter((todo) => {
    const originalId = generatedTodoConflictOriginalId(todo.id);
    return !originalId || !todoIds.has(originalId);
  });
}

function generatedTodoConflictOriginalId(todoId: string) {
  const match = todoId.match(/^(.+)-other-device(?:-\d+)?$/);
  return match?.[1];
}
