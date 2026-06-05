'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { MarkdownBlock } from './MarkdownBlock';
import { MeetingProtocols } from './MeetingProtocols';
import { ProjectHeader } from './ProjectHeader';
import { StickyLinks } from './StickyLinks';
import { TimelineCanvas } from './TimelineCanvas';
import { TodoBoard } from './TodoBoard';
import { fetchProject, importProjectFile, LockedProjectError, persistProject, ProjectConflictError } from '@/lib/api';
import { formatShortGermanDateRange } from '@/lib/dateFormat';
import { createDefaultProject, normalizeHash } from '@/lib/project';
import { mergeMeetingProtocols, normalizeMeetingProtocols } from '@/lib/meetingProtocols';
import { buildProjectLocationHash, ensureProjectHash, parseProjectLocationHash, type ProjectUrlTarget } from '@/lib/storage';
import { moveTodoBetweenBoards, normalizeTodoBoards, syncProjectTodoBoard } from '@/lib/todoBoards';
import { normalizeCompletedTodoStatus, normalizeTodoStatuses, renameTodoStatus } from '@/lib/todos';
import type { TimelineEvent, TimelineMode, TimelineProject, TimelineTodo, TimelineTodoBoard as TimelineTodoBoardData } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';

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

export function TimelineApp() {
  const [project, setProject] = useState<TimelineProject>(() => createDefaultProject('timeline'));
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [selectedTodoId, setSelectedTodoId] = useState<string>();
  const [draftEvent, setDraftEvent] = useState<TimelineEvent | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'error' | 'conflict'>('loading');
  const [collaborationNotice, setCollaborationNotice] = useState('');
  const [syncState, setSyncState] = useState<'idle' | 'checking' | 'updated' | 'merged' | 'offline'>('idle');
  const [lastSyncCheckAt, setLastSyncCheckAt] = useState('');
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [lockedHash, setLockedHash] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [lockError, setLockError] = useState('');
  const [pinDialog, setPinDialog] = useState<(PinDialogConfig & { error?: string }) | null>(null);
  const [pinDialogPin, setPinDialogPin] = useState('');
  const [pinDialogRepeat, setPinDialogRepeat] = useState('');
  const [selectedPopoverMinimized, setSelectedPopoverMinimized] = useState(false);
  const [urlTarget, setUrlTarget] = useState<ProjectUrlTarget | undefined>(() =>
    typeof window === 'undefined' ? undefined : parseProjectLocationHash(window.location.hash).target,
  );
  const [copiedSectionLink, setCopiedSectionLink] = useState<ProjectUrlTarget['section'] | ''>('');
  const [unlockedTodoBoardIds, setUnlockedTodoBoardIds] = useState<string[]>([]);
  const [isTodoSectionMinimized, setIsTodoSectionMinimized] = usePersistentState(
    `timeline:ui:todo-section-minimized:${project.hash}`,
    false,
  );
  const lastSavedJsonRef = useRef('');
  const canSaveRef = useRef(false);
  const latestProjectRef = useRef(project);
  const loadSequenceRef = useRef(0);
  const syncPollInFlightRef = useRef(false);
  const projectPinRef = useRef<string | undefined>(undefined);
  const pinDialogResolverRef = useRef<((result: PinDialogResult | null) => void) | null>(null);
  const consumedUrlTargetRef = useRef('');
  const topRef = useRef<HTMLElement | null>(null);
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
    if (canSaveRef.current && JSON.stringify(project) !== lastSavedJsonRef.current) {
      saveUnsavedProjectBackup(project, parseProjectJson(lastSavedJsonRef.current));
    }
  }, [project]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!canSaveRef.current) return;
      if (JSON.stringify(latestProjectRef.current) === lastSavedJsonRef.current) return;

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
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
          const backup = getUnsavedProjectBackup(loadedProject.hash);
          const projectToDisplay =
            backup &&
            JSON.stringify(backup.project) !== JSON.stringify(loadedProject) &&
            window.confirm('Found unsaved edits from this browser. Restore them now?')
              ? mergeProjectChanges(backup.baseProject, backup.project, loadedProject)
              : loadedProject;
          projectPinRef.current = projectPin;
          if (projectPin) saveProjectPinSession(hash, projectPin);
          lastSavedJsonRef.current = JSON.stringify(loadedProject);
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
  }, []);

  async function rebaseUnsavedChanges() {
    try {
      const localProject = latestProjectRef.current;
      const baseProject = parseProjectJson(lastSavedJsonRef.current) ?? localProject;
      const remoteProject = await fetchProject(localProject.hash, projectPinRef.current);
      const mergedProject = mergeProjectChanges(baseProject, localProject, remoteProject);

      lastSavedJsonRef.current = JSON.stringify(remoteProject);
      canSaveRef.current = true;
      setProject(mergedProject);
      setSaveState('conflict');
      setCollaborationNotice('Merged newer server changes with your local edits. Saving again now.');
    } catch {
      canSaveRef.current = false;
      setSaveState('conflict');
      setCollaborationNotice('Could not merge newer server changes. Your unsaved edits are kept in this browser.');
    }
  }

  useEffect(() => {
    if (!canSaveRef.current || saveState === 'loading' || saveState === 'saving' || lockedHash) return;

    const projectJson = JSON.stringify(project);
    if (projectJson === lastSavedJsonRef.current) return;

    const timeout = window.setTimeout(() => {
      setSaveState('saving');
      persistProject(project, projectPinRef.current)
        .then((savedProject) => {
          if (projectPinRef.current) saveProjectPinSession(project.hash, projectPinRef.current);
          const savedJson = JSON.stringify(savedProject);
          lastSavedJsonRef.current = savedJson;
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
          if (error instanceof ProjectConflictError) {
            void rebaseUnsavedChanges();
          }
        });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [project, saveState, lockedHash]);

  useEffect(() => {
    if (!canSaveRef.current || lockedHash) return;

    let cancelled = false;

    async function checkRemoteProject() {
      if (document.hidden || !canSaveRef.current || lockedHash) return;
      if (syncPollInFlightRef.current) return;

      syncPollInFlightRef.current = true;
      setSyncState('checking');
      try {
        const currentProject = latestProjectRef.current;
        const remoteProject = await fetchProject(currentProject.hash, projectPinRef.current);
        if (cancelled) return;

        const remoteJson = JSON.stringify(remoteProject);
        setLastSyncCheckAt(formatSyncTime(new Date()));
        if (remoteJson === lastSavedJsonRef.current) {
          setSyncState('idle');
          return;
        }

        const localJson = JSON.stringify(latestProjectRef.current);
        if (localJson === lastSavedJsonRef.current) {
          lastSavedJsonRef.current = remoteJson;
          setProject(remoteProject);
          clearUnsavedProjectBackup(remoteProject.hash);
          setCollaborationNotice('Updated from another device.');
          setSaveState('saved');
          setSyncState('updated');
          return;
        }

        const baseProject = parseProjectJson(lastSavedJsonRef.current) ?? latestProjectRef.current;
        const mergedProject = mergeProjectChanges(baseProject, latestProjectRef.current, remoteProject);
        lastSavedJsonRef.current = remoteJson;
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
  }, [lockedHash]);

  const selectedEvent = project.events.find((event) => event.id === selectedEventId);
  const canEdit = project.settings.mode === 'edit';
  const todoBoards = normalizeTodoBoards(project);
  const activeBoard = todoBoards.find((board) => board.id === project.settings.activeTodoBoardId) ?? todoBoards[0];
  const todoStatuses = normalizeTodoStatuses(activeBoard.statuses, activeBoard.todos);
  const completedTodoStatus = normalizeCompletedTodoStatus(todoStatuses, activeBoard.completedTodoStatus);
  const isActiveBoardLocked = Boolean(activeBoard.pinHash && !unlockedTodoBoardIds.includes(activeBoard.id));
  const meetingProtocols = normalizeMeetingProtocols(project.meetingProtocols);
  const timelineProject = {
    ...project,
    todos: isActiveBoardLocked ? [] : activeBoard.todos,
    settings: {
      ...project.settings,
      todoStatuses,
      completedTodoStatus,
    },
  };

  function updateProject(nextProject: TimelineProject) {
    setCollaborationNotice('');
    if (nextProject.settings.mode !== 'edit') {
      setDraftEvent(null);
      setEditingInfo(false);
    }
    setProject(nextProject);
  }

  function selectEvent(eventId: string | undefined) {
    setSelectedEventId(eventId);
    setSelectedPopoverMinimized(false);
    if (!eventId) {
      setPopoverPosition(null);
      popoverDragRef.current = null;
    }
  }

  function selectTodo(todo: TimelineTodo) {
    setSelectedTodoId(todo.id);
    scrollToElement(todoRef.current);
  }

  function openTodoFromProtocol(todoId: string) {
    const board = todoBoards.find((item) => item.todos.some((todo) => todo.id === todoId));
    if (!board) {
      window.alert('The linked todo could not be found. It may have been deleted.');
      return;
    }
    if (board.pinHash && !unlockedTodoBoardIds.includes(board.id)) {
      window.alert('Unlock that todo board before opening the linked todo.');
      return;
    }

    setIsTodoSectionMinimized(false);
    updateProject(syncProjectTodoBoard(project, todoBoards, board.id));
    setSelectedTodoId(todoId);
    window.setTimeout(() => {
      document.getElementById(`todo-card-${todoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 0);
  }

  function openEventFromProtocol(eventId: string) {
    const event = project.events.find((item) => item.id === eventId);
    if (!event) {
      window.alert('The linked event could not be found. It may have been deleted.');
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

  function convertEventToTodo(event: TimelineEvent) {
    const targetStatus = todoStatuses[0] ?? 'open';
    const todo: TimelineTodo = {
      id: crypto.randomUUID(),
      title: event.what || 'New todo',
      who: event.who,
      body: event.note,
      status: targetStatus,
      dueDate: event.date,
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

  function convertTodoToEvent(todo: TimelineTodo) {
    const event: TimelineEvent = {
      id: crypto.randomUUID(),
      date: todo.dueDate || project.startDate,
      time: '09:00',
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
      window.alert('Unlock the active todo board before adding a protocol todo to it.');
      return;
    }

    const targetStatus = todoStatuses[0] ?? 'open';
    const todoForSave = {
      id: crypto.randomUUID(),
      protocolId: source.protocolId,
      title: source.title || 'Protocol todo',
      who: source.who ?? '',
      body: source.body,
      status: targetStatus,
      dueDate: source.date,
      showOnTimeline: true,
      order: nextTodoOrder(activeBoard.todos, targetStatus),
    };
    const nextBoard = {
      ...activeBoard,
      todos: [...activeBoard.todos, todoForSave],
      statuses: normalizeTodoStatuses(activeBoard.statuses, [...activeBoard.todos, todoForSave]),
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

  function createEventFromProtocol(source: {
    title: string;
    body: string;
    date: string;
    protocolId?: string;
    protocolItemId?: string;
    protocolItemKind?: 'updates' | 'topics' | 'todos';
  }) {
    const event: TimelineEvent = {
      id: crypto.randomUUID(),
      date: source.date || project.startDate,
      time: '09:00',
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

  function addTodoBoard() {
    const name = window.prompt('Board name')?.trim();
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

  function renameTodoBoard(board: TimelineTodoBoardData) {
    const name = window.prompt('Board name', board.name)?.trim();
    if (!name) return;
    updateActiveTodoBoard({ ...board, name });
  }

  function deleteTodoBoard(board: TimelineTodoBoardData) {
    if (todoBoards.length <= 1) return;
    if (!window.confirm(`Delete board "${board.name}" and all its todos?`)) return;

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

  function saveEvent() {
    if (!draftEvent || !project) return;
    const existing = project.events.some((event) => event.id === draftEvent.id);
    const events = existing
      ? project.events.map((event) => (event.id === draftEvent.id ? draftEvent : event))
      : [...project.events, draftEvent];
    updateProject({ ...project, events });
    selectEvent(draftEvent.id);
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
      window.location.hash = nextHash;
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
        window.prompt('Copy this link', link);
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
      <main className="app-shell locked-shell">
        <section className="lock-panel">
          <div>
            <h1>Project locked</h1>
            <p>
              <code>#{lockedHash}</code> needs a project PIN before it can be viewed.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void fetchProject(lockedHash, unlockPin)
                .then((loadedProject) => {
                  const backup = getUnsavedProjectBackup(loadedProject.hash);
                  const projectToDisplay =
                    backup &&
                    JSON.stringify(backup.project) !== JSON.stringify(loadedProject) &&
                    window.confirm('Found unsaved edits from this browser. Restore them now?')
                      ? mergeProjectChanges(backup.baseProject, backup.project, loadedProject)
                      : loadedProject;
                  projectPinRef.current = unlockPin;
                  saveProjectPinSession(lockedHash, unlockPin);
                  lastSavedJsonRef.current = JSON.stringify(loadedProject);
                  if (projectToDisplay === loadedProject) clearUnsavedProjectBackup(loadedProject.hash);
                  canSaveRef.current = true;
                  setProject(projectToDisplay);
                  setLockedHash(null);
                  setUnlockPin('');
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
            <label>
              <span>Project PIN</span>
              <input
                type="password"
                value={unlockPin}
                onChange={(event) => setUnlockPin(event.target.value)}
                autoFocus
              />
            </label>
            {lockError ? <div className="form-error">{lockError}</div> : null}
            <button type="submit">Unlock project</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" ref={topRef}>
      <nav className="quick-jump" aria-label="Quick navigation">
        <button type="button" className="secondary" onClick={() => navigateToTarget({ section: 'top' })}>
          Top
        </button>
        <button type="button" onClick={() => navigateToTarget({ section: 'todos' })}>
          Todos
        </button>
        <button type="button" className="secondary" onClick={() => navigateToTarget({ section: 'timeline' })}>
          Timeline
        </button>
        <button type="button" className="secondary" onClick={() => navigateToTarget({ section: 'events' })}>
          Events
        </button>
        <button type="button" className="secondary" onClick={() => navigateToTarget({ section: 'protocol' })}>
          Protocols
        </button>
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
        onImport={(file) => {
          setSaveState('saving');
          importProjectFile(project.hash, file, projectPinRef.current)
            .then((result) => {
              if (projectPinRef.current) saveProjectPinSession(project.hash, projectPinRef.current);
              lastSavedJsonRef.current = JSON.stringify(result.project);
              clearUnsavedProjectBackup(result.project.hash);
              canSaveRef.current = true;
              setProject(result.project);
              setSaveState('saved');
            })
            .catch((error) => {
              saveUnsavedProjectBackup(latestProjectRef.current, parseProjectJson(lastSavedJsonRef.current));
              setSaveState('error');
              if (error instanceof ProjectConflictError) {
                canSaveRef.current = false;
                window.alert('This project changed somewhere else. Import was not saved over newer data.');
              }
            });
        }}
      />

      {collaborationNotice ? (
        <div className={`collaboration-banner ${saveState === 'conflict' ? 'conflict' : ''}`}>
          <span>{collaborationNotice}</span>
          <button type="button" className="secondary" onClick={() => setCollaborationNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="info-section">
        <div className="section-heading">
          <h2>Important info</h2>
          <span className={`save-state ${saveState}`}>{saveState}</span>
          <span className={`sync-state ${syncState}`}>{syncStatusLabel(syncState, lastSyncCheckAt)}</span>
          {canEdit ? (
            <button type="button" onClick={() => setEditingInfo((value) => !value)}>
              {editingInfo ? 'Preview' : 'Edit'}
            </button>
          ) : null}
        </div>
        {editingInfo ? (
          <textarea
            className="info-editor"
            value={project.infoMarkdown}
            onChange={(event) => updateProject({ ...project, infoMarkdown: event.target.value })}
            rows={7}
          />
        ) : (
          <MarkdownBlock markdown={project.infoMarkdown} />
        )}
      </section>

      <div className="ordered-section ordered-section-protocols" ref={protocolsRef}>
        <MeetingProtocols
          projectHash={project.hash}
          canEdit={canEdit}
          protocols={meetingProtocols}
          instructionTemplate={project.protocolInstructionTemplate}
          requestedProtocolId={urlTarget?.section === 'protocol' && 'protocolId' in urlTarget ? urlTarget.protocolId : undefined}
          onProtocolSelect={(protocolId) => navigateToTarget({ section: 'protocol', protocolId })}
          onChange={(protocols) => updateProject({ ...project, meetingProtocols: protocols })}
          onInstructionTemplateChange={(protocolInstructionTemplate) =>
            updateProject({ ...project, protocolInstructionTemplate })
          }
          onCreateTodo={createTodoFromProtocol}
          onOpenTodo={openTodoFromProtocol}
          onOpenEvent={openEventFromProtocol}
          onCopyLink={() => copySectionLink({ section: 'protocol' })}
          linkCopied={copiedSectionLink === 'protocol'}
          onCreateEvent={createEventFromProtocol}
        />
      </div>

      <div className="ordered-section ordered-section-timeline" ref={timelineRef}>
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
        />
      </div>

      {draftEvent ? (
        <EventEditor
          draft={draftEvent}
          events={project.events}
          typeColors={project.settings.typeColors}
          onChange={setDraftEvent}
          onCancel={() => setDraftEvent(null)}
          onSave={saveEvent}
          modal
        />
      ) : null}

      {selectedEvent && !draftEvent ? (
        <aside
          className={`selected-popover ${selectedPopoverMinimized ? 'minimized' : ''}`}
          ref={selectedPopoverRef}
          style={popoverPosition ? { left: `${popoverPosition.x}px`, top: `${popoverPosition.y}px` } : undefined}
        >
          <div
            className="popover-heading"
            onPointerDown={startPopoverDrag}
            onPointerMove={dragPopover}
            onPointerUp={stopPopoverDrag}
            onPointerCancel={stopPopoverDrag}
          >
            <div className="popover-title-line">
              <span className="drag-handle">drag</span>
              <div className="panel-title">{selectedEvent.what}</div>
            </div>
            <div className="popover-tools">
              <button
                type="button"
                className="icon-button secondary popover-close"
                aria-label={selectedPopoverMinimized ? 'Expand selected event' : 'Minimize selected event'}
                onClick={() => setSelectedPopoverMinimized((minimized) => !minimized)}
              >
                {selectedPopoverMinimized ? '+' : '-'}
              </button>
              <button
                type="button"
                className="icon-button secondary popover-close"
                aria-label="Close selected event"
                onClick={() => selectEvent(undefined)}
              >
                x
              </button>
            </div>
          </div>
          {selectedPopoverMinimized ? null : (
            <>
              <dl>
                <dt>Date</dt>
                <dd>{formatShortGermanDateRange(selectedEvent.date, selectedEvent.endDate)}</dd>
                <dt>Time</dt>
                <dd>{selectedEvent.time}</dd>
                <dt>Who</dt>
                <dd>{selectedEvent.who || '-'}</dd>
                <dt>Type</dt>
                <dd>{selectedEvent.type}</dd>
                <dt>Note</dt>
                <dd>
                  {selectedEvent.note.trim() ? <MarkdownBlock markdown={selectedEvent.note} /> : '-'}
                </dd>
              </dl>
              {canEdit ? (
                <button type="button" className="popover-edit" onClick={() => setDraftEvent({ ...selectedEvent })}>
                  Edit event
                </button>
              ) : null}
            </>
          )}
        </aside>
      ) : null}

      <section className="events-area ordered-section ordered-section-events" ref={eventsRef}>
        <EventList
          events={project.events}
          selectedEventId={selectedEventId}
          canEdit={canEdit}
          onAdd={() => createEvent({ date: selectedEvent?.date ?? project.startDate, time: selectedEvent?.time ?? '09:00' })}
          onSelect={(event) => {
            selectEvent(event.id);
          }}
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
          onDelete={(eventId) => {
            updateProject({ ...project, events: project.events.filter((event) => event.id !== eventId) });
            if (selectedEventId === eventId) selectEvent(undefined);
          }}
        />
      </section>

      <div className="ordered-section ordered-section-todos" ref={todoRef}>
        <section className="todo-board-frame">
          <div className="section-heading todo-section-heading">
            <div className="todo-section-title">
              <h2>Todos</h2>
              <button
                type="button"
                className="icon-button secondary copy-link-icon"
                onClick={() => copySectionLink({ section: 'todos' })}
                aria-label="Copy todos link"
                title={copiedSectionLink === 'todos' ? 'Copied' : 'Copy todos link'}
              >
                {copiedSectionLink === 'todos' ? 'ok' : '§'}
              </button>
              <span>{activeBoard.todos.length} cards</span>
            </div>
            <div className="heading-actions">
              <button
                type="button"
                className={`event-table-toggle ${isTodoSectionMinimized ? 'collapsed' : 'expanded'}`}
                onClick={() => setIsTodoSectionMinimized((minimized) => !minimized)}
                aria-expanded={!isTodoSectionMinimized}
              >
                {isTodoSectionMinimized ? 'Show todos' : 'Hide todos'}
              </button>
            </div>
          </div>
          {isTodoSectionMinimized ? null : (
            <>
          <div className="todo-board-tabs">
            {todoBoards.map((board) => (
              <button
                type="button"
                className={board.id === activeBoard.id ? 'active' : ''}
                key={board.id}
                onClick={() => switchTodoBoard(board.id)}
              >
                {board.pinHash ? 'PIN ' : ''}{board.name}
              </button>
            ))}
            {canEdit ? (
              <button type="button" className="secondary" onClick={addTodoBoard}>
                Add board
              </button>
            ) : null}
          </div>
          <div className="todo-board-mobile-switcher">
            <label>
              <span>Board</span>
              <select value={activeBoard.id} onChange={(event) => switchTodoBoard(event.target.value)}>
                {todoBoards.map((board) => (
                  <option value={board.id} key={board.id}>
                    {board.pinHash ? 'PIN ' : ''}{board.name}
                  </option>
                ))}
              </select>
            </label>
            {canEdit ? (
              <button type="button" className="secondary" onClick={addTodoBoard} aria-label="Add todo board">
                +
              </button>
            ) : null}
          </div>
          {canEdit ? (
            <div className="todo-board-tools">
              <button type="button" className="secondary" onClick={() => renameTodoBoard(activeBoard)}>
                Rename
              </button>
              <button type="button" className="secondary" onClick={() => void changeTodoBoardPin(activeBoard)}>
                {activeBoard.pinHash ? 'Change board PIN' : 'Add board PIN'}
              </button>
              {activeBoard.pinHash ? (
                <button type="button" className="secondary" onClick={() => void removeTodoBoardPin(activeBoard)}>
                  Remove board PIN
                </button>
              ) : null}
              {todoBoards.length > 1 ? (
                <button type="button" className="secondary" onClick={() => deleteTodoBoard(activeBoard)}>
                  Delete board
                </button>
              ) : null}
            </div>
          ) : null}
          {isActiveBoardLocked ? (
            <section className="todo-board-locked">
              <h2>{activeBoard.name}</h2>
              <p>This todo board is PIN protected.</p>
              <button type="button" onClick={() => void unlockTodoBoard(activeBoard)}>
                Unlock board
              </button>
            </section>
          ) : (
            <TodoBoard
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
            />
          )}
            </>
          )}
        </section>
      </div>

      <footer className="footer-line">
        Project data is saved in Postgres under <code>#{project.hash}</code>.
        <button
          type="button"
          className="secondary"
          onClick={() => {
            window.location.hash = normalizeHash(window.prompt('New timeline hash') || '');
          }}
        >
          New project
        </button>
      </footer>

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
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={config.title}>
      <form
        className="editor-panel modal-panel pin-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <div className="panel-title">{config.title}</div>
          <p>{config.description}</p>
        </div>
        <label>
          <span>{config.inputLabel ?? 'PIN'}</span>
          <input type="password" value={pin} onChange={(event) => onPinChange(event.target.value)} autoFocus />
        </label>
        {config.requireRepeat ? (
          <label>
            <span>{config.repeatLabel ?? 'Repeat PIN'}</span>
            <input type="password" value={repeatedPin} onChange={(event) => onRepeatedPinChange(event.target.value)} />
          </label>
        ) : null}
        {config.error ? <div className="form-error">{config.error}</div> : null}
        <div className="action-row">
          <button type="submit">{config.confirmLabel}</button>
          <button type="button" className="secondary" onClick={onCancel}>
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
    events: mergeById(baseProject.events, localProject.events, remoteProject.events, copyRemoteEventConflict),
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
  const activeBoardId =
    changed(baseProject.settings.activeTodoBoardId, localProject.settings.activeTodoBoardId)
      ? localProject.settings.activeTodoBoardId
      : remoteProject.settings.activeTodoBoardId;

  return syncProjectTodoBoard(mergedProject, boards, activeBoardId ?? boards[0]?.id ?? 'board-main');
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
    editPinHash: changed(baseSettings.editPinHash, localSettings.editPinHash)
      ? localSettings.editPinHash
      : remoteSettings.editPinHash,
    viewPinHash: changed(baseSettings.viewPinHash, localSettings.viewPinHash)
      ? localSettings.viewPinHash
      : remoteSettings.viewPinHash,
    activeTodoBoardId: changed(baseSettings.activeTodoBoardId, localSettings.activeTodoBoardId)
      ? localSettings.activeTodoBoardId
      : remoteSettings.activeTodoBoardId,
    stickyLinks: mergeById(
      baseSettings.stickyLinks ?? [],
      localSettings.stickyLinks ?? [],
      remoteSettings.stickyLinks ?? [],
      (link, id) => ({ ...link, id, label: `${link.label} (other device)` }),
    ),
  };
}

function mergeTodoBoards(
  baseBoards: TimelineTodoBoardData[],
  localBoards: TimelineTodoBoardData[],
  remoteBoards: TimelineTodoBoardData[],
) {
  const mergedBoards = mergeById(baseBoards, localBoards, remoteBoards);

  return mergedBoards.map((board) => {
    const baseBoard = baseBoards.find((item) => item.id === board.id);
    const localBoard = localBoards.find((item) => item.id === board.id);
    const remoteBoard = remoteBoards.find((item) => item.id === board.id);
    if (!baseBoard || !localBoard || !remoteBoard) return board;

    return {
      ...board,
      todos: mergeById(baseBoard.todos, localBoard.todos, remoteBoard.todos, copyRemoteTodoConflict),
      statuses: mergeStringList(baseBoard.statuses ?? [], localBoard.statuses ?? [], remoteBoard.statuses ?? []),
      completedTodoStatus: changed(baseBoard.completedTodoStatus, localBoard.completedTodoStatus)
        ? localBoard.completedTodoStatus
        : remoteBoard.completedTodoStatus,
    };
  });
}

function mergeById<T extends { id: string }>(
  baseItems: readonly T[],
  localItems: readonly T[],
  remoteItems: readonly T[],
  copyRemoteConflict?: (item: T, id: string) => T,
) {
  const result = new Map(remoteItems.map((item) => [item.id, item]));
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));

  for (const [id, localItem] of localById) {
    const baseItem = baseById.get(id);
    const remoteItem = result.get(id);
    if (
      baseItem &&
      remoteItem &&
      copyRemoteConflict &&
      changed(baseItem, localItem) &&
      changed(baseItem, remoteItem) &&
      changed(localItem, remoteItem)
    ) {
      result.set(id, localItem);
      const conflictId = uniqueConflictId(id, result);
      result.set(conflictId, copyRemoteConflict(remoteItem, conflictId));
    } else if (!baseItem || changed(baseItem, localItem)) {
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

function copyRemoteEventConflict(event: TimelineEvent, id: string): TimelineEvent {
  return {
    ...event,
    id,
    what: `${event.what} (other device)`,
  };
}

function copyRemoteTodoConflict(todo: TimelineTodo, id: string): TimelineTodo {
  return {
    ...todo,
    id,
    title: `${todo.title} (other device)`,
  };
}

function uniqueConflictId(baseId: string, items: ReadonlyMap<string, unknown>) {
  let index = 1;
  let id = `${baseId}-other-device`;
  while (items.has(id)) {
    index += 1;
    id = `${baseId}-other-device-${index}`;
  }
  return id;
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
