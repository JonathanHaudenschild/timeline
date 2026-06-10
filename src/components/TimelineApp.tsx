'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import Image from 'next/image';
import { ArrowUp, Eye, EyeOff, GripVertical, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { SelectField, TextField } from './FormControls';
import { MarkdownBlock } from './MarkdownBlock';
import { MarkdownEditor } from './MarkdownEditor';
import { MeetingProtocols } from './MeetingProtocols';
import { ProjectHeader } from './ProjectHeader';
import { RevisionRestoreDialog } from './RevisionRestoreDialog';
import { SectionShell } from './SectionShell';
import { StickyLinks } from './StickyLinks';
import { TimelineCanvas } from './TimelineCanvas';
import { TodoBoard } from './TodoBoard';
import { TodoEditor } from './TodoEditor';
import {
  fetchProject,
  fetchProjectMetadata,
  fetchProjectRevisions,
  importProjectFile,
  LockedProjectError,
  persistProject,
  ProjectSaveConflictError,
  restoreProjectRevision,
  type ProjectRevisionSummary,
} from '@/lib/api';
import { mergeTimelineComments } from '@/lib/comments';
import { formatShortGermanDateRange } from '@/lib/dateFormat';
import type { DuplicateCandidate } from '@/lib/duplicateHints';
import { createDefaultProject, defaultProjectBackgroundColor, normalizeHash, normalizeProjectBackgroundColor } from '@/lib/project';
import { mergeMeetingProtocols, normalizeMeetingProtocols } from '@/lib/meetingProtocols';
import { buildProjectLocationHash, ensureProjectHash, parseProjectLocationHash, type ProjectUrlTarget } from '@/lib/storage';
import {
  findTodoBoardContainingTodo,
  moveTodoBetweenBoards,
  normalizeTodoBoards,
  replaceTodoInBoard,
  syncProjectTodoBoard,
} from '@/lib/todoBoards';
import { normalizeCompletedTodoStatus, normalizeTodoStatuses, normalizeTodoTags, renameTodoStatus, touchTodo } from '@/lib/todos';
import type { MeetingProtocol, TimelineEvent, TimelineMode, TimelineProject, TimelineTodo, TimelineTodoBoard as TimelineTodoBoardData } from '@/lib/types';
import { uiCard, uiIconButton } from '@/lib/ui';
import { usePersistentState } from '@/lib/usePersistentState';
import packageJson from '../../package.json';

type PinDialogConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  requireRepeat?: boolean;
  inputLabel?: string;
  repeatLabel?: string;
};

type PinDialogResult = {
  pin: string;
  repeatedPin?: string;
};

type SaveState = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';

type MovableSection = 'info' | 'protocol' | 'timeline' | 'events' | 'todos';

const defaultSectionOrder: MovableSection[] = ['info', 'protocol', 'timeline', 'events', 'todos'];
const sectionNavigationLabels: Record<MovableSection, string> = {
  info: 'Info',
  protocol: 'Protocols',
  timeline: 'Timeline',
  events: 'Events',
  todos: 'Todos',
};
const todoBoardTabsClass =
  'mt-3 mb-2 flex min-w-0 flex-wrap items-center gap-1 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_18%,transparent)] bg-[var(--bg)] p-1 shadow-none max-sm:hidden';
const todoBoardTabButtonClass =
  'min-h-8 min-w-0 max-w-[190px] flex-none truncate rounded-[2px] border px-2.5 text-xs font-black shadow-none';
const todoBoardTabButtonInactiveClass =
  'border-transparent bg-transparent text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--line)_18%,transparent)] hover:bg-[var(--panel)] hover:text-[var(--text)]';
const todoBoardTabButtonActiveClass =
  'border-[color-mix(in_srgb,var(--line)_28%,transparent)] bg-[var(--primary)] text-[var(--on-primary)] shadow-[inset_0_-3px_0_var(--hot)]';
const todoBoardTabAddButtonClass =
  'icon-button tertiary ml-auto h-8 min-h-8 w-8 min-w-8 border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--panel)] p-0 max-xl:ml-0';
const lockShellClass = 'mx-auto flex flex-col gap-3.5 py-4 pb-7 w-[min(1480px,calc(100vw-24px))] !grid min-h-screen !w-full place-items-center !p-4';
const lockPanelClass =
  'grid w-full max-w-[520px] gap-[18px] rounded-[3px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--panel)] p-[18px] shadow-[var(--shadow)]';
const lockTitleClass = 'm-0 mb-2 text-[28px] leading-none font-black uppercase';
const mutedDescriptionClass = 'm-0 text-[var(--muted)] font-extrabold';
const pinFormClass = 'grid gap-3';
const formErrorClass =
  'rounded-[2px] border border-[color-mix(in_srgb,var(--danger)_42%,transparent)] bg-[var(--status-error-bg)] px-2.5 py-2 text-xs font-black text-[var(--danger)] uppercase';
const appVersion = packageJson.version;
const appVersionDate = '2026-06-07';

export function shouldStartSyncPolling({
  canSave,
  lockedHash,
  saveState,
}: {
  canSave: boolean;
  lockedHash: string | null;
  saveState: SaveState;
}) {
  return canSave && !lockedHash && saveState !== 'loading';
}

