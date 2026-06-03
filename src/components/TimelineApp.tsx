'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { MarkdownBlock } from './MarkdownBlock';
import { ProjectHeader } from './ProjectHeader';
import { TimelineCanvas } from './TimelineCanvas';
import { TodoBoard } from './TodoBoard';
import { fetchProject, importProjectFile, LockedProjectError, persistProject } from '@/lib/api';
import { createDefaultProject, normalizeHash } from '@/lib/project';
import { ensureProjectHash } from '@/lib/storage';
import { normalizeTodoStatuses } from '@/lib/todos';
import type { TimelineEvent, TimelineMode, TimelineProject } from '@/lib/types';

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
  const lastSavedJsonRef = useRef('');
  const canSaveRef = useRef(false);
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
    let cancelled = false;
    const activeHash = ensureProjectHash(window.location);

    async function load(hash: string, projectPin?: string) {
      canSaveRef.current = false;
      setSaveState('loading');
      try {
        const loadedProject = await fetchProject(hash, projectPin);
        if (!cancelled) {
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
        if (!cancelled) {
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
      const hash = normalizeHash(window.location.hash);
      projectPinRef.current = undefined;
      setLockedHash(null);
      setUnlockPin('');
      setLockError('');
      setProject(createDefaultProject(hash));
      setSelectedEventId(undefined);
      setPopoverPosition(null);
      popoverDragRef.current = null;
      setDraftEvent(null);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [project.hash]);

  useEffect(() => {
    if (!canSaveRef.current || saveState === 'loading' || lockedHash) return;

    const projectJson = JSON.stringify(project);
    if (projectJson === lastSavedJsonRef.current) return;

    const timeout = window.setTimeout(() => {
      setSaveState('saving');
      persistProject(project, projectPinRef.current)
        .then(() => {
          lastSavedJsonRef.current = projectJson;
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [project, saveState, lockedHash]);

  const selectedEvent = project.events.find((event) => event.id === selectedEventId);
  const canEdit = project.settings.mode === 'edit';

  function updateProject(nextProject: TimelineProject) {
    if (nextProject.settings.mode !== 'edit') {
      setDraftEvent(null);
      setEditingInfo(false);
    }
    setProject(nextProject);
  }

  function selectEvent(eventId: string | undefined) {
    setSelectedEventId(eventId);
    setPopoverPosition(null);
    popoverDragRef.current = null;
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
    const result = await requestPinDialog({
      title: project.settings.viewPinHash ? 'Change project PIN' : 'Add project PIN',
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

  async function removeProjectPin() {
    if (!project.settings.viewPinHash) return;

    let wrongAttempt = false;
    while (true) {
      const result = await requestPinDialog({
        title: 'Remove project PIN',
        description: wrongAttempt ? 'That project PIN was wrong. Try again.' : 'Enter the current project PIN to remove the view lock.',
        confirmLabel: 'Remove PIN',
        inputLabel: 'Project PIN',
      });
      if (!result) return;

      const pinHash = await hashProjectPin(project.hash, result.pin);
      if (pinHash !== project.settings.viewPinHash) {
        wrongAttempt = true;
        continue;
      }

      updateProject({
        ...project,
        settings: {
          ...project.settings,
          viewPinHash: undefined,
        },
      });
      return;
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
          project={project}
          selectedEventId={selectedEventId}
          canEdit={canEdit}
          onCreateEvent={createEvent}
          onSelectEvent={(event) => {
            selectEvent(event.id);
          }}
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
          className="selected-popover"
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
                aria-label="Close selected event"
                onClick={() => selectEvent(undefined)}
              >
                x
              </button>
            </div>
          </div>
          <dl>
            <dt>Date</dt>
            <dd>{selectedEvent.endDate ? `${selectedEvent.date} - ${selectedEvent.endDate}` : selectedEvent.date}</dd>
            <dt>Time</dt>
            <dd>{selectedEvent.time}</dd>
            <dt>Who</dt>
            <dd>{selectedEvent.who || '-'}</dd>
            <dt>Type</dt>
            <dd>{selectedEvent.type}</dd>
            <dt>Note</dt>
            <dd>{selectedEvent.note || '-'}</dd>
          </dl>
          {canEdit ? (
            <button type="button" className="popover-edit" onClick={() => setDraftEvent({ ...selectedEvent })}>
              Edit event
            </button>
          ) : null}
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
        <TodoBoard
          todos={project.todos}
          statuses={normalizeTodoStatuses(project.settings.todoStatuses, project.todos)}
          onChange={(todos) =>
            updateProject({
              ...project,
              todos,
              settings: {
                ...project.settings,
                todoStatuses: normalizeTodoStatuses(project.settings.todoStatuses, todos),
              },
            })
          }
          onStatusesChange={(todoStatuses) =>
            updateProject({
              ...project,
              settings: {
                ...project.settings,
                todoStatuses: normalizeTodoStatuses(todoStatuses, project.todos),
              },
            })
          }
        />
      </div>

      <footer className="footer-line">
        Project data is saved in Postgres under <code>#{project.hash}</code>.
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const next = createDefaultProject(normalizeHash(window.prompt('New timeline hash') || ''));
            window.location.hash = next.hash;
            lastSavedJsonRef.current = '';
            canSaveRef.current = true;
            setProject(next);
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

async function hashProjectPin(projectHash: string, pin: string) {
  const bytes = new TextEncoder().encode(`${projectHash}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
