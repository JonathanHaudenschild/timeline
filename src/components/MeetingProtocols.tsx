'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { CalendarPlus, CalendarSearch, Download, Eye, EyeOff, ListPlus, ListTodo, MessageCircle, Pause, Pencil, Play, Plus, Repeat2, Save, Square, Trash2, X } from 'lucide-react';
import { useAppDialog } from './AppDialog';
import { DuplicateHints } from './DuplicateHints';
import { FilterBadge } from './FilterBadge';
import { SearchInput, SelectField, TextField } from './FormControls';
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
  seedRecurringProtocolItems,
  toggleRecurringProtocolItem,
  type ProtocolItemKind,
} from '@/lib/meetingProtocols';
import type { MeetingProtocol, MeetingProtocolItem, TimelineComment } from '@/lib/types';
import type { DuplicateCandidate } from '@/lib/duplicateHints';
import { usePersistentState } from '@/lib/usePersistentState';

type MeetingProtocolsProps = {
  projectHash: string;
  canEdit: boolean;
  canUseProtocol?: boolean;
  protocols: MeetingProtocol[];
  instructionTemplate: string;
  requestedProtocolId?: string;
  requestedProtocolItemId?: string;
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
  todoLinkOptions?: Array<{ id: string; label: string }>;
  eventLinkOptions?: Array<{ id: string; label: string }>;
  duplicateCandidates?: DuplicateCandidate[];
  onLinkProtocolItemTodo?: (link: {
    protocols: MeetingProtocol[];
    protocolId: string;
    protocolItemId: string;
    protocolItemKind: ProtocolItemKind;
    previousTodoId?: string;
    todoId?: string;
  }) => void;
  onCreateEvent: (source: {
    title: string;
    body: string;
    date: string;
    time?: string;
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
  'grid max-h-[2480px] gap-2 overflow-auto max-sm:max-h-[42dvh] max-[420px]:max-h-[38dvh]';
const protocolListToggleClass =
  'segmented inline-grid [grid-template-columns:1fr_1fr] min-h-[var(--icon-button-size)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[2px] overflow-hidden bg-[var(--input-bg)] shadow-none';
const protocolListFilterClass =
  'sticky top-0 grid gap-1.5 bg-[var(--panel)] pb-1';
const protocolDetailClass = 'grid min-w-0 gap-2.5';
const protocolMetaToolbarClass =
  `${uiCard} grid min-w-0 gap-2 overflow-visible p-[7px] max-sm:w-full max-sm:p-1.5 max-[420px]:mx-[-2px] max-[420px]:gap-1 max-[420px]:rounded-none max-[420px]:border-x-0 max-[420px]:px-1`;
const protocolMetaGridClass =
  'grid min-w-0 grid-cols-[minmax(220px,1.25fr)_minmax(138px,0.58fr)_minmax(104px,0.46fr)_repeat(3,minmax(128px,0.78fr))] items-center gap-1.5 max-xl:grid-cols-[minmax(220px,1.25fr)_minmax(132px,0.6fr)_minmax(104px,0.48fr)_repeat(2,minmax(128px,0.8fr))] max-lg:grid-cols-2 max-sm:w-full max-sm:grid-cols-1 max-[420px]:gap-1';
const protocolActionsClass =
  'flex min-w-0 flex-wrap items-center justify-end gap-1.5 overflow-visible border-b border-[color-mix(in_srgb,var(--line)_12%,transparent)] pb-1.5 max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:border-b-0 max-sm:pb-0 max-sm:[scrollbar-gutter:stable]';
const protocolTimerClass =
  'mr-auto flex w-auto max-w-[148px] min-w-0 flex-none items-center gap-1 max-sm:mr-0 max-sm:w-auto max-sm:max-w-none';
const protocolTimerReadoutClass =
  'w-[62px] min-w-0 max-w-[62px] overflow-hidden truncate rounded-[2px] border border-[color-mix(in_srgb,var(--line)_28%,transparent)] bg-[var(--hot)] px-1.5 py-[9px] text-center font-mono text-[13px] leading-none font-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] max-sm:flex-none max-sm:text-center';
const protocolSectionsClass =
  'grid min-w-0 max-w-full gap-3.5 overflow-x-clip overflow-y-visible';
const protocolStructuredSectionBaseClass =
  `${uiCard} relative z-0 grid min-w-0 max-w-full gap-2.5 overflow-x-clip overflow-y-visible bg-[var(--card-bg)] p-[9px] shadow-none hover:z-20 focus-within:z-20`;
const protocolSectionTitleClass =
  `${uiCard} relative z-[1] flex items-center justify-between gap-2 p-[7px_8px]`;
const protocolSectionTitleActionsClass =
  'flex flex-wrap items-center justify-end gap-1.5';
const protocolAddInlineClass =
  'ml-1 inline-flex min-h-[var(--icon-button-size)] w-[calc(100%-4px)] items-center justify-center rounded-[2px] border border-dashed border-[color-mix(in_srgb,var(--line)_34%,transparent)] bg-[var(--input-bg)] px-2 text-[11px] font-black text-[var(--muted)] uppercase shadow-none hover:border-[var(--hot)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)]';

// protocol-list-item: grid gap-1 min-h-0 justify-items-start border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[2px] bg-[var(--input-bg)] shadow-none p-[9px] text-left normal-case
const protocolListItemClass =
  'grid gap-1 min-h-0 justify-items-start border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[2px] bg-[var(--input-bg)] shadow-none p-[9px] text-left normal-case';
const protocolListItemActiveClass =
  'grid gap-1 min-h-0 justify-items-start border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[2px] bg-[var(--primary)] text-[var(--on-primary)] shadow-none p-[9px] text-left normal-case';

// protocol-list-heading: flex w-full items-baseline justify-between gap-2 border-b border-[color-mix(in_srgb,var(--line)_12%,transparent)] pb-[3px]
const protocolListHeadingClass =
  'flex w-full items-baseline justify-between gap-2 border-b border-[color-mix(in_srgb,var(--line)_12%,transparent)] pb-[3px]';

// .protocol-list-item b: text-[13px] font-[950] normal-case
// .protocol-list-item span/small: text-[var(--muted)] text-[11px] font-[900] uppercase [overflow-wrap:anywhere]
// protocol-list-date: inline-flex min-h-[22px] flex-none items-center border border-[color-mix(in_srgb,var(--line)_28%,transparent)] rounded-[2px] bg-[var(--card-bg)] text-[var(--text)]! px-[6px] font-mono text-[10px]! font-[950]! tracking-[0] text-right
// (note: ::before pseudo-element can't be inlined, keep class)
const protocolListDateClass =
  'protocol-list-date inline-flex min-h-[22px] flex-none items-center border border-[color-mix(in_srgb,var(--line)_28%,transparent)] rounded-[2px] bg-[var(--card-bg)] text-[var(--text)]! px-[6px] font-mono text-[10px]! font-[950]! tracking-[0] text-right';

// protocol-list-duration: !text-[var(--text)] font-mono !text-[11px]
const protocolListDurationClass =
  'font-mono !text-[11px]';

// protocol-empty: border border-dashed border-[var(--muted-border)] rounded-[2px] text-[var(--muted)] grid min-h-[58px] place-items-center p-[10px] text-[12px] font-[950] uppercase
const protocolEmptyClass =
  'border border-dashed border-[var(--muted-border)] rounded-[2px] text-[var(--muted)] grid min-h-[58px] place-items-center p-[10px] text-[12px] [font-weight:950] uppercase';

// protocol-empty-detail: min-h-[240px]
const protocolEmptyDetailClass = 'min-h-[240px]';

// protocol-instruction: min-w-0 max-w-full border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] bg-[var(--input-bg)] shadow-none overflow-hidden max-sm:w-full
const protocolInstructionClass =
  'min-w-0 max-w-full border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] bg-[var(--input-bg)] shadow-none overflow-hidden max-sm:w-full';

// protocol-entry-summary: grid grid-cols-[minmax(0,1fr)_auto] gap-[6px] items-start min-w-0 max-w-full
const protocolEntrySummaryClass =
  'grid grid-cols-[minmax(0,1fr)_auto] gap-[6px] items-start min-w-0 max-w-full';

// protocol-entry-preview: min-w-0 max-h-[72px] overflow-auto bg-transparent pt-[2px] max-sm:[&_.markdown]:max-h-[96px] max-sm:[&_.markdown]:overflow-hidden
const protocolEntryPreviewClass =
  'min-w-0 max-h-[72px] overflow-auto bg-transparent pt-[2px]';

// protocol-converted-label (inside protocol-entry-summary span): same as span styles but with primary bg
// The base span styles from .protocol-entry-summary span: inline-block border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--meta-bg)] text-[var(--muted)] px-[5px] py-[1px] text-[9px] font-[900] uppercase
// protocol-converted-label override: border-[color-mix(in_srgb,var(--line)_34%,transparent)] bg-[var(--primary)] text-[var(--on-primary)]
const protocolConvertedLabelClass =
  'inline-block border border-[color-mix(in_srgb,var(--line)_34%,transparent)] rounded-[0px] bg-[var(--primary)] text-[var(--on-primary)] px-[5px] py-[1px] text-[9px] [font-weight:900] uppercase';

// protocol-updated-meta: min-w-0 text-[var(--muted)] text-[8px] font-[700] whitespace-nowrap max-sm:justify-self-start max-sm:px-[2px] max-sm:text-[9px]
const protocolUpdatedMetaClass =
  'min-w-0 text-[var(--muted)] text-[8px] font-[700] whitespace-nowrap max-sm:justify-self-start max-sm:px-[2px] max-sm:text-[9px]';

// protocol-entry-action-buttons: flex items-center justify-end gap-1 flex-none ml-auto max-sm:grid max-sm:grid-cols-[repeat(5,minmax(30px,1fr))] max-sm:gap-px max-sm:w-full max-sm:ml-0
const protocolEntryActionButtonsClass =
  'flex items-center justify-end gap-1 flex-none ml-auto max-sm:grid max-sm:grid-cols-[repeat(5,minmax(30px,1fr))] max-sm:gap-px max-sm:w-full max-sm:ml-0';

// protocol-entry-actions: flex justify-between gap-[6px] items-center flex-nowrap min-w-0 mt-[2px] mx-[-1px] mb-[-1px] pt-[5px]
// max-sm: grid grid-cols-1 gap-[5px] border-t-0 mt-1 mx-[-7px] mb-[-7px] ml-[-11px] p-[6px] bg-[color-mix(in_srgb,var(--panel)_78%,transparent)]
const protocolEntryActionsClass =
  'flex justify-between gap-[6px] items-center flex-nowrap min-w-0 mt-[2px] mx-[-1px] mb-[-1px] pt-[5px] max-sm:grid max-sm:grid-cols-1 max-sm:gap-[5px] max-sm:border-t-0 max-sm:mt-1 max-sm:mx-[-7px] max-sm:mb-[-7px] max-sm:ml-[-11px] max-sm:p-[6px] max-sm:bg-[color-mix(in_srgb,var(--panel)_78%,transparent)]';

// card-comments: grid gap-[5px] mt-2
const cardCommentsClass = 'grid gap-[5px] mt-2';

// card-comment: grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[6px] items-center border border-[color-mix(in_srgb,var(--line)_16%,transparent)] rounded-[2px] bg-[var(--input-bg)] p-[5px_6px] text-[11px] leading-[1.35]
// max-sm: grid-cols-[minmax(0,1fr)_auto] gap-[2px] text-[10px]
const cardCommentClass =
  'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[6px] items-center border border-[color-mix(in_srgb,var(--line)_16%,transparent)] rounded-[2px] bg-[var(--input-bg)] p-[5px_6px] text-[11px] leading-[1.35] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-[2px] max-sm:text-[10px]';

// card-comment-delete: w-4 min-w-4 h-4 min-h-4 border-0 bg-transparent shadow-none p-0
const cardCommentDeleteClass =
  'w-4 min-w-4 h-4 min-h-4 border-0 bg-transparent shadow-none p-0';

// panel-title: text-[18px] font-[950] mb-[10px] uppercase
const panelTitleClass = 'text-[18px] [font-weight:950] mb-[10px] uppercase';

// action-row: flex gap-2 items-center flex-wrap mt-[10px]
const actionRowClass = 'flex gap-2 items-center flex-wrap mt-[10px]';

export function MeetingProtocols({
  projectHash,
  canEdit,
  canUseProtocol = canEdit,
  protocols,
  instructionTemplate,
  requestedProtocolId,
  requestedProtocolItemId,
  onProtocolSelect,
  onCopyLink,
  linkCopied,
  moveControls,
  onChange,
  onInstructionTemplateChange,
  onCreateTodo,
  onOpenTodo,
  onOpenEvent,
  todoLinkOptions = [],
  eventLinkOptions = [],
  duplicateCandidates = [],
  onLinkProtocolItemTodo,
  onCreateEvent,
}: MeetingProtocolsProps) {
  const appDialog = useAppDialog();
  const [isMinimized, setIsMinimized] = usePersistentState(`timeline:ui:meeting-protocols-minimized:${projectHash}`, false);
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
  const [linkingItem, setLinkingItem] = useState<{
    kind: ProtocolItemKind;
    item: MeetingProtocolItem;
    target: 'todo' | 'event';
  } | null>(null);
  const [draggedProtocolItem, setDraggedProtocolItem] = useState<DraggedProtocolItem | null>(null);
  const [dropTargetKind, setDropTargetKind] = useState<ProtocolItemKind | null>(null);
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [timerTick, setTimerTick] = useState(0);
  const entryScrollTimeoutRef = useRef<number | undefined>(undefined);
  const consumedRequestedProtocolRef = useRef('');
  const sortedProtocols = useMemo(() => sortProtocolsByDateTime(protocols), [protocols]);
  const selectedProtocol = protocols.find((protocol) => protocol.id === selectedProtocolId) ?? sortedProtocols[0];
  const selectedProtocolDuration = selectedProtocol ? currentProtocolDuration(selectedProtocol, timerTick) : 0;
  const isTimerRunning = Boolean(selectedProtocol?.timerStartedAt);
  const timerStartLabel = selectedProtocolDuration > 0 ? 'Resume' : 'Start';
  const searchTimerTick = search.trim() ? timerTick : 0;
  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedProtocols;

    return sortedProtocols.filter((protocol) => protocolMatchesQuery(protocol, query, searchTimerTick));
  }, [sortedProtocols, search, searchTimerTick]);
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
    const requestedProtocol = protocols.find((protocol) => protocol.id === requestedProtocolId);
    if (!requestedProtocol) return;
    const requestKey = `${projectHash}:${requestedProtocolId}:${requestedProtocolItemId ?? ''}`;
    if (consumedRequestedProtocolRef.current === requestKey) return;
    consumedRequestedProtocolRef.current = requestKey;

    const timeout = window.setTimeout(() => {
      const focusedSection = requestedProtocolItemId
        ? (['updates', 'topics', 'todos'] as const).find((kind) =>
          requestedProtocol[kind].some((item) => item.id === requestedProtocolItemId),
        )
        : undefined;
      setSelectedProtocolId(requestedProtocolId);
      setSelectedOverviewItemId('');
      setShowProtocolEntries(false);
      setIsMinimized(false);
      if (focusedSection) {
        setCollapsedProtocolSections((sections) => ({ ...sections, [focusedSection]: false }));
      }
      if (requestedProtocolItemId) {
        window.setTimeout(() => {
          document
            .getElementById(`protocol-${requestedProtocolId}-${focusedSection}-${requestedProtocolItemId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }, 80);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [projectHash, protocols, requestedProtocolId, requestedProtocolItemId, setCollapsedProtocolSections, setIsMinimized, setShowProtocolEntries]);

  function addProtocol() {
    if (!canUseProtocol) return;

    const protocol = seedRecurringProtocolItems(createMeetingProtocol(), protocols);
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
    if (!canUseProtocol) return;
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

  function updateTime(time: string) {
    if (!selectedProtocol) return;

    updateProtocol({
      time,
      title: isGeneratedProtocolTitle(selectedProtocol)
        ? protocolTitle(selectedProtocol.date, time)
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
    if (!canUseProtocol) return;
    if (!selectedProtocol) return;

    setEditingItem({
      kind,
      item: createProtocolItem(kind, selectedProtocol[kind].length + 1),
      isNew: true,
    });
  }

  function editItem(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!canUseProtocol) return;
    setEditingItem({ kind, item, isNew: false });
  }

  function saveEditingItem(itemToSave = editingItem?.item) {
    if (!selectedProtocol || !editingItem) return;
    if (!itemToSave) return;

    const now = new Date().toISOString();
    const nextItem = {
      ...itemToSave,
      updatedAt: now,
    };
    const nextItems = editingItem.isNew
      ? [...selectedProtocol[editingItem.kind], nextItem]
      : selectedProtocol[editingItem.kind].map((item) => (item.id === nextItem.id ? nextItem : item));
    const nextProtocols = protocols.map((protocol) =>
      protocol.id === selectedProtocol.id
        ? {
          ...selectedProtocol,
          [editingItem.kind]: nextItems,
          updatedAt: now,
        }
        : protocol,
    );

    if (onLinkProtocolItemTodo && editingItem.item.convertedTodoId !== nextItem.convertedTodoId) {
      onLinkProtocolItemTodo({
        protocols: nextProtocols,
        protocolId: selectedProtocol.id,
        protocolItemId: nextItem.id,
        protocolItemKind: editingItem.kind,
        previousTodoId: editingItem.item.convertedTodoId,
        todoId: nextItem.convertedTodoId,
      });
    } else {
      onChange(nextProtocols);
    }
    setEditingItem(null);
  }

  function saveProtocolItemLink(itemToSave: MeetingProtocolItem) {
    if (!selectedProtocol || !linkingItem) return;
    const now = new Date().toISOString();
    const nextItem = { ...itemToSave, updatedAt: now };
    const nextProtocols = protocols.map((protocol) =>
      protocol.id === selectedProtocol.id
        ? {
          ...selectedProtocol,
          [linkingItem.kind]: selectedProtocol[linkingItem.kind].map((item) =>
            item.id === nextItem.id ? nextItem : item,
          ),
          updatedAt: now,
        }
        : protocol,
    );

    if (linkingItem.target === 'todo' && onLinkProtocolItemTodo && linkingItem.item.convertedTodoId !== nextItem.convertedTodoId) {
      onLinkProtocolItemTodo({
        protocols: nextProtocols,
        protocolId: selectedProtocol.id,
        protocolItemId: nextItem.id,
        protocolItemKind: linkingItem.kind,
        previousTodoId: linkingItem.item.convertedTodoId,
        todoId: nextItem.convertedTodoId,
      });
    } else {
      onChange(nextProtocols);
    }
    setLinkingItem(null);
  }

  async function deleteItem(kind: ProtocolItemKind, itemId: string) {
    if (!canUseProtocol) return;
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
    if (!canUseProtocol) return;
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

  async function deleteItemComment(kind: ProtocolItemKind, item: MeetingProtocolItem, comment: TimelineComment) {
    if (!canUseProtocol) return;
    if (!selectedProtocol) return;
    if (
      !(await appDialog.confirm({
        title: 'Delete comment?',
        message: 'Delete this comment?',
        confirmLabel: 'Delete comment',
        tone: 'danger',
        cancelIcon: <X size={18} aria-hidden="true" />,
        confirmIcon: <Trash2 size={18} aria-hidden="true" />,
      }))
    ) {
      return;
    }

    const now = new Date().toISOString();
    const nextItem = {
      ...item,
      comments: item.comments?.filter((entry) => entry.id !== comment.id),
      updatedAt: now,
    };

    updateProtocol({
      [kind]: selectedProtocol[kind].map((entry) => (entry.id === item.id ? nextItem : entry)),
    });
  }

  function toggleItemRecurring(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!canUseProtocol) return;
    if (!selectedProtocol) return;

    onChange(toggleRecurringProtocolItem(protocols, selectedProtocol.id, kind, item.id));
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

  function allowProtocolDrop(event: DragEvent, kind: ProtocolItemKind, targetItemId?: string) {
    if (!draggedProtocolItem) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetKind(kind);
    setDropTargetItemId(targetItemId ?? null);
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
    setDropTargetItemId(null);
    if (movedProtocol === selectedProtocol) return;

    onChange(protocols.map((protocol) => (protocol.id === selectedProtocol.id ? movedProtocol : protocol)));
  }

  function createEventFromProtocol() {
    if (!selectedProtocol) return;

    onCreateEvent({
      title: selectedProtocol.title,
      body: protocolConversionBody(withCurrentDuration(selectedProtocol, timerTick)),
      date: selectedProtocol.date,
      time: selectedProtocol.time,
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
      time: selectedProtocol.time,
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
                      className={cn(
                        'grid gap-1 min-h-0 justify-items-start border rounded-[2px] bg-[var(--input-bg)] shadow-none p-2 text-left normal-case hover:bg-[var(--primary)] hover:text-[var(--on-primary)] hover:shadow-none',
                        item.kind === 'updates' && 'border-l-[5px] border-l-[var(--cyan)] border-[color-mix(in_srgb,var(--line)_20%,transparent)]',
                        item.kind === 'topics' && 'border-l-[5px] border-l-[var(--hot)] border-[color-mix(in_srgb,var(--line)_20%,transparent)]',
                        item.kind === 'todos' && 'border-l-[5px] border-l-[var(--primary-strong)] border-[color-mix(in_srgb,var(--line)_20%,transparent)]',
                        item.kind !== 'updates' && item.kind !== 'topics' && item.kind !== 'todos' && 'border-[color-mix(in_srgb,var(--line)_20%,transparent)]',
                        item.id === selectedOverviewItemId
                          ? 'border-[var(--line)] bg-[var(--date-bg)]'
                          : '',
                      )}
                      key={item.id}
                      onClick={() => selectOverviewItem(item)}
                    >
                      <b className="text-[13px] [font-weight:950] normal-case [overflow-wrap:anywhere] max-w-full">{item.title}</b>
                      <span className="text-[var(--muted)] text-[11px] [font-weight:900] uppercase [overflow-wrap:anywhere] max-w-full">{item.meta}</span>
                      <div className="overflow-hidden text-inherit text-[11px] font-extrabold leading-[1.25] normal-case max-w-full [overflow-wrap:anywhere] [&_.markdown]:[-webkit-box-orient:vertical] [&_.markdown]:[-webkit-line-clamp:3] [&_.markdown]:[display:-webkit-box] [&_.markdown]:max-h-[4.1em] [&_.markdown]:overflow-hidden [&_.markdown]:text-inherit [&_.markdown]:leading-inherit">
                        <MarkdownBlock markdown={item.body || '_No details_'} />
                      </div>
                    </button>
                  ))
                ) : protocols.length ? (
                  <div className={protocolEmptyClass}>No entries</div>
                ) : (
                  <ProtocolEmptyAdd onAdd={addProtocol} disabled={!canUseProtocol} compact />
                )}
              </>
            ) : filteredProtocols.length ? (
              filteredProtocols.map((protocol) => (
                <button
                  type="button"
                  className={protocol.id === selectedProtocol?.id ? protocolListItemActiveClass : protocolListItemClass}
                  key={protocol.id}
                  onClick={() => {
                    setSelectedProtocolId(protocol.id);
                    setSelectedOverviewItemId('');
                    onProtocolSelect(protocol.id);
                  }}
                >
                  <span className={protocolListHeadingClass}>
                    <b className="text-[13px] [font-weight:950] normal-case [overflow-wrap:anywhere] max-w-full">{protocol.title}</b>
                    <span className={protocolListDateClass}>{formatProtocolDateTime(protocol)}</span>
                  </span>
                  <span className={protocolListDurationClass}>{formatProtocolDuration(currentProtocolDuration(protocol, timerTick))}</span>
                  <small className="text-[var(--muted)] text-[11px] [font-weight:900] uppercase [overflow-wrap:anywhere] max-w-full">{protocol.updates.length} updates · {protocol.topics.length} topics · {protocol.todos.length} to-dos</small>
                </button>
              ))
            ) : (
              <ProtocolEmptyAdd onAdd={addProtocol} disabled={!canUseProtocol} compact />
            )}
          </aside>
          {selectedProtocol ? (
            <div className={protocolDetailClass}>
              <div className={protocolMetaToolbarClass}>
                <div className={protocolActionsClass}>
                  <div className={protocolTimerClass} aria-label="Protocol duration">
                    <strong className={protocolTimerReadoutClass}>{formatProtocolDuration(selectedProtocolDuration)}</strong>
                    {isTimerRunning ? (
                      <>
                        <button type="button" className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] min-h-[var(--icon-button-size)] p-0" onClick={pauseTimer} aria-label="Pause timer" title="Pause">
                          <Pause size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] min-h-[var(--icon-button-size)] p-0" onClick={stopTimer} aria-label="Stop timer" title="Stop">
                          <Square size={16} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <button type="button" className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] min-h-[var(--icon-button-size)] p-0" onClick={startTimer} aria-label={`${timerStartLabel} timer`} title={timerStartLabel}>
                        <Play size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-button w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
                    onClick={addProtocol}
                    disabled={!canUseProtocol}
                    aria-label="Add protocol"
                    title="Add protocol"
                  >
                    <Plus size={17} aria-hidden="true" />
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
                      onClick={() => setIsEditingInstruction((editing) => !editing)}
                      aria-label={isEditingInstruction ? 'Preview instruction' : 'Edit instruction'}
                      title={isEditingInstruction ? 'Preview instruction' : 'Edit instruction'}
                    >
                      {isEditingInstruction ? <Eye size={17} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
                    onClick={createEventFromProtocol}
                    aria-label="Create event from protocol"
                    title="Event from protocol"
                  >
                    <CalendarPlus size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button secondary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
                    onClick={exportProtocolPdf}
                    aria-label="Export protocol as PDF"
                    title="Export PDF"
                  >
                    <Download size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
                    onClick={() => void deleteProtocol()}
                    aria-label="Delete protocol"
                    title="Delete protocol"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
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
                    label="Time"
                    type="time"
                    value={selectedProtocol.time}
                    onValueChange={updateTime}
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
                    label="Protocol"
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
              </div>
              <details className={protocolInstructionClass} open>
                <summary className="cursor-pointer border-b border-[var(--soft-line)] bg-[var(--primary)] text-[var(--on-primary)] px-[10px] py-[7px] text-[12px] [font-weight:950] uppercase max-sm:[overflow-wrap:anywhere]">Instruction</summary>
                {canEdit && isEditingInstruction ? (
                  <MarkdownEditor
                    className="min-h-[260px] max-h-[520px] overflow-auto font-mono text-[12px] leading-[1.45] whitespace-pre-wrap disabled:bg-[var(--alt-bg)] disabled:text-[var(--muted)] disabled:opacity-100 max-sm:min-h-[min(54dvh,420px)] max-sm:max-h-[min(54dvh,420px)]"
                    value={instructionTemplate}
                    onChange={onInstructionTemplateChange}
                    rows={13}
                  />
                ) : (
                  <pre className="max-w-full max-h-[260px] m-0 overflow-auto p-[10px] whitespace-pre-wrap [overflow-wrap:anywhere] break-words font-mono text-[12px] leading-[1.45] max-sm:max-h-[min(46dvh,320px)] max-sm:overflow-x-hidden max-sm:p-[9px] max-sm:text-[11px]">{createMeetingProtocolInstruction(selectedProtocol.date, selectedProtocolDuration, instructionTemplate)}</pre>
                )}
              </details>
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
                    onDeleteComment={(item, comment) => void deleteItemComment(section.kind, item, comment)}
                    onToggleRecurring={(item) => toggleItemRecurring(section.kind, item)}
                    draggedItem={draggedProtocolItem}
                    isDropTarget={dropTargetKind === section.kind}
                    dropTargetItemId={dropTargetKind === section.kind ? dropTargetItemId : null}
                    onDragStart={(itemId) => startDraggingProtocolItem(section.kind, itemId)}
                    onDragOver={(event, targetItemId) => allowProtocolDrop(event, section.kind, targetItemId)}
                    onDragEnd={() => {
                      setDraggedProtocolItem(null);
                      setDropTargetKind(null);
                      setDropTargetItemId(null);
                    }}
                    onDrop={(targetItemId) => dropProtocolItem(section.kind, targetItemId)}
                    onCreateTodo={(item) => createTodoFromItem(section.kind, item)}
                    onLinkTodo={(item) => setLinkingItem({ kind: section.kind, item, target: 'todo' })}
                    onOpenTodo={onOpenTodo}
                    onOpenEvent={onOpenEvent}
                    onCreateEvent={(item) => createEventFromItem(section.kind, item)}
                    onLinkEvent={(item) => setLinkingItem({ kind: section.kind, item, target: 'event' })}
                    canUseProtocol={canUseProtocol}
                  />
                ))}
                <section
                  className={cn(
                    protocolStructuredSectionBaseClass,
                    'border-[var(--bar-default)]',
                  )}
                  id={`protocol-${selectedProtocol.id}-notes`}
                >
                  <div className={protocolSectionTitleClass}>
                    <h3 className="m-0 text-sm font-black uppercase">Notes</h3>
                  </div>
                  <MarkdownEditor
                    className="min-h-[220px] max-h-[520px] overflow-auto font-mono text-[12px] leading-[1.45] whitespace-pre-wrap disabled:bg-[var(--alt-bg)] disabled:text-[var(--muted)] disabled:opacity-100 max-sm:min-h-[min(54dvh,420px)] max-sm:max-h-[min(54dvh,420px)]"
                    value={selectedProtocol.body}
                    onChange={(body) => updateProtocol({ body })}
                    placeholder="Optional markdown notes that do not fit into updates, topics, or to-dos."
                    rows={8}
                  />
                </section>
              </div>
            </div>
          ) : (
            <ProtocolEmptyAdd onAdd={addProtocol} disabled={!canUseProtocol} />
          )}
        </div>
      {editingItem ? (
        <ProtocolItemEditorDialog
          editingItem={editingItem}
          protocolId={selectedProtocol?.id ?? ''}
          todoLinkOptions={todoLinkOptions}
          eventLinkOptions={eventLinkOptions}
          duplicateCandidates={duplicateCandidates}
          onCancel={() => setEditingItem(null)}
          onDelete={() => void deleteEditingItem()}
          onSave={(item) => saveEditingItem(item)}
        />
      ) : null}
      {linkingItem ? (
        <ProtocolItemLinkDialog
          linkingItem={linkingItem}
          todoLinkOptions={todoLinkOptions}
          eventLinkOptions={eventLinkOptions}
          onCancel={() => setLinkingItem(null)}
          onSave={saveProtocolItemLink}
        />
      ) : null}
      {appDialog.dialog}
    </SectionShell>
  );
}

function ProtocolEmptyAdd({
  onAdd,
  disabled,
  compact = false,
}: {
  onAdd: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        protocolEmptyClass,
        'flex items-center justify-center text-center',
        compact ? 'min-h-[72px]' : protocolEmptyDetailClass,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-1.5">
        <span className="text-[11px] font-black uppercase text-[var(--muted)]">
          No protocols
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={onAdd}
          disabled={disabled}
          aria-label="Add first protocol"
          title="Add protocol"
        >
          <Plus size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ProtocolItemEditorDialog({
  editingItem,
  protocolId,
  onCancel,
  onDelete,
  onSave,
  todoLinkOptions,
  eventLinkOptions,
  duplicateCandidates,
}: {
  editingItem: {
    kind: ProtocolItemKind;
    item: MeetingProtocolItem;
    isNew: boolean;
  };
  protocolId: string;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (item: MeetingProtocolItem) => void;
  todoLinkOptions: Array<{ id: string; label: string }>;
  eventLinkOptions: Array<{ id: string; label: string }>;
  duplicateCandidates: DuplicateCandidate[];
}) {
  const [localItem, setLocalItem] = useState(editingItem.item);
  const label = protocolItemLabel(editingItem.kind);
  const lowerLabel = label.toLowerCase();

  function updateItem(patch: Partial<MeetingProtocolItem>) {
    setLocalItem((currentItem) => ({ ...currentItem, ...patch }));
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-[18px] bg-[rgba(18,24,22,0.42)]" role="dialog" aria-modal="true" aria-label={`Edit ${label}`}>
      <form
        className="bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[14px] w-[min(720px,100%)] max-h-[calc(100vh-36px)] overflow-auto shadow-[0_20px_60px_color-mix(in_srgb,var(--line)_20%,transparent)] grid gap-3 protocol-item-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(localItem);
        }}
      >
        <div className={panelTitleClass}>{label}</div>
        <div className="grid [grid-template-columns:repeat(2,minmax(0,1fr))] gap-[10px] mb-[10px] max-sm:grid-cols-1">
          <TextField
            label="Title"
            value={localItem.title}
            onValueChange={(title) => updateItem({ title })}
            required
            autoFocus
          />
          <TextField
            label="Name"
            value={localItem.owner}
            onValueChange={(owner) => updateItem({ owner })}
          />
          <div className="col-span-full">
            <DuplicateHints
              draftId={`protocol:${protocolId}:${editingItem.kind}:${localItem.id}`}
              title={localItem.title}
              body={localItem.body}
              candidates={duplicateCandidates}
            />
          </div>
          {todoLinkOptions.length ? (
            <SelectField
              label="Linked todo"
              value={localItem.convertedTodoId ?? ''}
              onValueChange={(convertedTodoId) => updateItem({ convertedTodoId: convertedTodoId || undefined })}
              className="max-w-none"
            >
              <option value="">No linked todo</option>
              {todoLinkOptions.map((todo) => (
                <option key={todo.id} value={todo.id}>
                  {todo.label}
                </option>
              ))}
            </SelectField>
          ) : null}
          {eventLinkOptions.length ? (
            <SelectField
              label="Linked event"
              value={localItem.convertedEventId ?? ''}
              onValueChange={(convertedEventId) => updateItem({ convertedEventId: convertedEventId || undefined })}
              className="max-w-none"
            >
              <option value="">No linked event</option>
              {eventLinkOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
        <label>
          <span>Markdown details</span>
          <MarkdownEditor
            value={localItem.body}
            onChange={(body) => updateItem({ body })}
            rows={8}
          />
        </label>
        <div className={actionRowClass}>
          <button
            type="submit"
            className="icon-button w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            aria-label={`Save ${lowerLabel}`}
            title={`Save ${lowerLabel}`}
          >
            <Save size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button tertiary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            onClick={onCancel}
            aria-label="Cancel"
            title="Cancel"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button danger w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            onClick={onDelete}
            aria-label={`Delete ${lowerLabel}`}
            title={`Delete ${lowerLabel}`}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

function ProtocolItemLinkDialog({
  linkingItem,
  todoLinkOptions,
  eventLinkOptions,
  onCancel,
  onSave,
}: {
  linkingItem: {
    kind: ProtocolItemKind;
    item: MeetingProtocolItem;
    target: 'todo' | 'event';
  };
  todoLinkOptions: Array<{ id: string; label: string }>;
  eventLinkOptions: Array<{ id: string; label: string }>;
  onCancel: () => void;
  onSave: (item: MeetingProtocolItem) => void;
}) {
  const [localItem, setLocalItem] = useState(linkingItem.item);
  const isTodoLink = linkingItem.target === 'todo';
  const options = isTodoLink ? todoLinkOptions : eventLinkOptions;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-[18px] bg-[rgba(18,24,22,0.42)]" role="dialog" aria-modal="true" aria-label={isTodoLink ? 'Link todo' : 'Link event'}>
      <form
        className="bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[14px] w-[min(720px,100%)] max-h-[calc(100vh-36px)] overflow-auto shadow-[0_20px_60px_color-mix(in_srgb,var(--line)_20%,transparent)] grid gap-3 protocol-item-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(localItem);
        }}
      >
        <div className={panelTitleClass}>{isTodoLink ? 'Link todo' : 'Link event'}</div>
        <SelectField
          label={isTodoLink ? 'Todo' : 'Event'}
          value={isTodoLink ? localItem.convertedTodoId ?? '' : localItem.convertedEventId ?? ''}
          onValueChange={(id) =>
            setLocalItem((item) =>
              isTodoLink
                ? { ...item, convertedTodoId: id || undefined }
                : { ...item, convertedEventId: id || undefined },
            )
          }
          className="max-w-none"
        >
          <option value="">{isTodoLink ? 'No linked todo' : 'No linked event'}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <div className={actionRowClass}>
          <button
            type="submit"
            className="icon-button w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            aria-label={isTodoLink ? 'Save linked todo' : 'Save linked event'}
            title="Save"
          >
            <Save size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button tertiary w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0"
            onClick={onCancel}
            aria-label="Cancel"
            title="Cancel"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

function ProtocolStructuredSection({
  protocol,
  canUseProtocol,
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
  onDeleteComment,
  onToggleRecurring,
  draggedItem,
  isDropTarget,
  dropTargetItemId,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onCreateTodo,
  onLinkTodo,
  onOpenTodo,
  onOpenEvent,
  onCreateEvent,
  onLinkEvent,
}: {
  protocol: MeetingProtocol;
  canUseProtocol: boolean;
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
  onDeleteComment: (item: MeetingProtocolItem, comment: TimelineComment) => void;
  onToggleRecurring: (item: MeetingProtocolItem) => void;
  draggedItem: DraggedProtocolItem | null;
  isDropTarget: boolean;
  dropTargetItemId: string | null;
  onDragStart: (itemId: string) => void;
  onDragOver: (event: DragEvent, targetItemId?: string) => void;
  onDragEnd: () => void;
  onDrop: (targetItemId?: string) => void;
  onCreateTodo: (item: MeetingProtocolItem) => void;
  onLinkTodo: (item: MeetingProtocolItem) => void;
  onOpenTodo: (todoId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onCreateEvent: (item: MeetingProtocolItem) => void;
  onLinkEvent: (item: MeetingProtocolItem) => void;
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
          'border-[color-mix(in_srgb,var(--cyan)_58%,color-mix(in_srgb,var(--line)_20%,transparent))]',
        kind === 'topics' &&
          'border-[color-mix(in_srgb,var(--hot)_58%,color-mix(in_srgb,var(--line)_20%,transparent))]',
        kind === 'todos' &&
          'border-[color-mix(in_srgb,var(--primary-strong)_58%,color-mix(in_srgb,var(--line)_20%,transparent))]',
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
          kind === 'updates' && '!bg-[var(--time-bg)]',
          kind === 'topics' && '!bg-[var(--protocol-bg)]',
          kind === 'todos' && '!bg-[var(--tag-bg)]',
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
            disabled={!canUseProtocol}
            aria-label={addLabel}
            title={addLabel}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(
              "relative inline-flex h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] items-center justify-center border shadow-none p-0 text-[13px] font-[950] uppercase",
              collapsed
                ? "bg-[var(--card-bg)] text-[var(--muted)]"
                : "bg-[var(--primary)] text-[var(--on-primary)]",
            )}
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
        <div className="grid gap-2 min-w-0 max-w-full pl-0">
          {items.map((item) => (
            <Fragment key={item.id}>
              {dropTargetItemId === item.id && draggedItem?.itemId !== item.id ? (
                <div className="h-[3px] rounded-[2px] bg-[var(--hot)] mx-[2px] mb-[5px] pointer-events-none shrink-0" aria-hidden="true" />
              ) : null}
              <article
                className={`protocol-entry ${kind} ${item.convertedTodoId || item.convertedEventId ? 'converted' : ''} ${draggedItem?.itemId === item.id ? 'dragging' : ''}`}
                draggable={canUseProtocol}
                id={`protocol-${protocol.id}-${kind}-${item.id}`}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', item.id);
                  onDragStart(item.id);
                }}
                onDragOver={(event) => {
                  event.stopPropagation();
                  onDragOver(event, item.id);
                }}
                onDragEnd={onDragEnd}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDrop(item.id);
                }}
                onClick={() => onEdit(item)}
              >
              <div className={protocolEntrySummaryClass}>
                <div className="min-w-0 max-w-full [overflow-wrap:anywhere]">
                  <h4 className="m-0 min-w-0 max-w-full text-[14px] [font-weight:950] leading-[1.15] [overflow-wrap:anywhere] break-words uppercase">{item.title}</h4>
                  {item.owner ? <span className="inline-block border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--meta-bg)] text-[var(--muted)] px-[5px] py-[1px] text-[9px] [font-weight:900] uppercase">{item.owner}</span> : null}
                </div>
                <div className="protocol-entry-controls">
                  {item.convertedTodoId || item.convertedEventId ? (
                    <span className={protocolConvertedLabelClass}>
                      {item.convertedTodoId && item.convertedEventId
                        ? 'Todo + event'
                        : item.convertedTodoId
                          ? 'Todo'
                          : 'Event'}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="icon-button tertiary w-[28px] min-w-[28px] min-h-[26px] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center protocol-edit-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(item);
                    }}
                    disabled={!canUseProtocol}
                    aria-label={`Edit ${item.title}`}
                    title="Edit"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className={protocolEntryPreviewClass}>
                <MarkdownBlock markdown={item.body || '_No details yet._'} />
              </div>
              {item.comments?.length ? (
                <div className={cardCommentsClass} aria-label="Protocol item comments">
                  {item.comments.map((comment) => (
                    <div className={cardCommentClass} key={comment.id}>
                      <time className="text-[var(--muted)] text-[10px] [font-weight:950] leading-[1.35] whitespace-nowrap uppercase max-sm:col-span-full" dateTime={comment.createdAt}>{formatProtocolUpdatedAt(comment.createdAt)}</time>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{comment.body}</span>
                      <button
                        type="button"
                        className={cn(cardCommentDeleteClass, 'icon-button danger')}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteComment(item, comment);
                        }}
                        disabled={!canUseProtocol}
                        aria-label="Delete comment"
                        title="Delete comment"
                      >
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={protocolEntryActionsClass}>
                <time className={protocolUpdatedMetaClass} dateTime={item.updatedAt}>
                  upd {formatProtocolUpdatedAt(item.updatedAt)}
                </time>
                <div className={protocolEntryActionButtonsClass}>
                  {item.convertedTodoId ? (
                    <button
                      type="button"
                      className="icon-button w-[28px] min-w-[28px] min-h-[26px] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center bg-[var(--primary)] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[0_1px_0_var(--soft-line)] text-[var(--on-primary)]"
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
                      className="icon-button w-[28px] min-w-[28px] min-h-[26px] border-transparent shadow-none p-0 text-[9px] text-center bg-transparent text-[var(--text)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateTodo(item);
                      }}
                      disabled={!canUseProtocol}
                      aria-label="Create todo"
                      title="Create todo"
                    >
                      <ListTodo size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button tertiary w-[28px] min-w-[28px] min-h-[26px] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      onLinkTodo(item);
                    }}
                    disabled={!canUseProtocol}
                    aria-label={item.convertedTodoId ? `Change linked todo for ${item.title}` : `Link existing todo to ${item.title}`}
                    title={item.convertedTodoId ? 'Change linked todo' : 'Link todo'}
                  >
                    <ListPlus size={14} aria-hidden="true" />
                  </button>
                  {item.convertedEventId ? (
                    <button
                      type="button"
                      className="icon-button w-[28px] min-w-[28px] min-h-[26px] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center bg-[var(--primary)] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[0_1px_0_var(--soft-line)] text-[var(--on-primary)]"
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
                      className="icon-button w-[28px] min-w-[28px] min-h-[26px] border-transparent shadow-none p-0 text-[9px] text-center bg-transparent text-[var(--text)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateEvent(item);
                      }}
                      disabled={!canUseProtocol}
                      aria-label="Create event"
                      title="Create event"
                    >
                      <CalendarPlus size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button tertiary w-[28px] min-w-[28px] min-h-[26px] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      onLinkEvent(item);
                    }}
                    disabled={!canUseProtocol}
                    aria-label={item.convertedEventId ? `Change linked event for ${item.title}` : `Link existing event to ${item.title}`}
                    title={item.convertedEventId ? 'Change linked event' : 'Link event'}
                  >
                    <CalendarSearch size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button tertiary w-[28px] min-w-[28px] min-h-[26px] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddComment(item);
                    }}
                    disabled={!canUseProtocol}
                    aria-label={`Comment on ${item.title}`}
                    title="Comment"
                  >
                    <MessageCircle size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'icon-button tertiary w-[28px] min-w-[28px] min-h-[26px] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center',
                      item.recurring && 'bg-[var(--primary)] shadow-[0_1px_0_var(--soft-line)] !text-[var(--on-primary)]',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleRecurring(item);
                    }}
                    disabled={!canUseProtocol}
                    aria-pressed={Boolean(item.recurring)}
                    aria-label={item.recurring ? `Stop recurring ${item.title}` : `Repeat ${item.title} in future protocols`}
                    title={item.recurring ? 'Recurring in future protocols' : 'Repeat in future protocols'}
                  >
                    <Repeat2 size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger w-[28px] min-w-[28px] min-h-[26px] border-[color-mix(in_srgb,var(--line)_34%,transparent)] shadow-[var(--shadow-xs)] p-0 text-[9px] text-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(item.id);
                    }}
                    disabled={!canUseProtocol}
                    aria-label={`Delete ${item.title}`}
                    title="Delete"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              </article>
            </Fragment>
          ))}
        </div>
      ) : (
        <div
          className="border border-dashed border-[var(--muted-border)] rounded-[2px] text-[var(--muted)] grid min-h-[58px] place-items-center p-[10px] text-[12px] font-[950] uppercase ml-[4px] bg-[color-mix(in_srgb,var(--input-bg)_45%,transparent)]"
          onDragOver={onDragOver}
          onDrop={(event) => {
            event.preventDefault();
            onDrop();
          }}
        >
          Drop here or add {title.toLowerCase()}
        </div>
      )}
      <button type="button" className={protocolAddInlineClass} onClick={onAdd} disabled={!canUseProtocol}>
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
          protocol.time,
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
    protocol.time,
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
  return `${formatProtocolDateTime(protocol)} - ${formatProtocolDuration(currentProtocolDuration(protocol, now))}`;
}

function formatProtocolDateTime(protocol: MeetingProtocol) {
  return [formatProtocolOverviewDate(protocol.date), protocol.time].filter(Boolean).join(' · ');
}

function sortProtocolsByDateTime(protocols: MeetingProtocol[]) {
  return [...protocols].sort((left, right) =>
    right.date.localeCompare(left.date) ||
    (right.time || '00:00').localeCompare(left.time || '00:00') ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt),
  );
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
