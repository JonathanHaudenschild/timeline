'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { BookOpen, CalendarPlus, Download, Eye, EyeOff, ListTodo, MessageCircle, Pause, Pencil, Play, Plus, Save, Square, Trash2, X } from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { FilterBadge } from './FilterBadge';
import { SearchInput, TextField } from './FormControls';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownBlock, renderMarkdown } from './MarkdownBlock';
import { SectionShell } from './SectionShell';
import { createTimelineComment } from '@/lib/comments';
import { cn } from '@/lib/cn';
import { uiCard } from '@/lib/ui';
import {
  createMeetingProtocol,
  createMeetingProtocolInstruction,
  createProtocolItem,
  formatProtocolDuration,
  moveProtocolItem,
  protocolConversionBody,
  protocolItemConversionBody,
  protocolItemLabel,
  protocolTitle,
  type ProtocolItemKind,
} from '@/lib/meetingProtocols';
import type { MeetingProtocol, MeetingProtocolItem } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';

type MeetingProtocolsProps = {
  projectHash: string;
  canEdit: boolean;
  protocols: MeetingProtocol[];
  instructionTemplate: string;
  requestedProtocolId?: string;
  onProtocolSelect: (protocolId: string) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  moveControls?: {
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
  };
  onChange: (protocols: MeetingProtocol[]) => void;
  onInstructionTemplateChange: (template: string) => void;
  onCreateTodo: (source: {
    title: string;
    body: string;
    date: string;
    who?: string;
    protocolId?: string;
    protocolItemId?: string;
    protocolItemKind?: ProtocolItemKind;
  }) => void;
  onOpenTodo: (todoId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onCreateEvent: (source: {
    title: string;
    body: string;
    date: string;
    protocolId?: string;
    protocolItemId?: string;
    protocolItemKind?: ProtocolItemKind;
  }) => void;
};

type ProtocolOverviewItem = {
  id: string;
  protocolId: string;
  kind: ProtocolItemKind;
  title: string;
  meta: string;
  body: string;
};

type DraggedProtocolItem = {
  kind: ProtocolItemKind;
  itemId: string;
};

const sectionConfig: Array<{ kind: ProtocolItemKind; title: string; addLabel: string }> = [
  { kind: 'updates', title: 'Updates', addLabel: 'Add update' },
  { kind: 'topics', title: 'Topics', addLabel: 'Add topic' },
  { kind: 'todos', title: 'To-Dos', addLabel: 'Add to-do' },
];

const protocolWorkspaceClass =
  'mt-3 grid grid-cols-[260px_minmax(0,1fr)] items-start gap-3 max-sm:grid-cols-1';
const protocolListClass =
  'grid max-h-full gap-2 overflow-auto max-sm:max-h-[42dvh] max-[420px]:max-h-[38dvh]';
const protocolListToggleClass =
  'protocol-list-toggle segmented grid-cols-2';
const protocolListFilterClass =
  'sticky top-0 z-[2] grid gap-1.5 bg-[var(--panel)] pb-1';
const protocolDetailClass = 'grid min-w-0 gap-2.5';
const protocolMetaToolbarClass =
  `${uiCard} flex min-w-0 items-end gap-2 overflow-visible p-[7px] max-lg:flex-wrap max-sm:w-full max-sm:grid max-sm:grid-cols-1 max-sm:p-1.5 max-[420px]:mx-[-2px] max-[420px]:gap-1 max-[420px]:rounded-none max-[420px]:border-x-0 max-[420px]:px-1`;
const protocolMetaGridClass =
  'flex-1 space-y-2 lg:space-y-0 lg:grid items-center grid-cols-[minmax(220px,1.25fr)_minmax(138px,0.58fr)_repeat(3,minmax(128px,0.78fr))] gap-1.5 max-lg:min-w-0 max-lg:flex-[1_0_100%] max-sm:w-full max-sm:grid-cols-1 max-[420px]:gap-1';
const protocolActionsClass =
  'flex shrink-0 flex-wrap items-center justify-end gap-1.5 max-lg:flex-[1_0_100%] max-sm:grid max-sm:grid-cols-[repeat(5,var(--icon-button-size))] max-sm:gap-1.5 max-sm:justify-end max-[420px]:grid-cols-[repeat(3,var(--icon-button-size))]';
const protocolTimerClass =
  'mr-auto grid grid-cols-[minmax(72px,auto)_repeat(2,34px)] items-center gap-[5px] max-sm:col-span-full max-sm:mr-0 max-sm:w-full max-sm:flex-[1_0_100%] max-sm:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,auto))] max-[420px]:grid-cols-[minmax(0,1fr)_auto_auto]';
const protocolTimerReadoutClass =
  'rounded-[2px] border border-[rgba(36,34,29,0.28)] bg-[var(--hot)] px-2 py-[10px] text-center font-mono text-[15px] leading-none font-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] max-sm:min-w-0 max-sm:text-left';
const protocolSectionsClass =
  'grid min-w-0 max-w-full gap-3.5 overflow-x-clip overflow-y-visible';
const protocolStructuredSectionBaseClass =
  `${uiCard} protocol-structured-section relative z-0 grid min-w-0 max-w-full gap-2.5 overflow-x-clip overflow-y-visible bg-[#fffdf8] p-[9px] shadow-none hover:z-20 focus-within:z-20`;
const protocolSectionTitleClass =
  `${uiCard} protocol-section-title relative z-[1] flex items-center justify-between gap-2 p-[7px_8px]`;
const protocolSectionTitleActionsClass =
  'flex flex-wrap items-center justify-end gap-1.5';
const protocolAddInlineClass =
  'ml-1 inline-flex min-h-[var(--icon-button-size)] w-[calc(100%-4px)] items-center justify-center rounded-[2px] border border-dashed border-[rgba(36,34,29,0.34)] bg-white px-2 text-[11px] font-black text-[var(--muted)] uppercase shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)] hover:text-[var(--text)]';

export function MeetingProtocols({
  projectHash,
  canEdit,
  protocols,
  instructionTemplate,
  requestedProtocolId,
  onProtocolSelect,
  onCopyLink,
  linkCopied,
  moveControls,
  onChange,
  onInstructionTemplateChange,
  onCreateTodo,
  onOpenTodo,
  onOpenEvent,
  onCreateEvent,
}: MeetingProtocolsProps) {
  const appDialog = useAppDialog();
  const [isMinimized, setIsMinimized] = usePersistentState(`timeline:ui:meeting-protocols-minimized:${projectHash}`, false);
  const [showInstruction, setShowInstruction] = usePersistentState(`timeline:ui:meeting-protocols-instruction:${projectHash}`, true);
  const [isEditingInstruction, setIsEditingInstruction] = usePersistentState(`timeline:ui:meeting-protocols-edit-instruction:${projectHash}`, false);
  const [showProtocolEntries, setShowProtocolEntries] = usePersistentState(`timeline:ui:meeting-protocols-left-entries:${projectHash}`, false);
  const [collapsedProtocolSections, setCollapsedProtocolSections] = usePersistentState<Record<ProtocolItemKind, boolean>>(
    `timeline:ui:meeting-protocols-collapsed-sections:${projectHash}`,
    { updates: false, topics: false, todos: false },
  );
  const [selectedProtocolId, setSelectedProtocolId] = useState(protocols[0]?.id ?? '');
  const [selectedOverviewItemId, setSelectedOverviewItemId] = useState('');
  const [editingItem, setEditingItem] = useState<{
    kind: ProtocolItemKind;
    item: MeetingProtocolItem;
    isNew: boolean;
  } | null>(null);
  const [draggedProtocolItem, setDraggedProtocolItem] = useState<DraggedProtocolItem | null>(null);
  const [dropTargetKind, setDropTargetKind] = useState<ProtocolItemKind | null>(null);
  const [search, setSearch] = useState('');
  const [timerTick, setTimerTick] = useState(0);
  const entryScrollTimeoutRef = useRef<number | undefined>(undefined);
  const consumedRequestedProtocolRef = useRef('');
  const selectedProtocol = protocols.find((protocol) => protocol.id === selectedProtocolId) ?? protocols[0];
  const selectedProtocolDuration = selectedProtocol ? currentProtocolDuration(selectedProtocol, timerTick) : 0;
  const isTimerRunning = Boolean(selectedProtocol?.timerStartedAt);
  const timerStartLabel = selectedProtocolDuration > 0 ? 'Resume' : 'Start';
  const searchTimerTick = search.trim() ? timerTick : 0;
  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return protocols;

    return protocols.filter((protocol) => protocolMatchesQuery(protocol, query, searchTimerTick));
  }, [protocols, search, searchTimerTick]);
  const overviewItems = useMemo(
    () => buildProtocolOverviewItems(protocols, search, searchTimerTick),
    [protocols, search, searchTimerTick],
  );
  const allOverviewItems = useMemo(
    () => buildProtocolOverviewItems(protocols, '', searchTimerTick),
    [protocols, searchTimerTick],
  );
  const hasActiveFilter = Boolean(search.trim());

  useEffect(() => {
    const timeout = window.setTimeout(() => setTimerTick(Date.now()), 0);
    if (!selectedProtocol?.timerStartedAt) return () => window.clearTimeout(timeout);

    const interval = window.setInterval(() => setTimerTick(Date.now()), 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [selectedProtocol?.timerStartedAt]);

  useEffect(() => {
    return () => {
      if (entryScrollTimeoutRef.current) window.clearTimeout(entryScrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!requestedProtocolId) return;
    if (!protocols.some((protocol) => protocol.id === requestedProtocolId)) return;
    const requestKey = `${projectHash}:${requestedProtocolId}`;
    if (consumedRequestedProtocolRef.current === requestKey) return;
    consumedRequestedProtocolRef.current = requestKey;

    const timeout = window.setTimeout(() => {
      setSelectedProtocolId(requestedProtocolId);
      setSelectedOverviewItemId('');
      setShowProtocolEntries(false);
      setIsMinimized(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [projectHash, protocols, requestedProtocolId, setIsMinimized, setShowProtocolEntries]);

  function addProtocol() {
    const protocol = createMeetingProtocol();
    onChange([protocol, ...protocols]);
    setSelectedProtocolId(protocol.id);
    setSelectedOverviewItemId('');
    onProtocolSelect(protocol.id);
  }

  function showProtocols() {
    setShowProtocolEntries(false);
    setSelectedOverviewItemId('');
    if (entryScrollTimeoutRef.current) window.clearTimeout(entryScrollTimeoutRef.current);
  }

  function showEntries() {
    setShowProtocolEntries(true);
    setSelectedOverviewItemId('');
  }

  function selectOverviewItem(item: ProtocolOverviewItem) {
    setSelectedProtocolId(item.protocolId);
    setSelectedOverviewItemId(item.id);
    onProtocolSelect(item.protocolId);
    if (entryScrollTimeoutRef.current) window.clearTimeout(entryScrollTimeoutRef.current);
    entryScrollTimeoutRef.current = window.setTimeout(() => {
      document.getElementById(item.id)?.scrollIntoView({ block: 'center' });
    }, 0);
  }

  function updateProtocol(patch: Partial<MeetingProtocol>) {
    if (!selectedProtocol) return;

    const nextProtocol = {
      ...selectedProtocol,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    onChange(protocols.map((protocol) => (protocol.id === selectedProtocol.id ? nextProtocol : protocol)));
  }

  function updateDate(date: string) {
    if (!selectedProtocol) return;

    updateProtocol({
      date,
      title: isGeneratedProtocolTitle(selectedProtocol)
        ? protocolTitle(date, selectedProtocol.time)
        : selectedProtocol.title,
    });
  }

  function startTimer() {
    if (!selectedProtocol || selectedProtocol.timerStartedAt) return;

    setTimerTick(Date.now());
    updateProtocol({ timerStartedAt: new Date().toISOString() });
  }

  function pauseTimer() {
    if (!selectedProtocol?.timerStartedAt) return;

    const now = Date.now();
    updateProtocol({
      durationSeconds: currentProtocolDuration(selectedProtocol, now),
      timerStartedAt: undefined,
    });
    setTimerTick(now);
  }

  function stopTimer() {
    pauseTimer();
  }

  async function deleteProtocol() {
    if (!selectedProtocol) return;
    if (
      !(await appDialog.confirm({
        title: 'Delete protocol?',
        message: `Delete "${selectedProtocol.title}"?`,
        confirmLabel: 'Delete protocol',
        tone: 'danger',
      }))
    ) {
      return;
    }
    onChange(protocols.filter((protocol) => protocol.id !== selectedProtocol.id));
  }

  function addItem(kind: ProtocolItemKind) {
    if (!selectedProtocol) return;

    setEditingItem({
      kind,
      item: createProtocolItem(kind, selectedProtocol[kind].length + 1),
      isNew: true,
    });
  }

  function editItem(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    setEditingItem({ kind, item, isNew: false });
  }

  function saveEditingItem() {
    if (!selectedProtocol || !editingItem) return;

    const nextItem = {
      ...editingItem.item,
      updatedAt: new Date().toISOString(),
    };

    updateProtocol({
      [editingItem.kind]: editingItem.isNew
        ? [...selectedProtocol[editingItem.kind], nextItem]
        : selectedProtocol[editingItem.kind].map((item) => (item.id === nextItem.id ? nextItem : item)),
    });
    setEditingItem(null);
  }

  function updateEditingItem(patch: Partial<MeetingProtocolItem>) {
    if (!editingItem) return;

    setEditingItem({
      ...editingItem,
      item: {
        ...editingItem.item,
        ...patch,
      },
    });
  }

  async function deleteItem(kind: ProtocolItemKind, itemId: string) {
    if (!selectedProtocol) return;

    if (
      !(await appDialog.confirm({
        title: `Delete ${protocolItemLabel(kind).toLowerCase()}?`,
        message: `Delete this ${protocolItemLabel(kind).toLowerCase()}?`,
        confirmLabel: 'Delete',
        tone: 'danger',
      }))
    ) {
      return;
    }

    updateProtocol({
      [kind]: selectedProtocol[kind].filter((item) => item.id !== itemId),
    });
  }

  async function addItemComment(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!selectedProtocol) return;

    const body = await appDialog.prompt({
      title: 'Add comment',
      label: 'Comment',
      confirmLabel: 'Add comment',
      confirmIcon: <MessageCircle size={18} aria-hidden="true" />,
      cancelIcon: <X size={18} aria-hidden="true" />,
    });
    if (!body?.trim()) return;

    const now = new Date().toISOString();
    const nextItem = {
      ...item,
      comments: [...(item.comments ?? []), createTimelineComment(body, now)],
      updatedAt: now,
    };

    updateProtocol({
      [kind]: selectedProtocol[kind].map((entry) => (entry.id === item.id ? nextItem : entry)),
    });
  }

  async function deleteEditingItem() {
    if (!editingItem) return;
    if (editingItem.isNew) {
      setEditingItem(null);
      return;
    }

    await deleteItem(editingItem.kind, editingItem.item.id);
    setEditingItem(null);
  }

  function startDraggingProtocolItem(kind: ProtocolItemKind, itemId: string) {
    setDraggedProtocolItem({ kind, itemId });
  }

  function allowProtocolDrop(event: DragEvent, kind: ProtocolItemKind) {
    if (!draggedProtocolItem) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetKind(kind);
  }

  function dropProtocolItem(kind: ProtocolItemKind, targetItemId?: string) {
    if (!selectedProtocol || !draggedProtocolItem) return;

    const movedProtocol = moveProtocolItem(
      selectedProtocol,
      draggedProtocolItem.kind,
      draggedProtocolItem.itemId,
      kind,
      targetItemId,
    );

    setDraggedProtocolItem(null);
    setDropTargetKind(null);
    if (movedProtocol === selectedProtocol) return;

    onChange(protocols.map((protocol) => (protocol.id === selectedProtocol.id ? movedProtocol : protocol)));
  }

  function createEventFromProtocol() {
    if (!selectedProtocol) return;

    onCreateEvent({
      title: selectedProtocol.title,
      body: protocolConversionBody(withCurrentDuration(selectedProtocol, timerTick)),
      date: selectedProtocol.date,
    });
  }

  function exportProtocolPdf() {
    if (!selectedProtocol) return;

    const protocolForExport = withCurrentDuration(selectedProtocol, timerTick);
    const printWindow = window.open('', '_blank', 'width=920,height=1100');
    if (!printWindow) {
      void appDialog.alert({
        title: 'Export blocked',
        message: 'Please allow pop-ups to export this protocol as PDF.',
      });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(protocolPdfHtml(protocolForExport));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function createTodoFromItem(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!selectedProtocol) return;
    if (item.convertedTodoId) {
      onOpenTodo(item.convertedTodoId);
      return;
    }

    onCreateTodo({
      title: item.title,
      body: item.body,
      who: item.owner,
      protocolId: selectedProtocol.id,
      protocolItemId: item.id,
      protocolItemKind: kind,
      date: selectedProtocol.date,
    });
  }

  function createEventFromItem(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!selectedProtocol) return;
    if (item.convertedEventId) {
      onOpenEvent(item.convertedEventId);
      return;
    }

    onCreateEvent({
      title: item.title,
      body: protocolItemConversionBody(selectedProtocol, kind, item),
      date: selectedProtocol.date,
      protocolId: selectedProtocol.id,
      protocolItemId: item.id,
      protocolItemKind: kind,
    });
  }

  function toggleProtocolSection(kind: ProtocolItemKind) {
    setCollapsedProtocolSections((sections) => ({
      updates: Boolean(sections.updates),
      topics: Boolean(sections.topics),
      todos: Boolean(sections.todos),
      [kind]: !sections[kind],
    }));
  }

  return (
    <SectionShell
      title="Protocols"
      className="protocol-section"
      isCollapsed={isMinimized}
      onToggle={() => setIsMinimized((minimized) => !minimized)}
      copyLink={{
        onCopy: onCopyLink,
        copied: linkCopied,
        label: 'Copy protocols link',
      }}
      moveControls={moveControls}
      meta={`${filteredProtocols.length} / ${protocols.length}`}
      subheader={
        <button
          type="button"
          className="icon-button protocol-add-button"
          onClick={addProtocol}
          aria-label="Add protocol"
          title="Add protocol"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      }
    >
        <div className={protocolWorkspaceClass}>
          <aside className={protocolListClass} aria-label="Meeting protocols">
            <div className={protocolListFilterClass}>
              <div className={protocolListToggleClass}>
                <button
                  type="button"
                  className={showProtocolEntries ? '' : 'active'}
                  onClick={showProtocols}
                >
                  Protocols
                </button>
                <button
                  type="button"
                  className={showProtocolEntries ? 'active' : ''}
                  onClick={showEntries}
                >
                  Entries
                </button>
              </div>
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Date, person, update, topic, to-do"
                className="max-w-none"
              />
              <FilterBadge
                active={hasActiveFilter}
                label={`${showProtocolEntries ? overviewItems.length : filteredProtocols.length} / ${showProtocolEntries ? allOverviewItems.length : protocols.length}`}
                detail="Protocol search active"
                onClear={() => setSearch('')}
                clearLabel="Clear protocol search"
                className="w-full"
              />
            </div>
            {showProtocolEntries ? (
              <>
                {overviewItems.length ? (
                  overviewItems.map((item) => (
                    <button
                      type="button"
                      className={`protocol-overview-item ${item.kind} ${item.id === selectedOverviewItemId ? 'active' : ''}`}
                      key={item.id}
                      onClick={() => selectOverviewItem(item)}
                    >
                      <b>{item.title}</b>
                      <span>{item.meta}</span>
                      <div className="protocol-overview-markdown">
                        <MarkdownBlock markdown={item.body || '_No details_'} />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="protocol-empty">No entries</div>
                )}
              </>
            ) : filteredProtocols.length ? (
              filteredProtocols.map((protocol) => (
                <button
                  type="button"
                  className={protocol.id === selectedProtocol?.id ? 'protocol-list-item active' : 'protocol-list-item'}
                  key={protocol.id}
                  onClick={() => {
                    setSelectedProtocolId(protocol.id);
                    setSelectedOverviewItemId('');
                    onProtocolSelect(protocol.id);
                  }}
                >
                  <span className="protocol-list-heading">
                    <b>{protocol.title}</b>
                    <span className="protocol-list-date">{formatProtocolOverviewDate(protocol.date)}</span>
                  </span>
                  <span className="protocol-list-duration">{formatProtocolDuration(currentProtocolDuration(protocol, timerTick))}</span>
                  <small>{protocol.updates.length} updates · {protocol.topics.length} topics · {protocol.todos.length} to-dos</small>
                </button>
              ))
            ) : (
              <div className="protocol-empty">No protocols</div>
            )}
          </aside>
          {selectedProtocol ? (
            <div className={protocolDetailClass}>
              <div className={protocolMetaToolbarClass}>
                <div className={protocolMetaGridClass}>
                  <TextField
                    label="Title"
                    value={selectedProtocol.title}
                    onValueChange={(title) => updateProtocol({ title })}
                    placeholder="Tägliches Platz-Plenum"
                    className="min-w-0"
                    inputClassName="!text-sm sm:!text-base"
                  />
                  <TextField
                    label="Date"
                    type="date"
                    value={selectedProtocol.date}
                    onValueChange={updateDate}
                    className="min-w-0"
                  />
                  <TextField
                    label="Moderation"
                    value={selectedProtocol.moderation}
                    onValueChange={(moderation) => updateProtocol({ moderation })}
                    placeholder="Name"
                    aria-label="Moderation name"
                    className="min-w-0"
                  />
                  <TextField
                    label="Protokoll"
                    value={selectedProtocol.protocolWriter}
                    onValueChange={(protocolWriter) => updateProtocol({ protocolWriter })}
                    placeholder="Name"
                    aria-label="Protocol writer name"
                    className="min-w-0"
                  />
                  <TextField
                    label="Todo-person"
                    value={selectedProtocol.todoOwner}
                    onValueChange={(todoOwner) => updateProtocol({ todoOwner })}
                    placeholder="Name"
                    aria-label="Todo person name"
                    className="min-w-0"
                  />
                </div>
                <div className={protocolActionsClass}>
                  <div className={protocolTimerClass} aria-label="Protocol duration">
                    <strong className={protocolTimerReadoutClass}>{formatProtocolDuration(selectedProtocolDuration)}</strong>
                    {isTimerRunning ? (
                      <>
                        <button type="button" className="icon-button secondary protocol-timer-button" onClick={pauseTimer} aria-label="Pause timer" title="Pause">
                          <Pause size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-button secondary protocol-timer-button" onClick={stopTimer} aria-label="Stop timer" title="Stop">
                          <Square size={16} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <button type="button" className="icon-button secondary protocol-timer-button" onClick={startTimer} aria-label={`${timerStartLabel} timer`} title={timerStartLabel}>
                        <Play size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-button secondary protocol-action-button"
                    onClick={() => setShowInstruction((visible) => !visible)}
                    aria-label={showInstruction ? 'Hide instruction' : 'Show instruction'}
                    title={showInstruction ? 'Hide instruction' : 'Show instruction'}
                  >
                    {showInstruction ? <EyeOff size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      className="icon-button secondary protocol-action-button"
                      onClick={() => setIsEditingInstruction((editing) => !editing)}
                      aria-label={isEditingInstruction ? 'Preview instruction' : 'Edit instruction'}
                      title={isEditingInstruction ? 'Preview instruction' : 'Edit instruction'}
                    >
                      {isEditingInstruction ? <Eye size={17} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-button secondary protocol-action-button"
                    onClick={createEventFromProtocol}
                    aria-label="Create event from protocol"
                    title="Event from protocol"
                  >
                    <CalendarPlus size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button secondary protocol-action-button"
                    onClick={exportProtocolPdf}
                    aria-label="Export protocol as PDF"
                    title="Export PDF"
                  >
                    <Download size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger protocol-action-button"
                    onClick={() => void deleteProtocol()}
                    aria-label="Delete protocol"
                    title="Delete protocol"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {showInstruction ? (
                <details className="protocol-instruction" open>
                  <summary>Instruction</summary>
                  {canEdit && isEditingInstruction ? (
                    <MarkdownEditor
                      className="protocol-editor protocol-instruction-editor"
                      value={instructionTemplate}
                      onChange={onInstructionTemplateChange}
                      rows={13}
                    />
                  ) : (
                    <pre>{createMeetingProtocolInstruction(selectedProtocol.date, selectedProtocolDuration, instructionTemplate)}</pre>
                  )}
                </details>
              ) : null}
              <div className={protocolSectionsClass}>
                {sectionConfig.map((section) => (
                  <ProtocolStructuredSection
                    key={section.kind}
                    protocol={selectedProtocol}
                    kind={section.kind}
                    title={section.title}
                    addLabel={section.addLabel}
                    collapsed={Boolean(collapsedProtocolSections[section.kind])}
                    search={search}
                    onAdd={() => addItem(section.kind)}
                    onToggleCollapsed={() => toggleProtocolSection(section.kind)}
                    onEdit={(item) => editItem(section.kind, item)}
                    onDelete={(itemId) => void deleteItem(section.kind, itemId)}
                    onAddComment={(item) => void addItemComment(section.kind, item)}
                    draggedItem={draggedProtocolItem}
                    isDropTarget={dropTargetKind === section.kind}
                    onDragStart={(itemId) => startDraggingProtocolItem(section.kind, itemId)}
                    onDragOver={(event) => allowProtocolDrop(event, section.kind)}
                    onDragEnd={() => {
                      setDraggedProtocolItem(null);
                      setDropTargetKind(null);
                    }}
                    onDrop={(targetItemId) => dropProtocolItem(section.kind, targetItemId)}
                    onCreateTodo={(item) => createTodoFromItem(section.kind, item)}
                    onOpenTodo={onOpenTodo}
                    onOpenEvent={onOpenEvent}
                    onCreateEvent={(item) => createEventFromItem(section.kind, item)}
                  />
                ))}
                <section
                  className={cn(
                    protocolStructuredSectionBaseClass,
                    'border-[#c9c4b8]',
                  )}
                  id={`protocol-${selectedProtocol.id}-notes`}
                >
                  <div className={protocolSectionTitleClass}>
                    <h3 className="m-0 text-sm font-black uppercase">Notes</h3>
                  </div>
                  <MarkdownEditor
                    className="protocol-editor protocol-notes-editor"
                    value={selectedProtocol.body}
                    onChange={(body) => updateProtocol({ body })}
                    placeholder="Optional markdown notes that do not fit into updates, topics, or to-dos."
                    rows={8}
                  />
                </section>
              </div>
            </div>
          ) : (
            <div className="protocol-empty protocol-empty-detail">No protocol selected</div>
          )}
        </div>
      {editingItem ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${protocolItemLabel(editingItem.kind)}`}>
          <form
            className="editor-panel modal-panel protocol-item-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              saveEditingItem();
            }}
          >
            <div className="panel-title">{protocolItemLabel(editingItem.kind)}</div>
            <div className="form-grid">
              <TextField
                label="Headline"
                value={editingItem.item.title}
                onValueChange={(title) => updateEditingItem({ title })}
                required
                autoFocus
              />
              <TextField
                label="Name"
                value={editingItem.item.owner}
                onValueChange={(owner) => updateEditingItem({ owner })}
              />
            </div>
            <label>
              <span>Markdown details</span>
              <MarkdownEditor
                value={editingItem.item.body}
                onChange={(body) => updateEditingItem({ body })}
                rows={8}
              />
            </label>
            <div className="action-row">
              <button
                type="submit"
                className="icon-button modal-action-icon"
                aria-label={`Save ${protocolItemLabel(editingItem.kind).toLowerCase()}`}
                title={`Save ${protocolItemLabel(editingItem.kind).toLowerCase()}`}
              >
                <Save size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button tertiary modal-action-icon"
                onClick={() => setEditingItem(null)}
                aria-label="Cancel"
                title="Cancel"
              >
                <X size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button danger modal-action-icon"
                onClick={() => void deleteEditingItem()}
                aria-label={`Delete ${protocolItemLabel(editingItem.kind).toLowerCase()}`}
                title={`Delete ${protocolItemLabel(editingItem.kind).toLowerCase()}`}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {appDialog.dialog}
    </SectionShell>
  );
}

function ProtocolStructuredSection({
  protocol,
  kind,
  title,
  addLabel,
  collapsed,
  search,
  onAdd,
  onToggleCollapsed,
  onEdit,
  onDelete,
  onAddComment,
  draggedItem,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onCreateTodo,
  onOpenTodo,
  onOpenEvent,
  onCreateEvent,
}: {
  protocol: MeetingProtocol;
  kind: ProtocolItemKind;
  title: string;
  addLabel: string;
  collapsed: boolean;
  search: string;
  onAdd: () => void;
  onToggleCollapsed: () => void;
  onEdit: (item: MeetingProtocolItem) => void;
  onDelete: (itemId: string) => void;
  onAddComment: (item: MeetingProtocolItem) => void;
  draggedItem: DraggedProtocolItem | null;
  isDropTarget: boolean;
  onDragStart: (itemId: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (targetItemId?: string) => void;
  onCreateTodo: (item: MeetingProtocolItem) => void;
  onOpenTodo: (todoId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onCreateEvent: (item: MeetingProtocolItem) => void;
}) {
  const query = search.trim().toLowerCase();
  const items = query
    ? protocol[kind].filter((item) => itemMatchesQuery(item, query))
    : protocol[kind];

  return (
    <section
      className={cn(
        protocolStructuredSectionBaseClass,
        kind === 'updates' &&
          'border-[color-mix(in_srgb,var(--cyan)_58%,rgba(36,34,29,0.2))]',
        kind === 'topics' &&
          'border-[color-mix(in_srgb,var(--hot)_58%,rgba(36,34,29,0.2))]',
        kind === 'todos' &&
          'border-[color-mix(in_srgb,var(--primary-strong)_58%,rgba(36,34,29,0.2))]',
        isDropTarget &&
          'outline outline-3 outline-[var(--hot)] outline-offset-[-6px]',
      )}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div
        className={cn(
          protocolSectionTitleClass,
          kind === 'updates' && 'bg-[#f2fbfe]',
          kind === 'topics' && 'bg-[#fff2f8]',
          kind === 'todos' && 'bg-[#fbfee9]',
        )}
      >
        <div>
          <h3 className="m-0 text-sm font-black uppercase">{title}</h3>
          <span className="mt-0.5 block text-[10px] font-extrabold text-[var(--muted)] uppercase">
            {collapsed ? `${items.length} entries hidden` : `${items.length} entries`}
          </span>
        </div>
        <div className={protocolSectionTitleActionsClass}>
          <button
            type="button"
            className="icon-button secondary h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            onClick={onAdd}
            aria-label={addLabel}
            title={addLabel}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`event-table-toggle mini-button h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] ${collapsed ? 'collapsed' : 'expanded'}`}
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Show ${title}` : `Hide ${title}`}
            title={collapsed ? `Show ${title}` : `Hide ${title}`}
          >
            {collapsed ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {collapsed ? null : items.length ? (
        <div className="protocol-entry-list">
          {items.map((item) => (
            <article
              className={`protocol-entry ${kind} ${item.convertedTodoId || item.convertedEventId ? 'converted' : ''} ${draggedItem?.itemId === item.id ? 'dragging' : ''}`}
              draggable
              id={`protocol-${protocol.id}-${kind}-${item.id}`}
              key={item.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.id);
                onDragStart(item.id);
              }}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDrop(item.id);
              }}
              onClick={() => onEdit(item)}
            >
              <div className="protocol-entry-summary">
                <div>
                  <h4>{item.title}</h4>
                  {item.owner ? <span>{item.owner}</span> : null}
                </div>
                <div className="protocol-entry-controls">
                  {item.convertedTodoId || item.convertedEventId ? (
                    <span className="protocol-converted-label">
                      {item.convertedTodoId && item.convertedEventId
                        ? 'Todo + event'
                        : item.convertedTodoId
                          ? 'Todo'
                          : 'Event'}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="icon-button tertiary protocol-entry-icon-button protocol-edit-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(item);
                    }}
                    aria-label={`Edit ${item.title}`}
                    title="Edit"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="protocol-entry-preview">
                <MarkdownBlock markdown={item.body || '_No details yet._'} />
              </div>
              {item.comments?.length ? (
                <div className="card-comments" aria-label="Protocol item comments">
                  {item.comments.map((comment) => (
                    <div className="card-comment" key={comment.id}>
                      <time dateTime={comment.createdAt}>{formatProtocolUpdatedAt(comment.createdAt)}</time>
                      <span>{comment.body}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="protocol-entry-actions">
                <time className="protocol-updated-meta" dateTime={item.updatedAt}>
                  upd {formatProtocolUpdatedAt(item.updatedAt)}
                </time>
                <div className="protocol-entry-action-buttons">
                  {item.convertedTodoId ? (
                    <button
                      type="button"
                      className="icon-button protocol-convert-action protocol-linked-todo"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenTodo(item.convertedTodoId!);
                      }}
                      aria-label="Open linked todo"
                      title="Open linked todo"
                    >
                      <ListTodo size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-button protocol-convert-action protocol-create-todo"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateTodo(item);
                      }}
                      aria-label="Create todo"
                      title="Create todo"
                    >
                      <ListTodo size={16} aria-hidden="true" />
                    </button>
                  )}
                  {item.convertedEventId ? (
                    <button
                      type="button"
                      className="icon-button protocol-convert-action protocol-linked-event"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenEvent(item.convertedEventId!);
                      }}
                      aria-label="Open linked event"
                      title="Open linked event"
                    >
                      <CalendarPlus size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-button protocol-convert-action protocol-create-event"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateEvent(item);
                      }}
                      aria-label="Create event"
                      title="Create event"
                    >
                      <CalendarPlus size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button tertiary protocol-entry-icon-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddComment(item);
                    }}
                    aria-label={`Comment on ${item.title}`}
                    title="Comment"
                  >
                    <MessageCircle size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger protocol-entry-icon-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(item.id);
                    }}
                    aria-label={`Delete ${item.title}`}
                    title="Delete"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div
          className="protocol-empty protocol-drop-empty"
          onDragOver={onDragOver}
          onDrop={(event) => {
            event.preventDefault();
            onDrop();
          }}
        >
          Drop here or add {title.toLowerCase()}
        </div>
      )}
      <button type="button" className={protocolAddInlineClass} onClick={onAdd}>
        {addLabel}
      </button>
    </section>
  );
}

function buildProtocolOverviewItems(protocols: MeetingProtocol[], search: string, now: number): ProtocolOverviewItem[] {
  const query = search.trim().toLowerCase();
  const items = protocols.flatMap((protocol) =>
    sectionConfig.flatMap((section) =>
      protocol[section.kind].map((item) => ({
        id: `protocol-${protocol.id}-${section.kind}-${item.id}`,
        protocolId: protocol.id,
        kind: section.kind,
        title: item.title,
        meta: [formatProtocolOverviewMeta(protocol, now), section.title, item.owner].filter(Boolean).join(' · '),
        body: item.body,
        searchable: [
          protocol.title,
          protocol.date,
          formatProtocolOverviewDate(protocol.date),
          formatProtocolDuration(currentProtocolDuration(protocol, now)),
          section.title,
          item.title,
          item.owner,
          item.body,
        ]
          .join(' ')
          .toLowerCase(),
      })),
    ),
  );

  return query ? items.filter((item) => item.searchable.includes(query)) : items;
}

function protocolMatchesQuery(protocol: MeetingProtocol, query: string, now: number) {
  return [
    protocol.title,
    protocol.date,
    formatProtocolOverviewDate(protocol.date),
    formatProtocolDuration(currentProtocolDuration(protocol, now)),
    protocol.moderation,
    protocol.protocolWriter,
    protocol.todoOwner,
    protocol.body,
    ...sectionConfig.flatMap((section) =>
          protocol[section.kind].flatMap((item) => [
            section.title,
            item.title,
            item.owner,
            item.body,
            ...(item.comments ?? []).map((comment) => comment.body),
          ]),
    ),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function itemMatchesQuery(item: MeetingProtocolItem, query: string) {
  return [item.title, item.owner, item.body, ...(item.comments ?? []).map((comment) => comment.body)]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function formatProtocolOverviewMeta(protocol: MeetingProtocol, now: number) {
  return `${formatProtocolOverviewDate(protocol.date)} - ${formatProtocolDuration(currentProtocolDuration(protocol, now))}`;
}

function formatProtocolUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const time = formatClockTime(date);
  if (localDateString(date) === localDateString(new Date())) return time;

  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')} ${time}`;
}

function formatClockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function protocolPdfHtml(protocol: MeetingProtocol) {
  const title = escapePdfHtml(protocol.title || 'Protocol');
  const meta = escapePdfHtml(formatProtocolOverviewMeta(protocol, Date.now()));
  const roles = [
    ['Moderation', protocol.moderation],
    ['Protokoll', protocol.protocolWriter],
    ['Todo-person', protocol.todoOwner],
  ];
  const sections = [
    protocolItemsPdf('Updates', 'updates', protocol.updates),
    protocolItemsPdf('Topics', 'topics', protocol.topics),
    protocolItemsPdf('To-Dos', 'todos', protocol.todos),
  ].filter(Boolean).join('');
  const notes = protocol.body.trim()
    ? `<section class="notes-section"><h2>Notes</h2><div class="markdown">${renderMarkdown(protocol.body)}</div></section>`
    : '';
  const emptyState = sections || notes ? '' : '<p class="empty">No protocol entries recorded.</p>';

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      @page { margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #1d211f;
        background: #fff;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 10.5px;
        line-height: 1.32;
      }
      header {
        border-bottom: 1.5px solid #1d211f;
        margin-bottom: 8px;
        padding-bottom: 7px;
      }
      h1, h2, h3, h4, p { margin-top: 0; }
      h1 {
        font-size: 20px;
        line-height: 1.1;
        margin-bottom: 4px;
      }
      h2 {
        border-bottom: 1px solid #d8ddd7;
        font-size: 13px;
        margin: 10px 0 5px;
        padding-bottom: 3px;
      }
      h3 {
        font-size: 11px;
        margin: 0;
      }
      .meta {
        color: #5d665f;
        font-size: 10.5px;
      }
      .roles {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        margin-top: 5px;
        color: #3d453f;
      }
      .role-label,
      .entry-meta,
      .section-count {
        color: #667069;
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      .role-value {
        font-weight: 700;
      }
      section { break-inside: avoid; }
      .section-heading {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: baseline;
      }
      article {
        border: 1px solid #dfe4df;
        border-radius: 5px;
        margin-bottom: 4px;
        padding: 5px 7px 5px 8px;
        break-inside: avoid;
      }
      article.updates { border-left: 3px solid #4f8f6f; }
      article.topics { border-left: 3px solid #b06f42; }
      article.todos { border-left: 3px solid #7d6cc7; }
      .entry-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: baseline;
        margin-bottom: 2px;
      }
      .empty {
        color: #737d76;
        font-style: italic;
      }
      .markdown h1 { font-size: 13px; margin: 4px 0 2px; }
      .markdown h2 { font-size: 12px; border: 0; margin: 4px 0 2px; padding: 0; }
      .markdown h3 { font-size: 11px; margin: 3px 0 2px; }
      .markdown p, .markdown ul, .markdown ol, .markdown blockquote { margin: 0 0 3px; }
      .markdown ul, .markdown ol { padding-left: 14px; }
      .markdown blockquote {
        border-left: 2px solid #c9d0ca;
        color: #56615a;
        padding-left: 6px;
      }
      .markdown code {
        background: #f1f4f2;
        border-radius: 3px;
        padding: 0 3px;
      }
      .markdown-color-text { font-weight: inherit; }
    </style>
  </head>
  <body>
    <header>
      <h1>${title}</h1>
      <div class="meta">${meta}</div>
      <div class="roles">
        ${roles
          .map(([label, value]) => `<span><span class="role-label">${escapePdfHtml(label)}:</span> <span class="role-value">${escapePdfHtml(value || 'Not set')}</span></span>`)
          .join('')}
      </div>
    </header>
    ${sections}
    ${notes}
    ${emptyState}
  </body>
</html>`;
}

function protocolItemsPdf(title: string, kind: ProtocolItemKind, items: MeetingProtocolItem[]) {
  if (!items.length) return '';

  const content = items
    .map((item) => `
      <article class="${kind}">
        <div class="entry-head">
          <h3>${escapePdfHtml(item.title || 'Untitled')}</h3>
          <span class="entry-meta">${escapePdfHtml(item.owner || 'No name')}</span>
        </div>
        <div class="markdown">${renderMarkdown(item.body || '_No details._')}</div>
      </article>`)
    .join('');

  return `
    <section>
      <div class="section-heading">
        <h2>${escapePdfHtml(title)}</h2>
        <span class="section-count">${items.length} entries</span>
      </div>
      ${content}
    </section>`;
}

function escapePdfHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatProtocolOverviewDate(date: string) {
  const parsedDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;

  const weekday = parsedDate.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');

  return `${weekday} - ${day}.${month}.${parsedDate.getFullYear()}`;
}

function withCurrentDuration(protocol: MeetingProtocol, now: number): MeetingProtocol {
  return {
    ...protocol,
    durationSeconds: currentProtocolDuration(protocol, now),
  };
}

function currentProtocolDuration(protocol: MeetingProtocol, now: number) {
  const baseDuration = Math.max(0, Math.floor(protocol.durationSeconds || 0));
  if (!protocol.timerStartedAt) return baseDuration;

  const startedAt = Date.parse(protocol.timerStartedAt);
  if (!Number.isFinite(startedAt)) return baseDuration;

  return baseDuration + Math.max(0, Math.floor((now - startedAt) / 1000));
}

function isGeneratedProtocolTitle(protocol: MeetingProtocol) {
  return (
    protocol.title === protocolTitle(protocol.date, protocol.time) ||
    protocol.title === protocolTitle(protocol.date)
  );
}
