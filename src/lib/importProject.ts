import type { TimelineProject } from './types';

export function preserveImportedProjectLocks(
  importedProject: TimelineProject,
  existingProject: TimelineProject,
): TimelineProject {
  const existingBoardPins = new Map(
    (existingProject.todoBoards ?? [])
      .filter((board) => board.pinHash)
      .map((board) => [board.id, board.pinHash]),
  );

  return {
    ...importedProject,
    settings: {
      ...importedProject.settings,
      viewPinHash: existingProject.settings.viewPinHash,
      editPinHash: existingProject.settings.editPinHash,
    },
    todoBoards: importedProject.todoBoards?.map((board) => ({
      ...board,
      pinHash: existingBoardPins.get(board.id),
    })),
  };
}
