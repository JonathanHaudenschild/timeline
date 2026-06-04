'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownBlock, renderMarkdown } from './MarkdownBlock';
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
  onChange: (protocols: MeetingProtocol[]) => void;
  onInstructionTemplateChange: (template: string) => void;
  onCreateTodo: (source: { title: string; body: string; date: string; who?: string; protocolId?: string }) => void;
  onCreateEvent: (source: { title: string; body: string; date: string }) => void;
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

export function MeetingProtocols({
  projectHash,
  canEdit,
  protocols,
  instructionTemplate,
  onChange,
  onInstructionTemplateChange,
  onCreateTodo,
  onCreateEvent,
}: MeetingProtocolsProps) {
  const [isMinimized, setIsMinimized] = usePersistentState(`timeline:ui:meeting-protocols-minimized:${projectHash}`, false);
  const [showInstruction, setShowInstruction] = usePersistentState(`timeline:ui:meeting-protocols-instruction:${projectHash}`, true);
  const [isEditingInstruction, setIsEditingInstruction] = usePersistentState(`timeline:ui:meeting-protocols-edit-instruction:${projectHash}`, false);
  const [showProtocolEntries, setShowProtocolEntries] = usePersistentState(`timeline:ui:meeting-protocols-left-entries:${projectHash}`, false);
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
  const selectedProtocol = protocols.find((protocol) => protocol.id === selectedProtocolId) ?? protocols[0];
  const selectedProtocolDuration = selectedProtocol ? currentProtocolDuration(selectedProtocol, timerTick) : 0;
  const isTimerRunning = Boolean(selectedProtocol?.timerStartedAt);
  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return protocols;

    return protocols.filter((protocol) => protocolMatchesQuery(protocol, query, timerTick));
  }, [protocols, search, timerTick]);
  const overviewItems = useMemo(
    () => buildProtocolOverviewItems(protocols, search, timerTick),
    [protocols, search, timerTick],
  );

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

  function addProtocol() {
    const protocol = createMeetingProtocol();
    onChange([protocol, ...protocols]);
    setSelectedProtocolId(protocol.id);
    setSelectedOverviewItemId('');
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

  function deleteProtocol() {
    if (!selectedProtocol || !window.confirm(`Delete "${selectedProtocol.title}"?`)) return;
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

  function deleteItem(kind: ProtocolItemKind, itemId: string) {
    if (!selectedProtocol) return;

    if (!window.confirm(`Delete this ${protocolItemLabel(kind).toLowerCase()}?`)) return;

    updateProtocol({
      [kind]: selectedProtocol[kind].filter((item) => item.id !== itemId),
    });
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
      window.alert('Please allow pop-ups to export this protocol as PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(protocolPdfHtml(protocolForExport));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function createTodoFromItem(_kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!selectedProtocol) return;

    onCreateTodo({
      title: item.title,
      body: item.body,
      who: item.owner,
      protocolId: selectedProtocol.id,
      date: selectedProtocol.date,
    });
  }

  function createEventFromItem(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!selectedProtocol) return;

    onCreateEvent({
      title: item.title,
      body: protocolItemConversionBody(selectedProtocol, kind, item),
      date: selectedProtocol.date,
    });
  }

  return (
    <section className="protocol-section">
      <div className="section-heading">
        <h2>Protocols</h2>
        <div className="heading-actions protocol-heading-actions">
          <span>{filteredProtocols.length} / {protocols.length}</span>
          <button type="button" onClick={addProtocol}>
            Add protocol
          </button>
          <button
            type="button"
            className={`event-table-toggle ${isMinimized ? 'collapsed' : 'expanded'}`}
            onClick={() => setIsMinimized((minimized) => !minimized)}
            aria-expanded={!isMinimized}
          >
            {isMinimized ? 'Show protocols' : 'Hide protocols'}
          </button>
        </div>
      </div>
      {isMinimized ? null : (
        <div className="protocol-workspace">
          <aside className="protocol-list" aria-label="Meeting protocols">
            <label className="search-control protocol-search-control">
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Date, person, update, topic, to-do"
              />
            </label>
            <div className="protocol-list-toggle segmented">
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
                  }}
                >
                  <b>{protocol.title}</b>
                  <span>{formatProtocolOverviewMeta(protocol, timerTick)}</span>
                  <small>{protocol.updates.length} updates · {protocol.topics.length} topics · {protocol.todos.length} to-dos</small>
                </button>
              ))
            ) : (
              <div className="protocol-empty">No protocols</div>
            )}
          </aside>
          {selectedProtocol ? (
            <div className="protocol-detail">
              <div className="protocol-meta-grid">
                <label className="protocol-meta-control protocol-title-control">
                  <span>Title</span>
                  <input
                    value={selectedProtocol.title}
                    onChange={(event) => updateProtocol({ title: event.target.value })}
                    placeholder="Tägliches Platz-Plenum"
                  />
                </label>
                <label className="protocol-meta-control protocol-date-control">
                  <span>Date</span>
                  <input
                    type="date"
                    value={selectedProtocol.date}
                    onChange={(event) => updateDate(event.target.value)}
                  />
                </label>
                <label className="protocol-meta-control">
                  <span>Moderation</span>
                  <input
                    value={selectedProtocol.moderation}
                    onChange={(event) => updateProtocol({ moderation: event.target.value })}
                    placeholder="Name"
                    aria-label="Moderation name"
                  />
                </label>
                <label className="protocol-meta-control">
                  <span>Protokoll</span>
                  <input
                    value={selectedProtocol.protocolWriter}
                    onChange={(event) => updateProtocol({ protocolWriter: event.target.value })}
                    placeholder="Name"
                    aria-label="Protocol writer name"
                  />
                </label>
                <label className="protocol-meta-control">
                  <span>Todo-person</span>
                  <input
                    value={selectedProtocol.todoOwner}
                    onChange={(event) => updateProtocol({ todoOwner: event.target.value })}
                    placeholder="Name"
                    aria-label="Todo person name"
                  />
                </label>
              </div>
              <div className="protocol-timer-row" aria-label="Protocol duration">
                <span>Duration</span>
                <div className="protocol-timer-control">
                  <strong>{formatProtocolDuration(selectedProtocolDuration)}</strong>
                  <button type="button" className="mini-button secondary" onClick={startTimer} disabled={isTimerRunning}>
                    Start
                  </button>
                  <button type="button" className="mini-button secondary" onClick={pauseTimer} disabled={!isTimerRunning}>
                    Pause
                  </button>
                  <button type="button" className="mini-button secondary" onClick={stopTimer} disabled={!isTimerRunning}>
                    Stop
                  </button>
                </div>
              </div>
              <div className="protocol-actions">
                <button type="button" className="secondary" onClick={() => setShowInstruction((visible) => !visible)}>
                  {showInstruction ? 'Hide instruction' : 'Show instruction'}
                </button>
                {canEdit ? (
                  <button type="button" className="secondary" onClick={() => setIsEditingInstruction((editing) => !editing)}>
                    {isEditingInstruction ? 'Preview instruction' : 'Edit instruction'}
                  </button>
                ) : null}
                <button type="button" className="secondary" onClick={createEventFromProtocol}>
                  Event from protocol
                </button>
                <button type="button" className="secondary" onClick={exportProtocolPdf}>
                  Export PDF
                </button>
                <button type="button" className="icon-button danger" onClick={deleteProtocol} aria-label="Delete protocol">
                  x
                </button>
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
              <div className="protocol-sections">
                {sectionConfig.map((section) => (
                  <ProtocolStructuredSection
                    key={section.kind}
                    protocol={selectedProtocol}
                    kind={section.kind}
                    title={section.title}
                    addLabel={section.addLabel}
                    search={search}
                    onAdd={() => addItem(section.kind)}
                    onEdit={(item) => editItem(section.kind, item)}
                    onDelete={(itemId) => deleteItem(section.kind, itemId)}
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
                    onCreateEvent={(item) => createEventFromItem(section.kind, item)}
                  />
                ))}
                <section className="protocol-structured-section" id={`protocol-${selectedProtocol.id}-notes`}>
                  <div className="protocol-section-title">
                    <h3>Notes</h3>
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
      )}
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
              <label>
                <span>Headline</span>
                <input
                  value={editingItem.item.title}
                  onChange={(event) => updateEditingItem({ title: event.target.value })}
                  required
                  autoFocus
                />
              </label>
              <label>
                <span>Name</span>
                <input
                  value={editingItem.item.owner}
                  onChange={(event) => updateEditingItem({ owner: event.target.value })}
                />
              </label>
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
              <button type="submit">Save {protocolItemLabel(editingItem.kind).toLowerCase()}</button>
              <button type="button" className="secondary" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function ProtocolStructuredSection({
  protocol,
  kind,
  title,
  addLabel,
  search,
  onAdd,
  onEdit,
  onDelete,
  draggedItem,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onCreateTodo,
  onCreateEvent,
}: {
  protocol: MeetingProtocol;
  kind: ProtocolItemKind;
  title: string;
  addLabel: string;
  search: string;
  onAdd: () => void;
  onEdit: (item: MeetingProtocolItem) => void;
  onDelete: (itemId: string) => void;
  draggedItem: DraggedProtocolItem | null;
  isDropTarget: boolean;
  onDragStart: (itemId: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (targetItemId?: string) => void;
  onCreateTodo: (item: MeetingProtocolItem) => void;
  onCreateEvent: (item: MeetingProtocolItem) => void;
}) {
  const query = search.trim().toLowerCase();
  const items = query
    ? protocol[kind].filter((item) => itemMatchesQuery(item, query))
    : protocol[kind];

  return (
    <section
      className={`protocol-structured-section ${kind} ${isDropTarget ? 'drop-target' : ''}`}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="protocol-section-title">
        <div>
          <h3>{title}</h3>
          <span>{items.length} entries</span>
        </div>
        <button type="button" className="secondary mini-button" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {items.length ? (
        <div className="protocol-entry-list">
          {items.map((item) => (
            <article
              className={`protocol-entry ${kind} ${draggedItem?.itemId === item.id ? 'dragging' : ''}`}
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
            >
              <div className="protocol-entry-summary">
                <div>
                  <h4>{item.title}</h4>
                  <span>{item.owner || 'No name'}</span>
                </div>
                <button type="button" className="mini-button secondary" onClick={() => onEdit(item)}>
                  Edit
                </button>
              </div>
              <div className="protocol-entry-preview">
                <MarkdownBlock markdown={item.body || '_No details yet._'} />
              </div>
              <div className="protocol-entry-actions">
                <button type="button" className="mini-button secondary" onClick={() => onCreateTodo(item)}>
                  Todo
                </button>
                <button type="button" className="mini-button secondary" onClick={() => onCreateEvent(item)}>
                  Event
                </button>
                <button type="button" className="icon-button danger" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.title}`}>
                  x
                </button>
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
      <button type="button" className="protocol-add-inline secondary" onClick={onAdd}>
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
      protocol[section.kind].flatMap((item) => [section.title, item.title, item.owner, item.body]),
    ),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function itemMatchesQuery(item: MeetingProtocolItem, query: string) {
  return [item.title, item.owner, item.body].join(' ').toLowerCase().includes(query);
}

function formatProtocolOverviewMeta(protocol: MeetingProtocol, now: number) {
  return `${formatProtocolOverviewDate(protocol.date)} - ${formatProtocolDuration(currentProtocolDuration(protocol, now))}`;
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

  return `${weekday} - ${month}.${day}.${parsedDate.getFullYear()}`;
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