export function TimelineApp() {
  const { dialog: appDialogElement, alert: showAlert, confirm: showConfirm, prompt: showPrompt } = useAppDialog();
  const [project, setProject] = useState<TimelineProject>(() => createDefaultProject('timeline'));
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [selectedTodoId, setSelectedTodoId] = useState<string>();
  const [externalTodoDraft, setExternalTodoDraft] = useState<TimelineTodo | null>(null);
  const [draftEvent, setDraftEvent] = useState<TimelineEvent | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [collaborationNotice, setCollaborationNotice] = useState('');
  const [syncState, setSyncState] = useState<'idle' | 'checking' | 'updated' | 'merged' | 'offline'>('idle');
  const [lastSyncCheckAt, setLastSyncCheckAt] = useState('');
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [lockedHash, setLockedHash] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [showUnlockPin, setShowUnlockPin] = useState(false);
  const [lockError, setLockError] = useState('');
  const [pinDialog, setPinDialog] = useState<(PinDialogConfig & { error?: string }) | null>(null);
  const [revisionDialogRevisions, setRevisionDialogRevisions] = useState<ProjectRevisionSummary[] | null>(null);
  const [restoringRevision, setRestoringRevision] = useState<number | null>(null);
  const [pinDialogPin, setPinDialogPin] = useState('');
  const [pinDialogRepeat, setPinDialogRepeat] = useState('');
  const [selectedPopoverMinimized, setSelectedPopoverMinimized] = useState(false);
  const [urlTarget, setUrlTarget] = useState<ProjectUrlTarget | undefined>(() =>
    typeof window === 'undefined' ? undefined : parseProjectLocationHash(window.location.hash).target,
  );
  const [protocolItemTarget, setProtocolItemTarget] = useState<{ protocolId: string; itemId: string } | null>(null);
  const [copiedSectionLink, setCopiedSectionLink] = useState<ProjectUrlTarget['section'] | ''>('');
  const [unlockedTodoBoardIds, setUnlockedTodoBoardIds] = useState<string[]>([]);
  const sectionOrder = normalizeSectionOrder(project.settings.sectionOrder as MovableSection[] | undefined);
  const [isTodoSectionMinimized, setIsTodoSectionMinimized] = usePersistentState(
    `timeline:ui:todo-section-minimized:${project.hash}`,
    false,
  );
  const [isEventListMinimized, setIsEventListMinimized] = usePersistentState(
    `timeline:ui:event-list-minimized`,
    true,
  );
  const lastSavedJsonRef = useRef('');
  const lastSavedRevisionRef = useRef<number | undefined>(undefined);
  const canSaveRef = useRef(false);
  const latestProjectRef = useRef(project);
  const saveStateRef = useRef(saveState);
  const loadSequenceRef = useRef(0);
  const syncPollInFlightRef = useRef(false);
  const unsavedBackupTimeoutRef = useRef<number | undefined>(undefined);
  const projectPinRef = useRef<string | undefined>(undefined);
  const pinDialogResolverRef = useRef<((result: PinDialogResult | null) => void) | null>(null);
  const consumedUrlTargetRef = useRef('');
  const topRef = useRef<HTMLElement | null>(null);
  const infoRef = useRef<HTMLDivElement | null>(null);
  const protocolsRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<HTMLElement | null>(null);
  const todoRef = useRef<HTMLDivElement | null>(null);
  const selectedPopoverRef = useRef<HTMLElement | null>(null);
  const popoverDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    latestProjectRef.current = project;
    if (unsavedBackupTimeoutRef.current) window.clearTimeout(unsavedBackupTimeoutRef.current);
    if (!canSaveRef.current) return;

    unsavedBackupTimeoutRef.current = window.setTimeout(() => {
      const projectJson = projectPersistenceJson(latestProjectRef.current);
      if (projectJson !== lastSavedPersistenceJson(lastSavedJsonRef.current)) {
        saveUnsavedProjectBackup(latestProjectRef.current, parseProjectJson(lastSavedJsonRef.current));
      }
    }, 1200);

    return () => {
      if (unsavedBackupTimeoutRef.current) window.clearTimeout(unsavedBackupTimeoutRef.current);
    };
  }, [project]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    const backgroundColor = normalizeProjectBackgroundColor(project.settings.backgroundColor);
    // Parse hex to rgb for mixing a dark-mode variant
    const r = parseInt(backgroundColor.slice(1, 3), 16);
    const g = parseInt(backgroundColor.slice(3, 5), 16);
    const b = parseInt(backgroundColor.slice(5, 7), 16);
    // Dark mode bg: mix 12% of project color into a dark base (#181812)
    const dr = Math.round(0.12 * r + 0.88 * 24);
    const dg = Math.round(0.12 * g + 0.88 * 24);
    const db = Math.round(0.12 * b + 0.88 * 18);
    const darkBg = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
    document.documentElement.style.setProperty('--bg-project', backgroundColor);
    document.documentElement.style.setProperty('--bg-project-dark', darkBg);

    return () => {
      document.documentElement.style.setProperty('--bg-project', defaultProjectBackgroundColor);
      document.documentElement.style.removeProperty('--bg-project-dark');
    };
  }, [project.settings.backgroundColor]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!canSaveRef.current) return;
      if (projectPersistenceJson(latestProjectRef.current) === lastSavedPersistenceJson(lastSavedJsonRef.current)) return;

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, []);

  const projectWithOptionalLocalBackup = useCallback(
    async (loadedProject: TimelineProject) => {
      const backup = getUnsavedProjectBackup(loadedProject.hash);
      if (!backup || JSON.stringify(backup.project) === JSON.stringify(loadedProject)) return loadedProject;

      const shouldRestore = await showConfirm({
        title: 'Restore local edits?',
        message: 'Found unsaved edits from this browser. Restore them now?',
        confirmLabel: 'Restore edits',
      });

      return shouldRestore ? mergeProjectChanges(backup.baseProject, backup.project, loadedProject) : loadedProject;
    },
    [showConfirm],
  );

  const setLastSavedProject = useCallback((project: TimelineProject) => {
    const projectJson = JSON.stringify(project);
    lastSavedJsonRef.current = projectJson;
    lastSavedRevisionRef.current = project.revision;
    return projectJson;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const activeHash = ensureProjectHash(window.location);

    async function load(hash: string, projectPin?: string) {
      const loadId = ++loadSequenceRef.current;
      canSaveRef.current = false;
      setSaveState('loading');
      try {
        const loadedProject = await fetchProject(hash, projectPin);
        if (!cancelled && loadId === loadSequenceRef.current) {
          const projectToDisplay = await projectWithOptionalLocalBackup(loadedProject);
          projectPinRef.current = projectPin;
          if (projectPin) saveProjectPinSession(hash, projectPin);
          setLastSavedProject(loadedProject);
          if (projectToDisplay === loadedProject) clearUnsavedProjectBackup(loadedProject.hash);
          canSaveRef.current = true;
          setLockedHash(null);
          setUnlockPin('');
          setLockError('');
          setProject(projectToDisplay);
          setSaveState('saved');
        }
      } catch (error) {
        if (!cancelled && loadId === loadSequenceRef.current) {
          if (error instanceof LockedProjectError) {
            projectPinRef.current = undefined;
            if (projectPin) clearProjectPinSession(hash);
            setLockedHash(hash);
          }
          canSaveRef.current = false;
          setSaveState('error');
        }
      }
    }

    void load(activeHash, getProjectPinSession(activeHash));

    function handleHashChange() {
      const hash = ensureProjectHash(window.location);
      const target = parseProjectLocationHash(window.location.hash).target;
      consumedUrlTargetRef.current = '';
      setUrlTarget(target);
      if (hash === latestProjectRef.current.hash) {
        return;
      }

      projectPinRef.current = undefined;
      setLockedHash(null);
      setUnlockPin('');
      setLockError('');
      setSelectedEventId(undefined);
      setPopoverPosition(null);
      popoverDragRef.current = null;
      setDraftEvent(null);
      void load(hash, getProjectPinSession(hash));
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [projectWithOptionalLocalBackup, setLastSavedProject]);

  const rebaseUnsavedChanges = useCallback(async (latestRemoteProject?: TimelineProject) => {
    try {
      const localProject = latestProjectRef.current;
      const baseProject = parseProjectJson(lastSavedJsonRef.current) ?? localProject;
      const remoteProject = latestRemoteProject ?? await fetchProject(localProject.hash, projectPinRef.current);
      const mergedProject = mergeProjectChanges(baseProject, localProject, remoteProject);

      setLastSavedProject(remoteProject);
      canSaveRef.current = true;
      setProject(mergedProject);
      setSaveState('conflict');
      setCollaborationNotice('Merged newer server changes with your local edits. Saving again now.');
    } catch {
      canSaveRef.current = false;
      setSaveState('conflict');
      setCollaborationNotice('Could not merge newer server changes. Your unsaved edits are kept in this browser.');
    }
  }, [setLastSavedProject]);

  useEffect(() => {
    if (!canSaveRef.current || saveState === 'loading' || saveState === 'saving' || lockedHash) return;

    const projectJson = JSON.stringify(project);
    const persistentProjectJson = projectPersistenceJson(project);
    if (persistentProjectJson === lastSavedPersistenceJson(lastSavedJsonRef.current)) return;

    const timeout = window.setTimeout(() => {
      setSaveState('saving');
      persistProject(project, projectPinRef.current)
        .then((savedProject) => {
          if (projectPinRef.current) saveProjectPinSession(project.hash, projectPinRef.current);
          setLastSavedProject(savedProject);
          if (JSON.stringify(latestProjectRef.current) === projectJson) {
            setProject(savedProject);
            clearUnsavedProjectBackup(savedProject.hash);
          } else {
            setProject((currentProject) =>
              currentProject.hash === savedProject.hash
                ? { ...currentProject, revision: savedProject.revision }
                : currentProject,
            );
          }
          setSaveState('saved');
        })
        .catch((error) => {
          saveUnsavedProjectBackup(latestProjectRef.current, parseProjectJson(lastSavedJsonRef.current));
          setSaveState('error');
          if (error instanceof ProjectSaveConflictError) {
            void rebaseUnsavedChanges(error.latestProject);
          }
        });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [project, saveState, lockedHash, rebaseUnsavedChanges, setLastSavedProject]);

  useEffect(() => {
    if (!shouldStartSyncPolling({ canSave: canSaveRef.current, lockedHash, saveState })) return;

    let cancelled = false;

    async function checkRemoteProject() {
      if (!canSaveRef.current || lockedHash) return;
      if (saveStateRef.current === 'loading' || saveStateRef.current === 'saving') return;
      if (syncPollInFlightRef.current) return;

      syncPollInFlightRef.current = true;
      setSyncState('checking');
      try {
        const currentProject = latestProjectRef.current;
        const metadata = await fetchProjectMetadata(currentProject.hash, projectPinRef.current);
        if (cancelled) return;

        setLastSyncCheckAt(formatSyncTime(new Date()));
        if (metadata.revision === lastSavedRevisionRef.current) {
          setSyncState('idle');
          return;
        }

        const remoteProject = await fetchProject(currentProject.hash, projectPinRef.current);
        if (cancelled) return;

        if (remoteProject.revision === lastSavedRevisionRef.current) {
          setSyncState('idle');
          return;
        }

        const localJson = projectPersistenceJson(latestProjectRef.current);
        if (localJson === lastSavedPersistenceJson(lastSavedJsonRef.current)) {
          const projectToDisplay = preserveLocalActiveTodoBoard(remoteProject, latestProjectRef.current);
          setLastSavedProject(remoteProject);
          setProject(projectToDisplay);
          clearUnsavedProjectBackup(projectToDisplay.hash);
          setCollaborationNotice('Updated from another device.');
          setSaveState('saved');
          setSyncState('updated');
          return;
        }

        const baseProject = parseProjectJson(lastSavedJsonRef.current) ?? latestProjectRef.current;
        const mergedProject = mergeProjectChanges(baseProject, latestProjectRef.current, remoteProject);
        setLastSavedProject(remoteProject);
        canSaveRef.current = true;
        setProject(mergedProject);
        saveUnsavedProjectBackup(mergedProject, remoteProject);
        setSaveState('conflict');
        setSyncState('merged');
        setCollaborationNotice('Merged another device into your local edits. Autosaving the merged version now.');
      } catch {
        if (!cancelled) setSyncState('offline');
      } finally {
        syncPollInFlightRef.current = false;
      }
    }

    const interval = window.setInterval(() => {
      void checkRemoteProject();
    }, 3_000);

    function checkWhenVisible() {
      if (!document.hidden) void checkRemoteProject();
    }

    window.addEventListener('focus', checkWhenVisible);
    document.addEventListener('visibilitychange', checkWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkWhenVisible);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [lockedHash, saveState, setLastSavedProject]);

  const selectedEvent = project.events.find((event) => event.id === selectedEventId);
  const canEdit = project.settings.mode === 'edit' && saveState !== 'loading';
  const todoBoards = normalizeTodoBoards(project);
  const activeBoard = todoBoards.find((board) => board.id === project.settings.activeTodoBoardId) ?? todoBoards[0];
  const todoStatuses = normalizeTodoStatuses(activeBoard.statuses, activeBoard.todos);
  const completedTodoStatus = normalizeCompletedTodoStatus(todoStatuses, activeBoard.completedTodoStatus);
  const isActiveBoardLocked = Boolean(activeBoard.pinHash && !unlockedTodoBoardIds.includes(activeBoard.id));
  const externalTodoBoard = externalTodoDraft?.id ? findTodoBoardContainingTodo(todoBoards, externalTodoDraft.id) : undefined;
  const externalTodoStatuses = externalTodoBoard
    ? normalizeTodoStatuses(externalTodoBoard.statuses, externalTodoBoard.todos)
    : todoStatuses;
  const meetingProtocols = normalizeMeetingProtocols(project.meetingProtocols);
  const duplicateCandidates = buildDuplicateCandidates(todoBoards, meetingProtocols, project.events);
  const timelineProject = {
    ...project,
    todos: isActiveBoardLocked ? [] : activeBoard.todos,
    settings: {
      ...project.settings,
      todoStatuses,
      completedTodoStatus,
    },
  };
  const requestedProtocolId =
    urlTarget?.section === 'protocol' && 'protocolId' in urlTarget ? urlTarget.protocolId : undefined;
  const requestedProtocolItemId =
    protocolItemTarget && protocolItemTarget.protocolId === requestedProtocolId ? protocolItemTarget.itemId : undefined;

  function updateProject(nextProject: TimelineProject) {
    setCollaborationNotice('');
    if (nextProject.settings.mode !== 'edit') {
      setDraftEvent(null);
      setEditingInfo(false);
    }
    setProject(nextProject);
  }

  function sectionOrderStyle(section: MovableSection) {
    return { order: sectionOrder.indexOf(section) + 20 };
  }

  function sectionMoveControls(section: MovableSection) {
    if (!canEdit) return undefined;

    const index = sectionOrder.indexOf(section);

    return {
      canMoveUp: index > 0,
      canMoveDown: index >= 0 && index < sectionOrder.length - 1,
      onMoveUp: () => moveSection(section, -1),
      onMoveDown: () => moveSection(section, 1),
    };
  }

  function moveSection(section: MovableSection, direction: -1 | 1) {
    const index = sectionOrder.indexOf(section);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sectionOrder.length) return;

    const reordered = [...sectionOrder];
    const [movedSection] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, movedSection);
    updateProject({ ...project, settings: { ...project.settings, sectionOrder: reordered } });
  }

  const todoMoveControls = sectionMoveControls('todos');

  function selectEvent(eventId: string | undefined) {
    setSelectedEventId(eventId);
    setSelectedPopoverMinimized(false);
    if (!eventId) {
      setPopoverPosition(null);
      popoverDragRef.current = null;
    }
  }

  function selectTodo(todo: TimelineTodo) {
    setExternalTodoDraft(null);
    setSelectedTodoId(todo.id);
    scrollToElement(todoRef.current);
  }

  function openTodoFromProtocol(todoId: string) {
    const board = findTodoBoardContainingTodo(todoBoards, todoId);
    const todo = board?.todos.find((item) => item.id === todoId);
    if (!board) {
      void showAlert({ title: 'Todo not found', message: 'The linked todo could not be found. It may have been deleted.' });
      return;
    }
    if (board.pinHash && !unlockedTodoBoardIds.includes(board.id)) {
      void showAlert({ title: 'Board locked', message: 'Unlock that todo board before opening the linked todo.' });
      return;
    }

    setIsTodoSectionMinimized(false);
    setSelectedTodoId(todoId);
    setExternalTodoDraft(board.id === activeBoard.id || !todo ? null : { ...todo, boardId: board.id });
    scrollToElement(todoRef.current);
    window.setTimeout(() => {
      document.getElementById(`todo-card-${todoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 0);
  }

  function openEventFromProtocol(eventId: string) {
    const event = project.events.find((item) => item.id === eventId);
    if (!event) {
      void showAlert({ title: 'Event not found', message: 'The linked event could not be found. It may have been deleted.' });
      return;
    }

    selectEvent(event.id);
    scrollToElement(eventsRef.current);
    window.setTimeout(() => {
      document.getElementById(`event-row-${event.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 0);
  }

  function updateTodoBoards(boards: TimelineTodoBoardData[], activeBoardId = activeBoard.id) {
    updateProject(syncProjectTodoBoard(project, boards, activeBoardId));
  }

  function updateActiveTodoBoard(nextBoard: TimelineTodoBoardData) {
    updateTodoBoards(
      todoBoards.map((board) => (board.id === nextBoard.id ? nextBoard : board)),
      nextBoard.id,
    );
  }

  function moveTodoToBoard(todo: TimelineTodo, sourceBoardId: string, targetBoardId: string) {
    updateTodoBoards(moveTodoBetweenBoards(todoBoards, todo, sourceBoardId, targetBoardId), targetBoardId);
    setSelectedTodoId(undefined);
  }

  function saveExternalTodo(todoToSave: TimelineTodo) {
    if (!externalTodoBoard) return;

    const targetBoardId = todoToSave.boardId ?? externalTodoBoard.id;
    const todoForSave = touchTodo({ ...todoToSave, boardId: undefined });
    const nextBoards =
      targetBoardId === externalTodoBoard.id
        ? replaceTodoInBoard(todoBoards, externalTodoBoard.id, todoForSave)
        : moveTodoBetweenBoards(todoBoards, todoForSave, externalTodoBoard.id, targetBoardId);

    updateProject(syncProjectTodoBoard(project, nextBoards, activeBoard.id));
    setExternalTodoDraft(null);
    setSelectedTodoId(undefined);
  }

  async function deleteExternalTodo() {
    if (!externalTodoBoard || !externalTodoDraft) return;
    if (
      !(await showConfirm({
        title: 'Delete todo?',
        message: `Delete "${externalTodoDraft.title || 'New todo'}"?`,
        confirmLabel: 'Delete todo',
        tone: 'danger',
      }))
    ) {
      return;
    }

    const nextBoards = todoBoards.map((board) =>
      board.id === externalTodoBoard.id
        ? { ...board, todos: board.todos.filter((todo) => todo.id !== externalTodoDraft.id) }
        : board,
    );
    updateProject(syncProjectTodoBoard(project, nextBoards, activeBoard.id));
    setExternalTodoDraft(null);
    setSelectedTodoId(undefined);
  }

  function convertEventToTodo(event: TimelineEvent) {
    const targetStatus = todoStatuses[0] ?? 'open';
    const now = new Date().toISOString();
    const todo: TimelineTodo = {
      id: crypto.randomUUID(),
      title: event.what || 'New todo',
      who: event.who,
      body: event.note,
      status: targetStatus,
      dueDate: event.date,
      createdAt: now,
      updatedAt: now,
      showOnTimeline: true,
      order: nextTodoOrder(activeBoard.todos, targetStatus),
    };
    const nextBoard = {
      ...activeBoard,
      todos: [...activeBoard.todos, todo],
      statuses: normalizeTodoStatuses(activeBoard.statuses, [...activeBoard.todos, todo]),
    };

    updateProject(
      syncProjectTodoBoard(
        { ...project, events: project.events.filter((item) => item.id !== event.id) },
        todoBoards.map((board) => (board.id === activeBoard.id ? nextBoard : board)),
        activeBoard.id,
      ),
    );
    selectEvent(undefined);
    setSelectedTodoId(todo.id);
  }

  function confirmEventCreation(message: string) {
    return showConfirm({
      title: 'Create event?',
      message,
      confirmLabel: 'Create event',
    });
  }

  async function convertTodoToEvent(todo: TimelineTodo) {
    if (!(await confirmEventCreation(`Create an event from todo "${todo.title || 'New todo'}"?`))) return false;

    const event: TimelineEvent = {
      id: crypto.randomUUID(),
      date: todo.dueDate || project.startDate,
      time: '',
      what: todo.title || 'New event',
      who: todo.who,
      type: 'todo',
      category: 'event',
      color: project.settings.typeColors.todo ?? '#d7ff2f',
      showOnTimeline: true,
      note: todo.body,
    };
    const nextBoard = {
      ...activeBoard,
      todos: activeBoard.todos.filter((item) => item.id !== todo.id),
    };

    updateProject(
      syncProjectTodoBoard(
        { ...project, events: [...project.events, event] },
        todoBoards.map((board) => (board.id === activeBoard.id ? nextBoard : board)),
        activeBoard.id,
      ),
    );
    setSelectedTodoId(undefined);
    selectEvent(event.id);
    return true;
  }

  function createTodoFromProtocol(source: {
    title: string;
    body: string;
    date: string;
    who?: string;
    protocolId?: string;
    protocolItemId?: string;
    protocolItemKind?: 'updates' | 'topics' | 'todos';
  }) {
    if (isActiveBoardLocked) {
      void showAlert({
        title: 'Board locked',
        message: 'Unlock the active todo board before adding a protocol todo to it.',
      });
      return;
    }

    const targetStatus = todoStatuses[0] ?? 'open';
    const now = new Date().toISOString();
    const todoForSave = {
      id: crypto.randomUUID(),
      protocolId: source.protocolId,
      protocolItemId: source.protocolItemId,
      title: source.title || 'Protocol todo',
      who: source.who ?? '',
      body: source.body,
      status: targetStatus,
      dueDate: source.date,
      createdAt: now,
      updatedAt: now,
      showOnTimeline: true,
      order: nextTodoOrder(activeBoard.todos, targetStatus),
    };
    const nextBoard = {
      ...activeBoard,
      todos: [...activeBoard.todos, todoForSave],
      statuses: normalizeTodoStatuses(activeBoard.statuses, [...activeBoard.todos, todoForSave]),
    };
    const protocolItemKind = source.protocolItemKind;
    const nextProtocols =
      source.protocolId && source.protocolItemId && protocolItemKind
        ? meetingProtocols.map((protocol) =>
          protocol.id === source.protocolId
            ? {
              ...protocol,
              [protocolItemKind]: protocol[protocolItemKind].map((item) =>
                item.id === source.protocolItemId ? { ...item, convertedTodoId: todoForSave.id, updatedAt: now } : item,
              ),
              updatedAt: now,
            }
            : protocol,
        )
        : meetingProtocols;

    updateProject(syncProjectTodoBoard(
      { ...project, meetingProtocols: nextProtocols },
      todoBoards.map((board) => (board.id === activeBoard.id ? nextBoard : board)),
      activeBoard.id,
    ));
  }

  function linkProtocolItemTodo(link: {
    protocols: MeetingProtocol[];
    protocolId: string;
    protocolItemId: string;
    protocolItemKind: 'updates' | 'topics' | 'todos';
    previousTodoId?: string;
    todoId?: string;
  }) {
    const now = new Date().toISOString();
    const nextBoards = todoBoards.map((board) => ({
      ...board,
      todos: board.todos.map((todo) => {
        const shouldClearPrevious =
          todo.id === link.previousTodoId ||
          (
            todo.id !== link.todoId &&
            todo.protocolId === link.protocolId &&
            todo.protocolItemId === link.protocolItemId
          );
        if (shouldClearPrevious) {
          return touchTodo({
            ...todo,
            protocolId: undefined,
            protocolItemId: undefined,
          }, now);
        }

        if (todo.id === link.todoId) {
          return touchTodo({
            ...todo,
            protocolId: link.protocolId,
            protocolItemId: link.protocolItemId,
          }, now);
        }

        return todo;
      }),
    }));

    updateProject(syncProjectTodoBoard(
      { ...project, meetingProtocols: link.protocols },
      nextBoards,
      activeBoard.id,
    ));
  }

  async function createEventFromProtocol(source: {
    title: string;
    body: string;
    date: string;
    time?: string;
    protocolId?: string;
    protocolItemId?: string;
    protocolItemKind?: 'updates' | 'topics' | 'todos';
  }) {
    if (!(await confirmEventCreation(`Create an event from "${source.title || 'this protocol'}"?`))) return;

    const event: TimelineEvent = {
      id: crypto.randomUUID(),
      date: source.date || project.startDate,
      time: source.time ?? '',
      what: source.title || 'Protocol event',
      who: '',
      type: 'protocol',
      category: 'event',
      color: project.settings.typeColors.protocol ?? '#00c2ff',
      showOnTimeline: true,
      note: source.body,
    };
    const now = new Date().toISOString();
    const protocolItemKind = source.protocolItemKind;
    const nextProtocols =
      source.protocolId && source.protocolItemId && protocolItemKind
        ? meetingProtocols.map((protocol) =>
          protocol.id === source.protocolId
            ? {
              ...protocol,
              [protocolItemKind]: protocol[protocolItemKind].map((item) =>
                item.id === source.protocolItemId ? { ...item, convertedEventId: event.id, updatedAt: now } : item,
              ),
              updatedAt: now,
            }
            : protocol,
        )
        : meetingProtocols;

    updateProject({ ...project, events: [...project.events, event], meetingProtocols: nextProtocols });
    if (!source.protocolItemId) {
      selectEvent(event.id);
      scrollToElement(timelineRef.current);
    }
  }

  function switchTodoBoard(boardId: string) {
    updateProject(syncProjectTodoBoard(project, todoBoards, boardId));
    setSelectedTodoId(undefined);
  }

  async function addTodoBoard() {
    const name = (await showPrompt({
      title: 'Add board',
      label: 'Board name',
      placeholder: 'Board name',
      confirmLabel: 'Add board',
    }))?.trim();
    if (!name) return;

    const board: TimelineTodoBoardData = {
      id: crypto.randomUUID(),
      name,
      todos: [],
      statuses: ['open', 'doing', 'done'],
      completedTodoStatus: 'done',
    };
    updateTodoBoards([...todoBoards, board], board.id);
    setUnlockedTodoBoardIds((ids) => [...ids, board.id]);
  }

  async function renameTodoBoard(board: TimelineTodoBoardData) {
    const name = (await showPrompt({
      title: 'Rename board',
      label: 'Board name',
      defaultValue: board.name,
      confirmLabel: 'Rename',
    }))?.trim();
    if (!name) return;
    updateActiveTodoBoard({ ...board, name });
  }

  async function deleteTodoBoard(board: TimelineTodoBoardData) {
    if (todoBoards.length <= 1) return;
    if (
      !(await showConfirm({
        title: 'Delete board?',
        message: `Delete board "${board.name}" and all its todos?`,
        confirmLabel: 'Delete board',
        tone: 'danger',
      }))
    ) {
      return;
    }

    const nextBoards = todoBoards.filter((item) => item.id !== board.id);
    updateTodoBoards(nextBoards, nextBoards[0].id);
    setUnlockedTodoBoardIds((ids) => ids.filter((id) => id !== board.id));
  }

  async function changeTodoBoardPin(board: TimelineTodoBoardData) {
    if (board.pinHash && !(await verifyTodoBoardPin(board, 'Change board PIN', 'Enter the current board PIN before setting a new one.'))) {
      return;
    }

    const result = await requestPinDialog({
      title: board.pinHash ? 'New board PIN' : 'Add board PIN',
      description: `This PIN is required before viewing "${board.name}".`,
      confirmLabel: board.pinHash ? 'Change PIN' : 'Add PIN',
      requireRepeat: true,
      inputLabel: 'Board PIN',
      repeatLabel: 'Repeat board PIN',
    });
    if (!result) return;

    updateActiveTodoBoard({ ...board, pinHash: await hashTodoBoardPin(project.hash, board.id, result.pin) });
    setUnlockedTodoBoardIds((ids) => (ids.includes(board.id) ? ids : [...ids, board.id]));
  }

  async function removeTodoBoardPin(board: TimelineTodoBoardData) {
    if (!board.pinHash) return;
    if (!(await verifyTodoBoardPin(board, 'Remove board PIN', 'Enter the current board PIN to remove this board lock.'))) return;

    updateActiveTodoBoard({ ...board, pinHash: undefined });
    setUnlockedTodoBoardIds((ids) => ids.filter((id) => id !== board.id));
  }

  async function unlockTodoBoard(board: TimelineTodoBoardData) {
    if (await verifyTodoBoardPin(board, 'Unlock board', `Enter the board PIN for "${board.name}".`)) {
      setUnlockedTodoBoardIds((ids) => (ids.includes(board.id) ? ids : [...ids, board.id]));
    }
  }

  function renderTodoBoardActions() {
    if (!canEdit) return null;

    return (
      <>
        <button
          type="button"
          className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
          onClick={() => void renameTodoBoard(activeBoard)}
          aria-label="Rename todo board"
          title="Rename board"
        >
          <Pencil size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
          onClick={() => void changeTodoBoardPin(activeBoard)}
          aria-label={activeBoard.pinHash ? 'Change board PIN' : 'Add board PIN'}
          title={activeBoard.pinHash ? 'Change board PIN' : 'Add board PIN'}
        >
          <KeyRound size={17} aria-hidden="true" />
        </button>
        {activeBoard.pinHash ? (
          <button
            type="button"
            className="icon-button tertiary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            onClick={() => void removeTodoBoardPin(activeBoard)}
            aria-label="Remove board PIN"
            title="Remove board PIN"
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        ) : null}
        {todoBoards.length > 1 ? (
          <button
            type="button"
            className="icon-button danger w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            onClick={() => void deleteTodoBoard(activeBoard)}
            aria-label="Delete todo board"
            title="Delete board"
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        ) : null}
      </>
    );
  }

  function openProtocolItemFromTodo(todo: TimelineTodo) {
    if (!todo.protocolId) return;

    const protocol = meetingProtocols.find((item) => item.id === todo.protocolId);
    if (!protocol) {
      void showAlert({ title: 'Protocol not found', message: 'The linked protocol could not be found. It may have been deleted.' });
      return;
    }

    const linkedItem = findProtocolItemForTodo(protocol, todo);
    setProtocolItemTarget(linkedItem ? { protocolId: protocol.id, itemId: linkedItem.itemId } : null);
    navigateToTarget({ section: 'protocol', protocolId: protocol.id });
    scrollToElement(protocolsRef.current);

    if (!linkedItem) return;
    window.setTimeout(() => {
      document
        .getElementById(`protocol-${protocol.id}-${linkedItem.kind}-${linkedItem.itemId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 120);
  }

  function createEvent(moment: { date: string; time: string }) {
    setDraftEvent({
      id: crypto.randomUUID(),
      date: moment.date,
      time: moment.time,
      what: '',
      who: '',
      type: 'milestone',
      category: 'event',
      color: '#d7ff2f',
      showOnTimeline: true,
      note: '',
    });
  }

  function saveEvent(eventDraft = draftEvent) {
    if (!eventDraft || !project) return;
    const eventToSave = eventDraft.time ? eventDraft : { ...eventDraft, endTime: undefined };
    const existing = project.events.some((event) => event.id === eventToSave.id);
    const events = existing
      ? project.events.map((event) => (event.id === eventToSave.id ? eventToSave : event))
      : [...project.events, eventToSave];
    updateProject({ ...project, events });
    selectEvent(eventToSave.id);
    setDraftEvent(null);
  }

  async function deleteDraftEvent() {
    if (!draftEvent) return;
    if (
      !(await showConfirm({
        title: 'Delete event?',
        message: `Delete event "${draftEvent.what || 'New event'}"?`,
        confirmLabel: 'Delete event',
        tone: 'danger',
      }))
    ) {
      return;
    }

    updateProject({ ...project, events: project.events.filter((event) => event.id !== draftEvent.id) });
    if (selectedEventId === draftEvent.id) selectEvent(undefined);
    setDraftEvent(null);
  }

  async function changeMode(mode: TimelineMode) {
    if (mode === 'view') {
      updateProject({ ...project, settings: { ...project.settings, mode: 'view' } });
      return;
    }

    if (project.settings.mode === 'edit') return;

    const existingPinHash = project.settings.editPinHash;
    if (!existingPinHash) {
      const result = await requestPinDialog({
        title: 'Create edit PIN',
        description: 'This PIN is required when switching this project into edit mode.',
        confirmLabel: 'Enable edit',
        requireRepeat: true,
        inputLabel: 'Edit PIN',
        repeatLabel: 'Repeat edit PIN',
      });
      if (!result) return;

      updateProject({
        ...project,
        settings: {
          ...project.settings,
          mode: 'edit',
          editPinHash: await hashEditPin(project.hash, result.pin),
        },
      });
      return;
    }

    let wrongAttempt = false;
    while (true) {
      const result = await requestPinDialog({
        title: 'Unlock edit mode',
        description: wrongAttempt ? 'That edit PIN was wrong. Try again.' : 'Enter the edit PIN to modify this timeline.',
        confirmLabel: 'Unlock edit',
        inputLabel: 'Edit PIN',
      });
      if (!result) return;

      if ((await hashEditPin(project.hash, result.pin)) === existingPinHash) {
        updateProject({ ...project, settings: { ...project.settings, mode: 'edit' } });
        return;
      }

      wrongAttempt = true;
    }
  }

  async function changeProjectPin() {
    if (project.settings.viewPinHash && !(await verifyCurrentProjectPin('Change project PIN', 'Enter the current project PIN before setting a new one.'))) {
      return;
    }

    const result = await requestPinDialog({
      title: project.settings.viewPinHash ? 'New project PIN' : 'Add project PIN',
      description: 'This PIN is required before anyone can view this project.',
      confirmLabel: project.settings.viewPinHash ? 'Change PIN' : 'Add PIN',
      requireRepeat: true,
      inputLabel: 'Project PIN',
      repeatLabel: 'Repeat project PIN',
    });
    if (!result) return;

    projectPinRef.current = result.pin;
    saveProjectPinSession(project.hash, result.pin);
    updateProject({
      ...project,
      settings: {
        ...project.settings,
        viewPinHash: await hashProjectPin(project.hash, result.pin),
      },
    });
  }

  async function changeEditPin() {
    if (project.settings.editPinHash && !(await verifyCurrentEditPin('Change edit PIN', 'Enter the current edit PIN before setting a new one.'))) {
      return;
    }

    const result = await requestPinDialog({
      title: project.settings.editPinHash ? 'New edit PIN' : 'Add edit PIN',
      description: 'This PIN is required when switching this project into edit mode.',
      confirmLabel: project.settings.editPinHash ? 'Change PIN' : 'Add PIN',
      requireRepeat: true,
      inputLabel: 'Edit PIN',
      repeatLabel: 'Repeat edit PIN',
    });
    if (!result) return;

    updateProject({
      ...project,
      settings: {
        ...project.settings,
        editPinHash: await hashEditPin(project.hash, result.pin),
      },
    });
  }

  async function removeProjectPin() {
    if (!project.settings.viewPinHash) return;

    if (!(await verifyCurrentProjectPin('Remove project PIN', 'Enter the current project PIN to remove the view lock.'))) {
      return;
    }

    projectPinRef.current = undefined;
    clearProjectPinSession(project.hash);
    updateProject({
      ...project,
      settings: {
        ...project.settings,
        viewPinHash: undefined,
      },
    });
  }

  function lockProject() {
    clearProjectPinSession(project.hash);
    projectPinRef.current = undefined;
    canSaveRef.current = false;
    setLockedHash(project.hash);
    setUnlockPin('');
    setLockError('');
    setSaveState('error');
  }

  async function restoreRevision() {
    try {
      const { revisions } = await fetchProjectRevisions(project.hash, projectPinRef.current);
      if (!revisions.length) {
        await showAlert({
          title: 'No revisions',
          message: 'No revisions found for this project yet.',
        });
        return;
      }

      setRevisionDialogRevisions(revisions);
    } catch (error) {
      setSaveState('error');
      await showAlert({
        title: 'Revisions unavailable',
        message: error instanceof Error ? error.message : 'Unable to load revisions.',
      });
    }
  }

  async function restoreSelectedRevision(revision: ProjectRevisionSummary) {
    if (revision.revision === project.revision || restoringRevision !== null) return;

    if (
      !(await showConfirm({
        title: `Restore r${revision.revision}?`,
        message: `${revision.name || 'Untitled project'}\n${revision.startDate} to ${revision.endDate}\n${revision.eventCount} events, ${revision.todoCount} todos, ${revision.protocolCount} protocols\n\nThis creates a new current revision and keeps revision history.`,
        confirmLabel: 'Restore',
      }))
    ) {
      return;
    }

    try {
      setRestoringRevision(revision.revision);
      setSaveState('saving');
      const restoredProject = await restoreProjectRevision(project.hash, revision.revision, projectPinRef.current);
      setLastSavedProject(restoredProject);
      clearUnsavedProjectBackup(restoredProject.hash);
      canSaveRef.current = true;
      setProject(restoredProject);
      setRevisionDialogRevisions(null);
      setDraftEvent(null);
      setSelectedEventId(undefined);
      setSelectedTodoId(undefined);
      setSaveState('saved');
      setSyncState('updated');
      setCollaborationNotice(`Restored revision ${revision.revision}.`);
    } catch (error) {
      setSaveState('error');
      await showAlert({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Unable to restore revision.',
      });
    } finally {
      setRestoringRevision(null);
    }
  }

  async function verifyCurrentProjectPin(title: string, description: string) {
    const viewPinHash = project.settings.viewPinHash;
    if (!viewPinHash) return true;

    let wrongAttempt = false;
    while (true) {
      const result = await requestPinDialog({
        title,
        description: wrongAttempt ? 'That project PIN was wrong. Try again.' : description,
        confirmLabel: 'Continue',
        inputLabel: 'Current project PIN',
      });
      if (!result) return false;

      const pinHash = await hashProjectPin(project.hash, result.pin);
      if (pinHash === viewPinHash) return true;

      wrongAttempt = true;
    }
  }

  async function verifyCurrentEditPin(title: string, description: string) {
    const editPinHash = project.settings.editPinHash;
    if (!editPinHash) return true;

    let wrongAttempt = false;
    while (true) {
      const result = await requestPinDialog({
        title,
        description: wrongAttempt ? 'That edit PIN was wrong. Try again.' : description,
        confirmLabel: 'Continue',
        inputLabel: 'Current edit PIN',
      });
      if (!result) return false;

      if ((await hashEditPin(project.hash, result.pin)) === editPinHash) return true;

      wrongAttempt = true;
    }
  }

  async function verifyTodoBoardPin(board: TimelineTodoBoardData, title: string, description: string) {
    if (!board.pinHash) return true;

    let wrongAttempt = false;
    while (true) {
      const result = await requestPinDialog({
        title,
        description: wrongAttempt ? 'That board PIN was wrong. Try again.' : description,
        confirmLabel: 'Continue',
        inputLabel: 'Board PIN',
      });
      if (!result) return false;

      if ((await hashTodoBoardPin(project.hash, board.id, result.pin)) === board.pinHash) return true;

      wrongAttempt = true;
    }
  }

  function requestPinDialog(config: PinDialogConfig) {
    setPinDialogPin('');
    setPinDialogRepeat('');
    setPinDialog({ ...config });

    return new Promise<PinDialogResult | null>((resolve) => {
      pinDialogResolverRef.current = resolve;
    });
  }

  function closePinDialog(result: PinDialogResult | null) {
    pinDialogResolverRef.current?.(result);
    pinDialogResolverRef.current = null;
    setPinDialog(null);
    setPinDialogPin('');
    setPinDialogRepeat('');
  }

  function submitPinDialog() {
    if (!pinDialog) return;

    const pin = pinDialogPin.trim();
    const repeatedPin = pinDialogRepeat.trim();
    if (pin.length < 4) {
      setPinDialog({ ...pinDialog, error: 'Use at least 4 characters.' });
      return;
    }

    if (pinDialog.requireRepeat && pin !== repeatedPin) {
      setPinDialog({ ...pinDialog, error: 'PINs do not match.' });
      return;
    }

    closePinDialog({ pin, repeatedPin: pinDialog.requireRepeat ? repeatedPin : undefined });
  }

  function clampPopoverPosition(x: number, y: number, width: number, height: number) {
    const margin = 14;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return {
      x: Math.min(Math.max(x, halfWidth + margin), window.innerWidth - halfWidth - margin),
      y: Math.min(Math.max(y, halfHeight + margin), window.innerHeight - halfHeight - margin),
    };
  }

  function startPopoverDrag(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !(event.target as HTMLElement).closest('.drag-handle')) return;

    const rect = selectedPopoverRef.current?.getBoundingClientRect();
    if (!rect) return;

    const originX = popoverPosition?.x ?? rect.left + rect.width / 2;
    const originY = popoverPosition?.y ?? rect.top + rect.height / 2;
    popoverDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragPopover(event: PointerEvent<HTMLElement>) {
    const drag = popoverDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setPopoverPosition(
      clampPopoverPosition(
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
        drag.width,
        drag.height,
      ),
    );
  }

  function stopPopoverDrag(event: PointerEvent<HTMLElement>) {
    if (popoverDragRef.current?.pointerId !== event.pointerId) return;
    popoverDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function scrollToElement(element: HTMLElement | null) {
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function navigateToTarget(target: ProjectUrlTarget) {
    const nextHash = buildProjectLocationHash(project.hash, target);
    if (window.location.hash !== `#${nextHash}`) {
      window.history.pushState(null, '', `#${nextHash}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }

    consumedUrlTargetRef.current = '';
    setUrlTarget(target);
  }

  function sectionLink(target: ProjectUrlTarget) {
    const hash = buildProjectLocationHash(project.hash, target);
    return `${window.location.origin}${window.location.pathname}${window.location.search}#${hash}`;
  }

  function copySectionLink(target: ProjectUrlTarget) {
    const link = sectionLink(target);
    const copy = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(link)
      : fallbackCopyText(link);

    void copy
      .then(() => {
        setCopiedSectionLink(target.section);
        window.setTimeout(() => setCopiedSectionLink(''), 1800);
      })
      .catch(() => {
        void showPrompt({
          title: 'Copy link',
          message: 'Clipboard access is blocked. Copy this link manually.',
          label: 'Link',
          defaultValue: link,
          confirmLabel: 'Done',
        });
      });
  }

  useEffect(() => {
    if (saveState === 'loading' || lockedHash) return;
    if (!urlTarget) return;
    const targetKey = projectUrlTargetKey(project.hash, urlTarget);
    if (consumedUrlTargetRef.current === targetKey) return;
    consumedUrlTargetRef.current = targetKey;

    const timeout = window.setTimeout(() => {
      switch (urlTarget.section) {
        case 'top':
          scrollToElement(topRef.current);
          break;
        case 'info':
          scrollToElement(infoRef.current);
          break;
        case 'todos':
          setIsTodoSectionMinimized(false);
          scrollToElement(todoRef.current);
          break;
        case 'timeline':
          scrollToElement(timelineRef.current);
          break;
        case 'events':
          scrollToElement(eventsRef.current);
          break;
        case 'protocol':
          scrollToElement(protocolsRef.current);
          break;
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [lockedHash, project.hash, saveState, setIsTodoSectionMinimized, urlTarget]);

  if (lockedHash) {
    return (
      <main className={lockShellClass}>
        <section className={lockPanelClass}>
          <div className="grid justify-items-center text-center">
            <Image
              className="mb-3 block h-[58px] w-[58px]"
              src="/icon.svg"
              alt=""
              width={58}
              height={58}
              aria-hidden="true"
              priority
            />
            <h1 className={lockTitleClass}>YUZZA</h1>
            <p className={mutedDescriptionClass}>
              <code>#{lockedHash}</code> needs a project PIN before it can be viewed.
            </p>
          </div>
          <form
            className={pinFormClass}
            onSubmit={(event) => {
              event.preventDefault();
              void fetchProject(lockedHash, unlockPin)
                .then(async (loadedProject) => {
                  const projectToDisplay = await projectWithOptionalLocalBackup(loadedProject);
                  projectPinRef.current = unlockPin;
                  saveProjectPinSession(lockedHash, unlockPin);
                  setLastSavedProject(loadedProject);
                  if (projectToDisplay === loadedProject) clearUnsavedProjectBackup(loadedProject.hash);
                  canSaveRef.current = true;
                  setProject(projectToDisplay);
                  setLockedHash(null);
                  setUnlockPin('');
                  setShowUnlockPin(false);
                  setLockError('');
                  setSaveState('saved');
                })
                .catch(() => {
                  projectPinRef.current = undefined;
                  clearProjectPinSession(lockedHash);
                  setSaveState('error');
                  setLockError('Wrong project PIN.');
                });
            }}
          >
            <TextField
              label="Project PIN"
              type={showUnlockPin ? 'text' : 'password'}
              value={unlockPin}
              onValueChange={setUnlockPin}
              autoFocus
            />
            <button
              type="button"
              className="tertiary inline-flex min-h-[var(--icon-button-size)] items-center justify-center gap-2 rounded-[2px] px-3 text-[11px] font-black uppercase"
              onClick={() => setShowUnlockPin((visible) => !visible)}
            >
              {showUnlockPin ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              {showUnlockPin ? 'Hide PIN' : 'Show PIN'}
            </button>
            {lockError ? <div className={formErrorClass}>{lockError}</div> : null}
            <button type="submit">Unlock project</button>
          </form>
        </section>
        {appDialogElement}
      </main>
    );
  }

  return (
    <main className="mx-auto flex flex-col gap-3.5 py-4 pb-7 w-[min(1480px,calc(100vw-24px))]" ref={topRef}>
      <nav className="fixed right-3.5 bottom-3.5 z-[35] flex flex-wrap justify-end gap-2 p-2 border border-[color-mix(in_srgb,var(--line)_26%,transparent)] rounded-[3px] bg-[var(--panel)] shadow-[var(--shadow-xl)]" aria-label="Quick navigation">
        <button
          type="button"
          className="icon-button secondary [min-height:30px] [padding:0_9px] text-[11px]"
          onClick={() => navigateToTarget({ section: 'top' })}
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        {sectionOrder.map((section) => (
          <button
            type="button"
            className="secondary [min-height:30px] [padding:0_9px] text-[11px]"
            key={section}
            onClick={() => navigateToTarget({ section })}
          >
            {sectionNavigationLabels[section]}
          </button>
        ))}
      </nav>

      <StickyLinks
        links={project.settings.stickyLinks ?? []}
        canEdit={canEdit}
        onChange={(stickyLinks) =>
          updateProject({
            ...project,
            settings: {
              ...project.settings,
              stickyLinks,
            },
          })
        }
      />

      <ProjectHeader
        project={project}
        saveState={saveState}
        syncState={syncState}
        syncLabel={syncStatusLabel(syncState, lastSyncCheckAt)}
        onChange={updateProject}
        onModeChange={(mode) => {
          void changeMode(mode);
        }}
        onProjectPinChange={() => {
          void changeProjectPin();
        }}
        onProjectPinRemove={removeProjectPin}
        onEditPinChange={() => {
          void changeEditPin();
        }}
        onRestoreRevision={() => {
          void restoreRevision();
        }}
        onOpenProject={() => {
          void showPrompt({
            title: 'Open project',
            label: 'Project hash',
            placeholder: 'timeline',
            confirmLabel: 'Open',
          }).then((hash) => {
            if (hash) window.location.hash = normalizeHash(hash);
          });
        }}
        onLockProject={lockProject}
        onImport={(file) => {
          setSaveState('saving');
          importProjectFile(project.hash, file, projectPinRef.current)
            .then((result) => {
              if (projectPinRef.current) saveProjectPinSession(project.hash, projectPinRef.current);
              setLastSavedProject(result.project);
              clearUnsavedProjectBackup(result.project.hash);
              canSaveRef.current = true;
              setProject(result.project);
              setSaveState('saved');
            })
            .catch((error) => {
              saveUnsavedProjectBackup(latestProjectRef.current, parseProjectJson(lastSavedJsonRef.current));
              setSaveState('error');
              if (error instanceof ProjectSaveConflictError) {
                canSaveRef.current = false;
                void showAlert({
                  title: 'Import not saved',
                  message: 'This project changed somewhere else. Import was not saved over newer data.',
                });
              }
            });
        }}
      />

      {collaborationNotice ? (
        <div className={`flex flex-wrap justify-between gap-[10px] items-center border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-none p-[8px_10px] text-[13px] font-[900] ${saveState === 'conflict' ? 'bg-[var(--hot)]' : 'bg-[var(--time-bg)]'}`}>
          <span>{collaborationNotice}</span>
          <button type="button" className="tertiary min-h-[28px] px-[8px] text-[10px]" onClick={() => setCollaborationNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}

	      <div className="ordered-section ordered-section-info" ref={infoRef} style={sectionOrderStyle('info')}>
	        <SectionShell
	          title="Info"
	          className="bg-[var(--panel)]"
	          meta={`${project.infoMarkdown.trim().split(/\s+/).filter(Boolean).length} words`}
	          moveControls={sectionMoveControls('info')}
	          actions={
	            canEdit ? (
	              <button
	                type="button"
	                className={`${uiIconButton} tertiary h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)]`}
	                onClick={() => setEditingInfo((value) => !value)}
	                aria-label={editingInfo ? 'Preview important info' : 'Edit important info'}
	                title={editingInfo ? 'Preview important info' : 'Edit important info'}
              >
                {editingInfo ? <Eye size={18} aria-hidden="true" /> : <Pencil size={18} aria-hidden="true" />}
              </button>
	            ) : null
	          }
	        >
	          <div className={`${uiCard} mt-3 p-3 max-sm:p-2.5`}>
	            {editingInfo ? (
	              <MarkdownEditor
	                value={project.infoMarkdown}
	                onChange={(infoMarkdown) => updateProject({ ...project, infoMarkdown })}
	                rows={7}
	              />
	            ) : (
	              <MarkdownBlock markdown={project.infoMarkdown} />
	            )}
	          </div>
	        </SectionShell>
	      </div>

      <div className="ordered-section min-w-0 max-w-full overflow-x-clip" ref={protocolsRef} style={sectionOrderStyle('protocol')}>
          <MeetingProtocols
          projectHash={project.hash}
          canEdit={canEdit}
          canUseProtocol={saveState !== 'loading'}
          protocols={meetingProtocols}
          instructionTemplate={project.protocolInstructionTemplate}
          requestedProtocolId={requestedProtocolId}
          requestedProtocolItemId={requestedProtocolItemId}
          onProtocolSelect={(protocolId) => navigateToTarget({ section: 'protocol', protocolId })}
          onChange={(protocols) => updateProject({ ...project, meetingProtocols: protocols })}
          onInstructionTemplateChange={(protocolInstructionTemplate) =>
            updateProject({ ...project, protocolInstructionTemplate })
          }
          onCreateTodo={createTodoFromProtocol}
          onOpenTodo={openTodoFromProtocol}
          onOpenEvent={openEventFromProtocol}
          duplicateCandidates={duplicateCandidates}
          todoLinkOptions={todoBoards.flatMap((board) =>
            board.todos.map((todo) => ({
              id: todo.id,
              label: `${todo.title || 'Untitled todo'} · ${board.name} · ${todo.status}`,
            })),
          )}
          eventLinkOptions={project.events.map((event) => ({
            id: event.id,
            label: `${event.what || 'Untitled event'} · ${event.date}${event.time ? ` ${event.time}` : ''}`,
          }))}
          onLinkProtocolItemTodo={linkProtocolItemTodo}
          onCopyLink={() => copySectionLink({ section: 'protocol' })}
          linkCopied={copiedSectionLink === 'protocol'}
          moveControls={sectionMoveControls('protocol')}
          onCreateEvent={createEventFromProtocol}
        />
      </div>

      <div className="ordered-section ordered-section-timeline" ref={timelineRef} style={sectionOrderStyle('timeline')}>
        <TimelineCanvas
          project={timelineProject}
          completedTodoStatus={completedTodoStatus}
          selectedEventId={selectedEventId}
          canEdit={canEdit}
          onCreateEvent={createEvent}
          onSelectEvent={(event) => {
            selectEvent(event.id);
          }}
          onSelectTodo={selectTodo}
          onToggleTodoOverlay={(showTodosOnTimeline) =>
            updateProject({
              ...project,
              settings: {
                ...project.settings,
                showTodosOnTimeline,
              },
            })
          }
          onCopyLink={() => copySectionLink({ section: 'timeline' })}
          linkCopied={copiedSectionLink === 'timeline'}
          moveControls={sectionMoveControls('timeline')}
        />
      </div>

      {draftEvent ? (
        <EventEditor
          draft={draftEvent}
          events={project.events}
          typeColors={project.settings.typeColors}
          duplicateCandidates={duplicateCandidates}
          onChange={setDraftEvent}
          onCancel={() => setDraftEvent(null)}
          onSave={saveEvent}
          onDelete={deleteDraftEvent}
          modal
        />
      ) : null}

      {externalTodoDraft && externalTodoBoard ? (
        <TodoEditor
          draft={externalTodoDraft}
          statuses={externalTodoStatuses}
          boards={todoBoards.map((board) => ({
            id: board.id,
            name: board.name,
            locked: Boolean(board.pinHash && !unlockedTodoBoardIds.includes(board.id)),
          }))}
          availableTags={normalizeTodoTags(externalTodoBoard.todos.flatMap((todo) => todo.tags ?? []))}
          duplicateCandidates={duplicateCandidates}
          onChange={setExternalTodoDraft}
          onCancel={() => {
            setExternalTodoDraft(null);
            setSelectedTodoId(undefined);
          }}
          onSave={(todoToSave) => saveExternalTodo(todoToSave ?? externalTodoDraft)}
          onDelete={() => void deleteExternalTodo()}
        />
      ) : null}

      {selectedEvent && !draftEvent ? (
        <aside
          className={`bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[0_18px_45px_color-mix(in_srgb,var(--line)_18%,transparent)] fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 overflow-auto grid gap-[10px] p-[14px] ${selectedPopoverMinimized ? 'w-[min(340px,calc(100vw-28px))] max-h-[96px] overflow-visible' : 'w-[min(460px,calc(100vw-28px))] max-h-[calc(100vh-72px)]'} max-sm:!left-2 max-sm:!right-2 max-sm:!top-auto max-sm:!bottom-[78px] max-sm:!w-auto max-sm:!max-w-none max-sm:![transform:none]`}
          ref={selectedPopoverRef}
          style={popoverPosition ? { left: `${popoverPosition.x}px`, top: `${popoverPosition.y}px` } : undefined}
        >
          <div
            className="group/popover flex justify-between gap-3 items-start overflow-visible touch-none select-none"
            onPointerDown={startPopoverDrag}
            onPointerMove={dragPopover}
            onPointerUp={stopPopoverDrag}
            onPointerCancel={stopPopoverDrag}
            >
              <div className="min-w-0 grid [grid-template-columns:auto_minmax(0,1fr)] gap-2 items-start">
              <button
                type="button"
                className="drag-handle w-[var(--icon-button-compact-size)] min-w-[var(--icon-button-compact-size)] min-h-[var(--icon-button-compact-size)] h-[var(--icon-button-compact-size)] p-0 border-[color-mix(in_srgb,var(--line)_26%,transparent)] bg-[var(--card-bg)] text-[var(--text)] cursor-grab shadow-[0_1px_0_color-mix(in_srgb,var(--line)_12%,transparent)] hover:border-[var(--primary)] hover:bg-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:bg-[var(--primary)] [&>svg]:block [&>svg]:[stroke-width:2.6] group-active/popover:cursor-grabbing"
                aria-label="Move selected event popover"
                title="Move"
              >
                <GripVertical size={15} aria-hidden="true" />
              </button>
              <div className={`text-[18px] font-[950] uppercase ${selectedPopoverMinimized ? 'max-h-[40px]' : 'max-h-[64px]'} overflow-hidden [overflow-wrap:anywhere] leading-[1.15]`}>{selectedEvent.what}</div>
            </div>
            <div className="flex gap-2 flex-none overflow-visible">
              <button
                type="button"
                className="icon-button tertiary w-[30px] min-w-[30px] min-h-[30px] p-0 leading-none"
                aria-label={selectedPopoverMinimized ? 'Expand selected event' : 'Minimize selected event'}
                onClick={() => setSelectedPopoverMinimized((minimized) => !minimized)}
              >
                {selectedPopoverMinimized ? '+' : '-'}
              </button>
              <button
                type="button"
                className="icon-button tertiary w-[30px] min-w-[30px] min-h-[30px] p-0 leading-none"
                aria-label="Close selected event"
                onClick={() => selectEvent(undefined)}
              >
                x
              </button>
            </div>
          </div>
          {selectedPopoverMinimized ? null : (
            <>
              <dl className="grid [grid-template-columns:58px_1fr] gap-[7px_10px] m-0 text-[13px]">
                <dt className="text-[var(--muted)] font-[800] uppercase">Date</dt>
              <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{formatShortGermanDateRange(selectedEvent.date, selectedEvent.endDate)}</dd>
              <dt className="text-[var(--muted)] font-[800] uppercase">Time</dt>
              <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{formatEventTimeRange(selectedEvent)}</dd>
                <dt className="text-[var(--muted)] font-[800] uppercase">Who</dt>
                <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{selectedEvent.who || '-'}</dd>
                <dt className="text-[var(--muted)] font-[800] uppercase">Type</dt>
                <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{selectedEvent.type}</dd>
                <dt className="text-[var(--muted)] font-[800] uppercase">Note</dt>
                <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">
                  {selectedEvent.note.trim() ? <MarkdownBlock markdown={selectedEvent.note} /> : '-'}
                </dd>
              </dl>
              {canEdit ? (
                <button type="button" className="secondary w-full min-h-[34px]" onClick={() => setDraftEvent({ ...selectedEvent })}>
                  Edit event
                </button>
              ) : null}
            </>
          )}
        </aside>
      ) : null}

      <section className="ordered-section grid grid-cols-[minmax(0,1fr)] items-start" ref={eventsRef} style={sectionOrderStyle('events')}>
        <EventList
          events={project.events}
          canEdit={canEdit}
          isMinimized={isEventListMinimized}
          onToggleMinimized={() => setIsEventListMinimized((v) => !v)}
          onAdd={(moment) => createEvent(moment ?? { date: selectedEvent?.date ?? project.startDate, time: selectedEvent?.time ?? '' })}
          onChange={(changedEvent) => {
            updateProject({
              ...project,
              events: project.events.map((event) => (event.id === changedEvent.id ? changedEvent : event)),
            });
          }}
          onToggleTimeline={(event) => {
            updateProject({
              ...project,
              events: project.events.map((item) =>
                item.id === event.id ? { ...item, showOnTimeline: item.showOnTimeline === false } : item,
              ),
            });
          }}
          onSetAllTimeline={(visible) => {
            updateProject({
              ...project,
              events: project.events.map((event) => ({ ...event, showOnTimeline: visible })),
            });
          }}
          onConvertToTodo={convertEventToTodo}
          onCopyLink={() => copySectionLink({ section: 'events' })}
          linkCopied={copiedSectionLink === 'events'}
          moveControls={sectionMoveControls('events')}
          onDelete={(eventId) => {
            updateProject({ ...project, events: project.events.filter((event) => event.id !== eventId) });
            if (selectedEventId === eventId) selectEvent(undefined);
          }}
        />
      </section>

      <div className="ordered-section min-w-0 max-w-full" ref={todoRef} style={sectionOrderStyle('todos')}>
        <SectionShell
          title="Todos"
          className="overflow-visible"
          meta={`${activeBoard.todos.length} / ${activeBoard.todos.length}`}
          copyLink={{
            onCopy: () => copySectionLink({ section: 'todos' }),
            copied: copiedSectionLink === 'todos',
            label: 'Copy todos link',
          }}
          moveControls={todoMoveControls}
          isCollapsed={isTodoSectionMinimized}
          onToggle={() => setIsTodoSectionMinimized((minimized) => !minimized)}
        >
          <div className={todoBoardTabsClass}>
            {todoBoards.map((board) => (
              <button
                type="button"
                className={`${todoBoardTabButtonClass} ${board.id === activeBoard.id ? todoBoardTabButtonActiveClass : todoBoardTabButtonInactiveClass}`}
                key={board.id}
                onClick={() => switchTodoBoard(board.id)}
              >
                {board.pinHash ? 'PIN ' : ''}{board.name}
              </button>
            ))}
            {canEdit ? (
              <button
                type="button"
                className={todoBoardTabAddButtonClass}
                onClick={addTodoBoard}
                aria-label="Add todo board"
                title="Add board"
              >
                <Plus size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="mb-2 mt-1.5 hidden max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_var(--icon-button-size)] max-sm:items-stretch max-sm:gap-2">
            <SelectField
              label="Board"
              value={activeBoard.id}
              onValueChange={switchTodoBoard}
              className="max-w-none"
            >
                {todoBoards.map((board) => (
                  <option value={board.id} key={board.id}>
                    {board.pinHash ? 'PIN ' : ''}{board.name}
                  </option>
                ))}
            </SelectField>
            {canEdit ? (
              <button
                type="button"
                className="icon-button tertiary todo-board-mobile-add"
                onClick={addTodoBoard}
                aria-label="Add todo board"
                title="Add board"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {canEdit && isActiveBoardLocked ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0 justify-end border-0 border-t border-t-[color-mix(in_srgb,var(--line)_14%,transparent)] rounded-[3px] bg-transparent shadow-none pt-2 pb-0">{renderTodoBoardActions()}</div>
          ) : null}
          {isActiveBoardLocked ? (
            <section className="grid gap-[10px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] bg-[var(--panel)] shadow-[var(--shadow)] p-[18px]">
              <h2>{activeBoard.name}</h2>
              <p>This todo board is PIN protected.</p>
              <button type="button" onClick={() => void unlockTodoBoard(activeBoard)}>
                Unlock board
              </button>
            </section>
          ) : (
            <TodoBoard
              key={activeBoard.id}
              todos={activeBoard.todos}
              statuses={todoStatuses}
              completedTodoStatus={completedTodoStatus}
              boardId={activeBoard.id}
              boardName={activeBoard.name}
              boards={todoBoards.map((board) => ({
                id: board.id,
                name: board.name,
                locked: Boolean(board.pinHash && !unlockedTodoBoardIds.includes(board.id)),
              }))}
              selectedTodoId={selectedTodoId}
              onTodoOpened={() => setSelectedTodoId(undefined)}
              onChange={(todos) =>
                updateActiveTodoBoard({
                  ...activeBoard,
                  todos,
                  statuses: normalizeTodoStatuses(activeBoard.statuses, todos),
                  completedTodoStatus: normalizeCompletedTodoStatus(activeBoard.statuses, activeBoard.completedTodoStatus),
                })
              }
              onMoveTodoToBoard={(todo, targetBoardId) => moveTodoToBoard(todo, activeBoard.id, targetBoardId)}
              onConvertTodoToEvent={convertTodoToEvent}
              onOpenProtocolItem={openProtocolItemFromTodo}
              onStatusesChange={(todoStatuses) =>
                updateActiveTodoBoard({
                  ...activeBoard,
                  statuses: normalizeTodoStatuses(todoStatuses, activeBoard.todos),
                  completedTodoStatus: normalizeCompletedTodoStatus(todoStatuses, activeBoard.completedTodoStatus),
                })
              }
              onRenameStatus={(fromStatus, toStatus) => {
                const renamed = renameTodoStatus(
                  todoStatuses,
                  activeBoard.todos,
                  fromStatus,
                  toStatus,
                  completedTodoStatus,
                );

                updateActiveTodoBoard({
                  ...activeBoard,
                  todos: renamed.todos,
                  statuses: renamed.statuses,
                  completedTodoStatus: renamed.completedStatus,
                });
              }}
              canEdit={canEdit}
              renderBoardActions={canEdit ? renderTodoBoardActions : undefined}
              duplicateCandidates={duplicateCandidates}
            />
          )}
        </SectionShell>
      </div>

      <footer className="[order:80] flex items-center justify-between gap-3 mt-4 font-bold text-[12px] text-[var(--muted)] rounded-[2px] border border-[color-mix(in_srgb,var(--line)_16%,transparent)] bg-[var(--input-bg)] px-3 py-2 shadow-none max-sm:gap-2 max-sm:flex-col max-sm:items-start">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            className="h-6 w-6 flex-none"
            src="/icon.svg"
            alt=""
            width={24}
            height={24}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase leading-none text-[var(--text)]">YUZZA</div>
            <div className="mt-0.5 text-[10px] font-black uppercase leading-none text-[var(--muted)]">
              v{appVersion} · {appVersionDate}
            </div>
          </div>
        </div>
        <span className="min-w-0 text-right max-sm:text-left">
          Project data is saved in Postgres under <code>#{project.hash}</code>.
        </span>
      </footer>

      {revisionDialogRevisions ? (
        <RevisionRestoreDialog
          currentRevision={project.revision}
          revisions={revisionDialogRevisions}
          restoringRevision={restoringRevision}
          onClose={() => {
            if (restoringRevision === null) setRevisionDialogRevisions(null);
          }}
          onRestore={(revision) => {
            void restoreSelectedRevision(revision);
          }}
        />
      ) : null}

      {appDialogElement}

      {pinDialog ? (
        <PinDialog
          config={pinDialog}
          pin={pinDialogPin}
          repeatedPin={pinDialogRepeat}
          onPinChange={setPinDialogPin}
          onRepeatedPinChange={setPinDialogRepeat}
          onCancel={() => closePinDialog(null)}
          onSubmit={submitPinDialog}
        />
      ) : null}
    </main>
  );
}

function PinDialog({
  config,
  pin,
  repeatedPin,
  onPinChange,
  onRepeatedPinChange,
  onCancel,
  onSubmit,
}: {
  config: PinDialogConfig & { error?: string };
  pin: string;
  repeatedPin: string;
  onPinChange: (pin: string) => void;
  onRepeatedPinChange: (pin: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [showPins, setShowPins] = useState(false);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-[18px] bg-[rgba(18,24,22,0.42)]" role="dialog" aria-modal="true" aria-label={config.title}>
      <form
        className="bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[14px] w-[min(720px,100%)] max-h-[calc(100vh-36px)] overflow-auto shadow-[0_20px_60px_color-mix(in_srgb,var(--line)_20%,transparent)] grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <div className="text-sm font-black uppercase mb-2.5">{config.title}</div>
          <p className={mutedDescriptionClass}>{config.description}</p>
        </div>
        <TextField
          label={config.inputLabel ?? 'PIN'}
          type={showPins ? 'text' : 'password'}
          value={pin}
          onValueChange={onPinChange}
          autoFocus
        />
        {config.requireRepeat ? (
          <TextField
            label={config.repeatLabel ?? 'Repeat PIN'}
            type={showPins ? 'text' : 'password'}
            value={repeatedPin}
            onValueChange={onRepeatedPinChange}
          />
        ) : null}
        <button
          type="button"
          className="tertiary inline-flex min-h-[var(--icon-button-size)] items-center justify-center gap-2 rounded-[2px] px-3 text-[11px] font-black uppercase"
          onClick={() => setShowPins((visible) => !visible)}
        >
          {showPins ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          {showPins ? 'Hide PIN' : 'Show PIN'}
        </button>
        {config.error ? <div className={formErrorClass}>{config.error}</div> : null}
        <div className="flex items-center justify-end gap-2.5">
          <button type="submit">{config.confirmLabel}</button>
          <button type="button" className="tertiary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function nextTodoOrder(todos: readonly TimelineTodo[], status: string) {
  return todos
    .filter((todo) => todo.status === status)
    .reduce((max, todo) => Math.max(max, todo.order ?? 0), 0) + 1;
}

function findProtocolItemForTodo(protocol: MeetingProtocol, todo: TimelineTodo) {
  const sections = ['updates', 'topics', 'todos'] as const;

  for (const kind of sections) {
    const item = protocol[kind].find((protocolItem) =>
      todo.protocolItemId
        ? protocolItem.id === todo.protocolItemId
        : protocolItem.convertedTodoId === todo.id,
    );
    if (item) return { kind, itemId: item.id };
  }

  return undefined;
}

function fallbackCopyText(text: string) {
  return new Promise<void>((resolve, reject) => {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(input);
    if (copied) {
      resolve();
      return;
    }

    reject(new Error('Copy failed'));
  });
}

function projectUrlTargetKey(projectHash: string, target: ProjectUrlTarget) {
  return buildProjectLocationHash(projectHash, target);
}

function unsavedProjectBackupKey(projectHash: string) {
  return `timeline:unsaved-project:${normalizeHash(projectHash)}`;
}

function getUnsavedProjectBackup(projectHash: string) {
  try {
    const rawValue = window.localStorage.getItem(unsavedProjectBackupKey(projectHash));
    if (!rawValue) return undefined;

    const backup = JSON.parse(rawValue) as { project?: TimelineProject; baseProject?: TimelineProject };
    if (backup.project?.hash !== normalizeHash(projectHash) || backup.baseProject?.hash !== normalizeHash(projectHash)) {
      clearUnsavedProjectBackup(projectHash);
      return undefined;
    }

    return {
      project: backup.project,
      baseProject: backup.baseProject,
    };
  } catch {
    clearUnsavedProjectBackup(projectHash);
    return undefined;
  }
}

function saveUnsavedProjectBackup(project: TimelineProject, baseProject?: TimelineProject) {
  if (!baseProject) return;

  window.localStorage.setItem(
    unsavedProjectBackupKey(project.hash),
    JSON.stringify({ savedAt: Date.now(), baseProject, project }),
  );
}

function clearUnsavedProjectBackup(projectHash: string) {
  window.localStorage.removeItem(unsavedProjectBackupKey(projectHash));
}

function parseProjectJson(json: string) {
  try {
    return JSON.parse(json) as TimelineProject;
  } catch {
    return undefined;
  }
}

function normalizeSectionOrder(sectionOrder: readonly MovableSection[] | undefined) {
  const seen = new Set<MovableSection>();
  const normalized: MovableSection[] = [];

  for (const section of sectionOrder ?? []) {
    if (!defaultSectionOrder.includes(section) || seen.has(section)) continue;
    seen.add(section);
    normalized.push(section);
  }

  for (const section of defaultSectionOrder) {
    if (!seen.has(section)) normalized.push(section);
  }

  return normalized;
}

export function mergeProjectChanges(baseProject: TimelineProject, localProject: TimelineProject, remoteProject: TimelineProject) {
  const mergedProject: TimelineProject = {
    ...remoteProject,
    name: changed(baseProject.name, localProject.name) ? localProject.name : remoteProject.name,
    startDate: changed(baseProject.startDate, localProject.startDate) ? localProject.startDate : remoteProject.startDate,
    endDate: changed(baseProject.endDate, localProject.endDate) ? localProject.endDate : remoteProject.endDate,
    infoMarkdown: mergeTextField(baseProject.infoMarkdown, localProject.infoMarkdown, remoteProject.infoMarkdown),
    protocolInstructionTemplate: mergeTextField(
      baseProject.protocolInstructionTemplate,
      localProject.protocolInstructionTemplate,
      remoteProject.protocolInstructionTemplate,
    ),
    events: mergeEventsById(baseProject.events, localProject.events, remoteProject.events),
    meetingProtocols: mergeMeetingProtocols(
      normalizeMeetingProtocols(baseProject.meetingProtocols),
      normalizeMeetingProtocols(localProject.meetingProtocols),
      normalizeMeetingProtocols(remoteProject.meetingProtocols),
    ),
    settings: mergeSettings(baseProject, localProject, remoteProject),
  };
  const boards = mergeTodoBoards(
    normalizeTodoBoards(baseProject),
    normalizeTodoBoards(localProject),
    normalizeTodoBoards(remoteProject),
  );
  const activeBoardId = localProject.settings.activeTodoBoardId ?? remoteProject.settings.activeTodoBoardId;

  return syncProjectTodoBoard(mergedProject, boards, activeBoardId ?? boards[0]?.id ?? 'board-main');
}

function preserveLocalActiveTodoBoard(remoteProject: TimelineProject, localProject: TimelineProject) {
  const boards = normalizeTodoBoards(remoteProject);
  const localActiveBoardId = localProject.settings.activeTodoBoardId;
  const activeBoardId = boards.some((board) => board.id === localActiveBoardId)
    ? localActiveBoardId
    : remoteProject.settings.activeTodoBoardId;

  return syncProjectTodoBoard(remoteProject, boards, activeBoardId ?? boards[0]?.id ?? 'board-main');
}

function lastSavedPersistenceJson(lastSavedJson: string) {
  const lastSavedProject = parseProjectJson(lastSavedJson);
  return lastSavedProject ? projectPersistenceJson(lastSavedProject) : lastSavedJson;
}

export function projectPersistenceJson(project: TimelineProject) {
  return JSON.stringify(projectPersistenceSnapshot(project));
}

function projectPersistenceSnapshot(project: TimelineProject) {
  if (!project.todoBoards?.length) return project;

  const snapshot: Partial<TimelineProject> & { settings: Partial<TimelineProject['settings']> } = {
    ...project,
    settings: { ...project.settings },
  };
  delete snapshot.todos;
  delete snapshot.settings.activeTodoBoardId;
  delete snapshot.settings.todoStatuses;
  delete snapshot.settings.completedTodoStatus;

  return snapshot;
}

function mergeSettings(baseProject: TimelineProject, localProject: TimelineProject, remoteProject: TimelineProject) {
  const remoteSettings = remoteProject.settings;
  const localSettings = localProject.settings;
  const baseSettings = baseProject.settings;
  const typeColors = { ...remoteSettings.typeColors };

  for (const [type, color] of Object.entries(localSettings.typeColors)) {
    if (changed(baseSettings.typeColors[type], color)) typeColors[type] = color;
  }

  return {
    ...remoteSettings,
    mode: localSettings.mode,
    showTodosOnTimeline: changed(baseSettings.showTodosOnTimeline, localSettings.showTodosOnTimeline)
      ? localSettings.showTodosOnTimeline
      : remoteSettings.showTodosOnTimeline,
    typeColors,
    backgroundColor: changed(baseSettings.backgroundColor, localSettings.backgroundColor)
      ? normalizeProjectBackgroundColor(localSettings.backgroundColor)
      : normalizeProjectBackgroundColor(remoteSettings.backgroundColor),
    editPinHash: changed(baseSettings.editPinHash, localSettings.editPinHash)
      ? localSettings.editPinHash
      : remoteSettings.editPinHash,
    viewPinHash: changed(baseSettings.viewPinHash, localSettings.viewPinHash)
      ? localSettings.viewPinHash
      : remoteSettings.viewPinHash,
    activeTodoBoardId: localSettings.activeTodoBoardId ?? remoteSettings.activeTodoBoardId,
    stickyLinks: mergeById(
      baseSettings.stickyLinks ?? [],
      localSettings.stickyLinks ?? [],
      remoteSettings.stickyLinks ?? [],
    ),
    sectionOrder: changed(JSON.stringify(baseSettings.sectionOrder), JSON.stringify(localSettings.sectionOrder))
      ? localSettings.sectionOrder
      : remoteSettings.sectionOrder,
  };
}

function mergeTodoBoards(
  baseBoards: TimelineTodoBoardData[],
  localBoards: TimelineTodoBoardData[],
  remoteBoards: TimelineTodoBoardData[],
) {
  const mergedBoards = mergeById(baseBoards, localBoards, remoteBoards);

  const boards = mergedBoards.map((board) => {
    const baseBoard = baseBoards.find((item) => item.id === board.id);
    const localBoard = localBoards.find((item) => item.id === board.id);
    const remoteBoard = remoteBoards.find((item) => item.id === board.id);
    if (!baseBoard || !localBoard || !remoteBoard) return board;

    return {
      ...board,
      name: mergeTextField(baseBoard.name, localBoard.name, remoteBoard.name),
      pinHash: mergeField(baseBoard.pinHash, localBoard.pinHash, remoteBoard.pinHash),
      todos: mergeTodosById(baseBoard.todos, localBoard.todos, remoteBoard.todos),
      statuses: mergeStringList(baseBoard.statuses ?? [], localBoard.statuses ?? [], remoteBoard.statuses ?? []),
      completedTodoStatus: changed(baseBoard.completedTodoStatus, localBoard.completedTodoStatus)
        ? localBoard.completedTodoStatus
        : remoteBoard.completedTodoStatus,
    };
  });

  return resolveMovedTodoDuplicates(baseBoards, localBoards, remoteBoards, boards);
}

function resolveMovedTodoDuplicates(
  baseBoards: TimelineTodoBoardData[],
  localBoards: TimelineTodoBoardData[],
  remoteBoards: TimelineTodoBoardData[],
  mergedBoards: TimelineTodoBoardData[],
) {
  const todoIds = new Set(mergedBoards.flatMap((board) => board.todos.map((todo) => todo.id)));
  let boards = mergedBoards;

  for (const todoId of todoIds) {
    const locations = boards.filter((board) => board.todos.some((todo) => todo.id === todoId));
    if (locations.length <= 1) continue;

    const baseLocation = findTodoLocation(baseBoards, todoId);
    const localLocation = findTodoLocation(localBoards, todoId);
    const remoteLocation = findTodoLocation(remoteBoards, todoId);
    const targetBoardId = movedTodoTargetBoardId(baseLocation, localLocation, remoteLocation);
    if (!targetBoardId || !boards.some((board) => board.id === targetBoardId)) continue;

    const mergedTodo =
      baseLocation?.todo && localLocation?.todo && remoteLocation?.todo
        ? mergeTodoFields(baseLocation.todo, localLocation.todo, remoteLocation.todo)
        : locations.find((board) => board.id === targetBoardId)?.todos.find((todo) => todo.id === todoId);
    if (!mergedTodo) continue;

    boards = boards.map((board) => {
      const todosWithoutDuplicate = board.todos.filter((todo) => todo.id !== todoId);
      if (board.id !== targetBoardId) return { ...board, todos: todosWithoutDuplicate };

      return {
        ...board,
        todos: [...todosWithoutDuplicate, { ...mergedTodo, boardId: undefined }],
      };
    });
  }

  return boards;
}

function findTodoLocation(boards: TimelineTodoBoardData[], todoId: string) {
  for (const board of boards) {
    const todo = board.todos.find((item) => item.id === todoId);
    if (todo) return { boardId: board.id, todo };
  }

  return null;
}

function movedTodoTargetBoardId(
  baseLocation: ReturnType<typeof findTodoLocation>,
  localLocation: ReturnType<typeof findTodoLocation>,
  remoteLocation: ReturnType<typeof findTodoLocation>,
) {
  if (!baseLocation || !localLocation || !remoteLocation) return undefined;

  const localMoved = localLocation.boardId !== baseLocation.boardId;
  const remoteMoved = remoteLocation.boardId !== baseLocation.boardId;
  if (localMoved && !remoteMoved) return localLocation.boardId;
  if (remoteMoved && !localMoved) return remoteLocation.boardId;
  if (localMoved && remoteMoved && localLocation.boardId !== remoteLocation.boardId) {
    return isLocalTodoNewer(localLocation.todo, remoteLocation.todo)
      ? localLocation.boardId
      : remoteLocation.boardId;
  }

  return undefined;
}

function mergeById<T extends { id: string }>(
  baseItems: readonly T[],
  localItems: readonly T[],
  remoteItems: readonly T[],
) {
  const result = new Map(remoteItems.map((item) => [item.id, item]));
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));

  for (const [id, localItem] of localById) {
    const baseItem = baseById.get(id);
    if (!baseItem || changed(baseItem, localItem)) {
      result.set(id, localItem);
    }
  }

  for (const [id, baseItem] of baseById) {
    if (localById.has(id)) continue;
    const remoteItem = result.get(id);
    if (!remoteItem || !changed(baseItem, remoteItem)) result.delete(id);
  }

  return [...result.values()];
}

function mergeEventsById(
  baseEvents: readonly TimelineEvent[],
  localEvents: readonly TimelineEvent[],
  remoteEvents: readonly TimelineEvent[],
) {
  const result = new Map(remoteEvents.map((event) => [event.id, event]));
  const baseById = new Map(baseEvents.map((event) => [event.id, event]));
  const localById = new Map(localEvents.map((event) => [event.id, event]));

  for (const [id, localEvent] of localById) {
    const baseEvent = baseById.get(id);
    const remoteEvent = result.get(id);

    if (baseEvent && remoteEvent && changed(baseEvent, localEvent) && changed(baseEvent, remoteEvent)) {
      result.set(id, mergeEventFields(baseEvent, localEvent, remoteEvent));
    } else if (!baseEvent || changed(baseEvent, localEvent)) {
      result.set(id, localEvent);
    }
  }

  for (const [id, baseEvent] of baseById) {
    if (localById.has(id)) continue;
    const remoteEvent = result.get(id);
    if (!remoteEvent || !changed(baseEvent, remoteEvent)) result.delete(id);
  }

  return [...result.values()];
}

function mergeEventFields(baseEvent: TimelineEvent, localEvent: TimelineEvent, remoteEvent: TimelineEvent): TimelineEvent {
  return {
    ...remoteEvent,
    date: mergeField(baseEvent.date, localEvent.date, remoteEvent.date),
    endDate: mergeField(baseEvent.endDate, localEvent.endDate, remoteEvent.endDate),
    time: mergeField(baseEvent.time, localEvent.time, remoteEvent.time),
    endTime: mergeField(baseEvent.endTime, localEvent.endTime, remoteEvent.endTime),
    what: mergeTextField(baseEvent.what, localEvent.what, remoteEvent.what),
    who: mergeTextField(baseEvent.who, localEvent.who, remoteEvent.who),
    type: mergeField(baseEvent.type, localEvent.type, remoteEvent.type),
    category: mergeField(baseEvent.category, localEvent.category, remoteEvent.category),
    color: mergeField(baseEvent.color, localEvent.color, remoteEvent.color),
    showOnTimeline: mergeField(baseEvent.showOnTimeline, localEvent.showOnTimeline, remoteEvent.showOnTimeline),
    note: mergeTextField(baseEvent.note, localEvent.note, remoteEvent.note),
  };
}

function mergeTodosById(
  baseTodos: readonly TimelineTodo[],
  localTodos: readonly TimelineTodo[],
  remoteTodos: readonly TimelineTodo[],
) {
  const result = new Map(remoteTodos.map((todo) => [todo.id, todo]));
  const baseById = new Map(baseTodos.map((todo) => [todo.id, todo]));
  const localById = new Map(localTodos.map((todo) => [todo.id, todo]));

  for (const [id, localTodo] of localById) {
    const baseTodo = baseById.get(id);
    const remoteTodo = result.get(id);

    if (baseTodo && remoteTodo && changed(baseTodo, localTodo) && changed(baseTodo, remoteTodo)) {
      result.set(id, mergeTodoFields(baseTodo, localTodo, remoteTodo));
    } else if (!baseTodo || changed(baseTodo, localTodo)) {
      result.set(id, localTodo);
    }
  }

  for (const [id, baseTodo] of baseById) {
    if (localById.has(id)) continue;
    const remoteTodo = result.get(id);
    if (!remoteTodo || !changed(baseTodo, remoteTodo)) result.delete(id);
  }

  return [...result.values()];
}

function mergeTodoFields(baseTodo: TimelineTodo, localTodo: TimelineTodo, remoteTodo: TimelineTodo): TimelineTodo {
  return {
    ...remoteTodo,
    protocolId: mergeField(baseTodo.protocolId, localTodo.protocolId, remoteTodo.protocolId),
    protocolItemId: mergeField(baseTodo.protocolItemId, localTodo.protocolItemId, remoteTodo.protocolItemId),
    title: mergeTodoChoiceField(baseTodo.title, localTodo.title, remoteTodo.title, localTodo, remoteTodo),
    who: mergeTodoChoiceField(baseTodo.who, localTodo.who, remoteTodo.who, localTodo, remoteTodo),
    body: mergeTodoTextField(baseTodo.body, localTodo.body, remoteTodo.body),
    status: mergeTodoChoiceField(baseTodo.status, localTodo.status, remoteTodo.status, localTodo, remoteTodo),
    dueDate: mergeTodoChoiceField(baseTodo.dueDate, localTodo.dueDate, remoteTodo.dueDate, localTodo, remoteTodo),
    createdAt: mergeField(baseTodo.createdAt, localTodo.createdAt, remoteTodo.createdAt),
    updatedAt: latestTodoUpdatedAt(localTodo, remoteTodo) ?? mergeField(baseTodo.updatedAt, localTodo.updatedAt, remoteTodo.updatedAt),
    showOnTimeline: mergeTodoChoiceField(
      baseTodo.showOnTimeline,
      localTodo.showOnTimeline,
      remoteTodo.showOnTimeline,
      localTodo,
      remoteTodo,
    ),
    order: mergeTodoChoiceField(baseTodo.order, localTodo.order, remoteTodo.order, localTodo, remoteTodo),
    tags: normalizeTodoTags([...(remoteTodo.tags ?? []), ...(localTodo.tags ?? [])]),
    comments: mergeTimelineComments(baseTodo.comments, localTodo.comments, remoteTodo.comments),
  };
}

function mergeField<T>(baseValue: T, localValue: T, remoteValue: T) {
  return changed(baseValue, localValue) ? localValue : remoteValue;
}

function mergeTodoTextField(baseValue: string | undefined, localValue: string | undefined, remoteValue: string | undefined) {
  return mergeTextField(baseValue, localValue, remoteValue);
}

function mergeTodoChoiceField<T>(
  baseValue: T,
  localValue: T,
  remoteValue: T,
  localTodo: TimelineTodo,
  remoteTodo: TimelineTodo,
) {
  const localChanged = changed(baseValue, localValue);
  const remoteChanged = changed(baseValue, remoteValue);
  if (localChanged && remoteChanged && changed(localValue, remoteValue)) {
    return isLocalTodoNewer(localTodo, remoteTodo) ? localValue : remoteValue;
  }

  return localChanged ? localValue : remoteValue;
}

function latestTodoUpdatedAt(localTodo: TimelineTodo, remoteTodo: TimelineTodo) {
  const localUpdatedAt = todoUpdatedAt(localTodo);
  const remoteUpdatedAt = todoUpdatedAt(remoteTodo);
  if (!localUpdatedAt) return remoteUpdatedAt;
  if (!remoteUpdatedAt) return localUpdatedAt;
  return localUpdatedAt >= remoteUpdatedAt ? localUpdatedAt : remoteUpdatedAt;
}

function isLocalTodoNewer(localTodo: TimelineTodo, remoteTodo: TimelineTodo) {
  const localUpdatedAt = todoUpdatedAt(localTodo);
  const remoteUpdatedAt = todoUpdatedAt(remoteTodo);
  if (!localUpdatedAt || !remoteUpdatedAt) return true;
  return localUpdatedAt >= remoteUpdatedAt;
}

function todoUpdatedAt(todo: TimelineTodo) {
  return todo.updatedAt ?? todo.createdAt ?? '';
}

function buildDuplicateCandidates(
  boards: TimelineTodoBoardData[],
  protocols: MeetingProtocol[],
  events: TimelineEvent[],
): DuplicateCandidate[] {
  const todoCandidates = boards.flatMap((board) =>
    board.todos.map((todo) => ({
      id: `todo:${todo.id}`,
      title: todo.title,
      body: todo.body,
      meta: `Todo · ${board.name} · ${todo.status}`,
    })),
  );
  const protocolCandidates = protocols.flatMap((protocol) =>
    (['updates', 'topics', 'todos'] as const).flatMap((kind) =>
      protocol[kind].map((item) => ({
        id: `protocol:${protocol.id}:${kind}:${item.id}`,
        title: item.title,
        body: item.body,
        meta: `${protocolItemSectionLabel(kind)} · ${protocol.title || protocol.date}`,
      })),
    ),
  );
  const eventCandidates = events.map((event) => ({
    id: `event:${event.id}`,
    title: event.what,
    body: event.note,
    meta: `Event · ${event.date}${event.time ? ` ${event.time}` : ''}`,
  }));

  return [...todoCandidates, ...protocolCandidates, ...eventCandidates];
}

function protocolItemSectionLabel(kind: 'updates' | 'topics' | 'todos') {
  if (kind === 'updates') return 'Update';
  if (kind === 'topics') return 'Topic';
  return 'To-do';
}

function mergeStringList(baseItems: readonly string[], localItems: readonly string[], remoteItems: readonly string[]) {
  const result = new Set(remoteItems);

  for (const item of localItems) {
    if (!baseItems.includes(item) || remoteItems.includes(item)) result.add(item);
  }

  for (const item of baseItems) {
    if (localItems.includes(item)) continue;
    if (remoteItems.includes(item)) result.delete(item);
  }

  return [...result];
}

function mergeTextField(baseText: string | undefined, localText: string | undefined, remoteText: string | undefined) {
  const baseValue = baseText ?? '';
  const localValue = localText ?? '';
  const remoteValue = remoteText ?? '';
  const localChanged = changed(baseValue, localValue);
  const remoteChanged = changed(baseValue, remoteValue);

  if (localChanged && remoteChanged && localValue !== remoteValue) {
    return `${localValue}\n\n--- Version from another device ---\n\n${remoteValue}`;
  }

  return localChanged ? localValue : remoteValue;
}

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function formatSyncTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function syncStatusLabel(status: 'idle' | 'checking' | 'updated' | 'merged' | 'offline', lastCheckedAt: string) {
  if (status === 'checking') return 'sync checking';
  if (status === 'updated') return `synced ${lastCheckedAt}`;
  if (status === 'merged') return `merged ${lastCheckedAt}`;
  if (status === 'offline') return 'sync offline';
  return lastCheckedAt ? `checked ${lastCheckedAt}` : 'sync ready';
}

function formatEventTimeRange(event: TimelineEvent) {
  if (!event.time) return 'All day';
  return event.endTime ? `${event.time} - ${event.endTime}` : event.time;
}

const projectPinSessionTtlMs = 30 * 60 * 1000;

function projectPinSessionKey(projectHash: string) {
  return `timeline:project-pin:${normalizeHash(projectHash)}`;
}

function getProjectPinSession(projectHash: string) {
  try {
    const rawValue = window.localStorage.getItem(projectPinSessionKey(projectHash));
    if (!rawValue) return undefined;

    const session = JSON.parse(rawValue) as { pin?: string; expiresAt?: number };
    if (!session.pin || !session.expiresAt || session.expiresAt <= Date.now()) {
      clearProjectPinSession(projectHash);
      return undefined;
    }

    saveProjectPinSession(projectHash, session.pin);
    return session.pin;
  } catch {
    clearProjectPinSession(projectHash);
    return undefined;
  }
}

function saveProjectPinSession(projectHash: string, pin: string) {
  window.localStorage.setItem(
    projectPinSessionKey(projectHash),
    JSON.stringify({ pin, expiresAt: Date.now() + projectPinSessionTtlMs }),
  );
}

function clearProjectPinSession(projectHash: string) {
  window.localStorage.removeItem(projectPinSessionKey(projectHash));
}

async function hashEditPin(projectHash: string, pin: string) {
  return hashProjectPin(projectHash, pin);
}

async function hashTodoBoardPin(projectHash: string, boardId: string, pin: string) {
  return hashProjectPin(`${projectHash}:todo-board:${boardId}`, pin);
}

async function hashProjectPin(projectHash: string, pin: string) {
  const bytes = new TextEncoder().encode(`${projectHash}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
