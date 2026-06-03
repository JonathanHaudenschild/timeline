'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { MarkdownBlock } from './MarkdownBlock';
import { ProjectHeader } from './ProjectHeader';
import { StickyLinks } from './StickyLinks';
import { TimelineCanvas } from './TimelineCanvas';
import { TodoBoard } from './TodoBoard';
import { fetchProject, importProjectFile, LockedProjectError, persistProject } from '@/lib/api';
import { formatShortGermanDateRange } from '@/lib/dateFormat';
import { createDefaultProject, normalizeHash } from '@/lib/project';
import { ensureProjectHash } from '@/lib/storage';
import { moveTodoBetweenBoards, normalizeTodoBoards, syncProjectTodoBoard } from '@/lib/todoBoards';
import { normalizeCompletedTodoStatus, normalizeTodoStatuses, renameTodoStatus } from '@/lib/todos';
import type { TimelineEvent, TimelineMode, TimelineProject, TimelineTodo, TimelineTodoBoard as TimelineTodoBoardData } from '@/lib/types';

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
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [lockedHash, setLockedHash] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [lockError, setLockError] = useState('');
  const [pinDialog, setPinDialog] = useState<(PinDialogConfig & { error?: string }) | null>(null);
  const [pinDialogPin, setPinDialogPin] = useState('');
  const [pinDialogRepeat, setPinDialogRepeat] = useState('');
  const [selectedPopoverMinimized, setSelectedPopoverMinimized] = useState(false);
  const [unlockedTodoBoardIds, setUnlockedTodoBoardIds] = useState<string[]>([]);
  const lastSavedJsonRef = useRef('');
  const canSaveRef = useRef(false);
  const latestProjectRef = useRef(project);
  const loadSequenceRef = useRef(0);
  const projectPinRef = useRef<string | undefined>(undefined);
  const pinDialogResolverRef = useRef<((result: PinDialogResult | null) => void) | null>(null);
  const topRef = useRef<HTMLElement | null>(null);
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
          projectPinRef.current = projectPin;
          lastSavedJsonRef.current = JSON.stringify(loadedProject);
          canSaveRef.current = true;
          setLockedHash(null);
          setUnlockPin('');
          setLockError('');
          setProject(loadedProject);
          setSaveState('saved');
        }
      } catch (error) {
        if (!cancelled && loadId === loadSequenceRef.current) {
          if (error instanceof LockedProjectError) {
            projectPinRef.current = undefined;
            setLockedHash(hash);
          }
          canSaveRef.current = false;
          setSaveState('error');
        }
      }
    }

    void load(activeHash);

    function handleHashChange() {
      const hash = window.location.hash ? normalizeHash(window.location.hash) : 'timeline';
      if (window.location.hash !== `#${hash}`) {
        window.location.hash = hash;
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
      void load(hash);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [project.hash]);

  useEffect(() => {
    if (!canSaveRef.current || saveState === 'loading' || saveState === 'saving' || lockedHash) return;

    const projectJson = JSON.stringify(project);
    if (projectJson === lastSavedJsonRef.current) return;

    const timeout = window.setTimeout(() => {
      setSaveState('saving');
      persistProject(project, projectPinRef.current)
        .then((savedProject) => {
          const savedJson = JSON.stringify(savedProject);
          lastSavedJsonRef.current = savedJson;
          if (JSON.stringify(latestProjectRef.current) === projectJson) {
            setProject(savedProject);
          }
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [project, saveState, lockedHash]);

  const selectedEvent = project.events.find((event) => event.id === selectedEventId);
  const canEdit = project.settings.mode === 'edit';
  const todoBoards = normalizeTodoBoards(project);
  const activeBoard = todoBoards.find((board) => board.id === project.settings.activeTodoBoardId) ?? todoBoards[0];
  const todoStatuses = normalizeTodoStatuses(activeBoard.statuses, activeBoard.todos);
  const completedTodoStatus = normalizeCompletedTodoStatus(todoStatuses, activeBoard.completedTodoStatus);
  const isActiveBoardLocked = Boolean(activeBoard.pinHash && !unlockedTodoBoardIds.includes(activeBoard.id));
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
                  projectPinRef.current = unlockPin;
                  lastSavedJsonRef.current = JSON.stringify(loadedProject);
                  canSaveRef.current = true;
                  setProject(loadedProject);
                  setLockedHash(null);
                  setUnlockPin('');
                  setLockError('');
                  setSaveState('saved');
                })
                .catch(() => {
                  projectPinRef.current = undefined;
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
        <button type="button" className="secondary" onClick={() => scrollToElement(topRef.current)}>
          Top
        </button>
        <button type="button" className="secondary" onClick={() => scrollToElement(timelineRef.current)}>
          Timeline
        </button>
        <button type="button" className="secondary" onClick={() => scrollToElement(eventsRef.current)}>
          Events
        </button>
        <button type="button" onClick={() => scrollToElement(todoRef.current)}>
          Todos
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
              lastSavedJsonRef.current = JSON.stringify(result.project);
              canSaveRef.current = true;
              setProject(result.project);
              setSaveState('saved');
            })
            .catch(() => setSaveState('error'));
        }}
      />

      <section className="info-section">
        <div className="section-heading">
          <h2>Important info</h2>
          <span className={`save-state ${saveState}`}>{saveState}</span>
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

      <div ref={timelineRef}>
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

      <section className="events-area" ref={eventsRef}>
        <EventList
          events={project.events}
          selectedEventId={selectedEventId}
          canEdit={canEdit}
          onAdd={() => createEvent({ date: selectedEvent?.date ?? project.startDate, time: selectedEvent?.time ?? '09:00' })}
          onSelect={(event) => {
            selectEvent(event.id);
          }}
          onEdit={(event) => setDraftEvent({ ...event })}
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
          onDelete={(eventId) => {
            updateProject({ ...project, events: project.events.filter((event) => event.id !== eventId) });
            if (selectedEventId === eventId) selectEvent(undefined);
          }}
        />
      </section>

      <div ref={todoRef}>
        <section className="todo-board-frame">
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
          <div className="todo-board-tools">
            <b>{activeBoard.name}</b>
            {canEdit ? (
              <>
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
              </>
            ) : null}
          </div>
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
