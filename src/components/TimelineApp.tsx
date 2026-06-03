'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { MarkdownBlock } from './MarkdownBlock';
import { ProjectHeader } from './ProjectHeader';
import { TimelineCanvas } from './TimelineCanvas';
import { TodoBoard } from './TodoBoard';
import { fetchProject, importProjectFile, persistProject } from '@/lib/api';
import { createDefaultProject, normalizeHash } from '@/lib/project';
import { ensureProjectHash } from '@/lib/storage';
import type { TimelineEvent, TimelineMode, TimelineProject } from '@/lib/types';

export function TimelineApp() {
  const [project, setProject] = useState<TimelineProject>(() => createDefaultProject('timeline'));
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [draftEvent, setDraftEvent] = useState<TimelineEvent | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const lastSavedJsonRef = useRef('');
  const canSaveRef = useRef(false);
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

    async function load(hash: string) {
      canSaveRef.current = false;
      setSaveState('loading');
      try {
        const loadedProject = await fetchProject(hash);
        if (!cancelled) {
          lastSavedJsonRef.current = JSON.stringify(loadedProject);
          canSaveRef.current = true;
          setProject(loadedProject);
          setSaveState('saved');
        }
      } catch {
        if (!cancelled) {
          canSaveRef.current = false;
          setSaveState('error');
        }
      }
    }

    void load(activeHash);

    function handleHashChange() {
      const hash = normalizeHash(window.location.hash);
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
    if (!canSaveRef.current || saveState === 'loading') return;

    const projectJson = JSON.stringify(project);
    if (projectJson === lastSavedJsonRef.current) return;

    const timeout = window.setTimeout(() => {
      setSaveState('saving');
      persistProject(project)
        .then(() => {
          lastSavedJsonRef.current = projectJson;
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [project, saveState]);

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
      const pin = window.prompt('Create an edit PIN for this timeline');
      if (!pin?.trim()) return;

      if (pin.trim().length < 4) {
        window.alert('Use at least 4 characters for the edit PIN.');
        return;
      }

      const repeatedPin = window.prompt('Repeat the edit PIN');
      if (pin !== repeatedPin) {
        window.alert('PINs do not match.');
        return;
      }

      updateProject({
        ...project,
        settings: {
          ...project.settings,
          mode: 'edit',
          editPinHash: await hashEditPin(project.hash, pin),
        },
      });
      return;
    }

    const pin = window.prompt('Enter edit PIN');
    if (!pin) return;

    if ((await hashEditPin(project.hash, pin)) !== existingPinHash) {
      window.alert('Wrong edit PIN.');
      return;
    }

    updateProject({ ...project, settings: { ...project.settings, mode: 'edit' } });
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
        onImport={(file) => {
          setSaveState('saving');
          importProjectFile(project.hash, file)
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
        <TodoBoard todos={project.todos} onChange={(todos) => updateProject({ ...project, todos })} />
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
    </main>
  );
}

async function hashEditPin(projectHash: string, pin: string) {
  const bytes = new TextEncoder().encode(`${projectHash}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
