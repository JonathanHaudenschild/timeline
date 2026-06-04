'use client';

import { useMemo, useState } from 'react';
import { MarkdownBlock } from './MarkdownBlock';
import {
  createMeetingProtocol,
  createMeetingProtocolInstruction,
  createProtocolItem,
  extractProtocolHeadlines,
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
  protocols: MeetingProtocol[];
  onChange: (protocols: MeetingProtocol[]) => void;
  onCreateTodo: (source: { title: string; body: string; date: string }) => void;
  onCreateEvent: (source: { title: string; body: string; date: string }) => void;
};

type QuickFindItem = {
  id: string;
  title: string;
  meta: string;
  targetId: string;
};

type ProtocolOverviewItem = {
  id: string;
  protocolId: string;
  kind: ProtocolItemKind;
  title: string;
  meta: string;
  body: string;
};

const sectionConfig: Array<{ kind: ProtocolItemKind; title: string; addLabel: string }> = [
  { kind: 'updates', title: 'Updates', addLabel: 'Add update' },
  { kind: 'topics', title: 'Topics', addLabel: 'Add topic' },
  { kind: 'todos', title: 'To-Dos', addLabel: 'Add to-do' },
];

export function MeetingProtocols({
  projectHash,
  protocols,
  onChange,
  onCreateTodo,
  onCreateEvent,
}: MeetingProtocolsProps) {
  const [isMinimized, setIsMinimized] = usePersistentState(`timeline:ui:meeting-protocols-minimized:${projectHash}`, false);
  const [showInstruction, setShowInstruction] = usePersistentState(`timeline:ui:meeting-protocols-instruction:${projectHash}`, true);
  const [isPreviewingNotes, setIsPreviewingNotes] = usePersistentState(`timeline:ui:meeting-protocols-preview:${projectHash}`, false);
  const [showProtocolEntries, setShowProtocolEntries] = usePersistentState(`timeline:ui:meeting-protocols-left-entries:${projectHash}`, false);
  const [selectedProtocolId, setSelectedProtocolId] = useState(protocols[0]?.id ?? '');
  const [editingItem, setEditingItem] = useState<{
    kind: ProtocolItemKind;
    item: MeetingProtocolItem;
    isNew: boolean;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [entrySearch, setEntrySearch] = useState('');
  const selectedProtocol = protocols.find((protocol) => protocol.id === selectedProtocolId) ?? protocols[0];
  const quickFindItems = useMemo(
    () => (selectedProtocol ? buildQuickFindItems(selectedProtocol, search) : []),
    [selectedProtocol, search],
  );
  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return protocols;

    return protocols.filter((protocol) => protocolMatchesQuery(protocol, query));
  }, [protocols, search]);
  const overviewItems = useMemo(
    () => buildProtocolOverviewItems(protocols, [search, entrySearch].filter(Boolean).join(' ')),
    [protocols, search, entrySearch],
  );

  function addProtocol() {
    const protocol = createMeetingProtocol();
    onChange([protocol, ...protocols]);
    setSelectedProtocolId(protocol.id);
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
      title: selectedProtocol.title === protocolTitle(selectedProtocol.date) ? protocolTitle(date) : selectedProtocol.title,
    });
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

  function createTodoFromProtocol() {
    if (!selectedProtocol) return;

    onCreateTodo({
      title: selectedProtocol.title,
      body: protocolConversionBody(selectedProtocol),
      date: selectedProtocol.date,
    });
  }

  function createEventFromProtocol() {
    if (!selectedProtocol) return;

    onCreateEvent({
      title: selectedProtocol.title,
      body: protocolConversionBody(selectedProtocol),
      date: selectedProtocol.date,
    });
  }

  function createTodoFromItem(kind: ProtocolItemKind, item: MeetingProtocolItem) {
    if (!selectedProtocol) return;

    onCreateTodo({
      title: item.title,
      body: protocolItemConversionBody(selectedProtocol, kind, item),
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
          <label className="search-control protocol-search-control">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Date, person, update, topic, to-do"
            />
          </label>
          <button
            type="button"
            className={`event-table-toggle ${isMinimized ? 'collapsed' : 'expanded'}`}
            onClick={() => setIsMinimized((minimized) => !minimized)}
            aria-expanded={!isMinimized}
          >
            {isMinimized ? 'Show protocols' : 'Hide protocols'}
          </button>
          <button type="button" onClick={addProtocol}>
            Add protocol
          </button>
        </div>
      </div>
      {isMinimized ? null : (
        <div className="protocol-workspace">
          <aside className="protocol-list" aria-label="Meeting protocols">
            <div className="protocol-list-toggle segmented">
              <button
                type="button"
                className={showProtocolEntries ? '' : 'active'}
                onClick={() => setShowProtocolEntries(false)}
              >
                Protocols
              </button>
              <button
                type="button"
                className={showProtocolEntries ? 'active' : ''}
                onClick={() => setShowProtocolEntries(true)}
              >
                Entries
              </button>
            </div>
            {showProtocolEntries ? (
              <>
                <label className="search-control protocol-entry-search-control">
                  <span>Find</span>
                  <input
                    value={entrySearch}
                    onChange={(event) => setEntrySearch(event.target.value)}
                    placeholder="Entry text, name, section"
                  />
                </label>
                {overviewItems.length ? (
                  overviewItems.map((item) => (
                    <button
                      type="button"
                      className={`protocol-overview-item ${item.kind} ${item.protocolId === selectedProtocol?.id ? 'active' : ''}`}
                      key={item.id}
                      onClick={() => {
                        setSelectedProtocolId(item.protocolId);
                        window.setTimeout(() => {
                          document.getElementById(item.id)?.scrollIntoView({ block: 'center' });
                        }, 0);
                      }}
                    >
                      <b>{item.title}</b>
                      <span>{item.meta}</span>
                      <small>{item.body || 'No details'}</small>
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
                  onClick={() => setSelectedProtocolId(protocol.id)}
                >
                  <b>{protocol.title}</b>
                  <span>{protocol.date}</span>
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
                <label>
                  <span>Title</span>
                  <input
                    value={selectedProtocol.title}
                    onChange={(event) => updateProtocol({ title: event.target.value })}
                  />
                </label>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={selectedProtocol.date}
                    onChange={(event) => updateDate(event.target.value)}
                  />
                </label>
              </div>
              <div className="protocol-role-grid" aria-label="Protocol roles">
                <label>
                  <span>🎤 Moderation</span>
                  <input
                    value={selectedProtocol.moderation}
                    onChange={(event) => updateProtocol({ moderation: event.target.value })}
                    placeholder="Name"
                    aria-label="Moderation name"
                  />
                </label>
                <label>
                  <span>📝 Protokoll</span>
                  <input
                    value={selectedProtocol.protocolWriter}
                    onChange={(event) => updateProtocol({ protocolWriter: event.target.value })}
                    placeholder="Name"
                    aria-label="Protocol writer name"
                  />
                </label>
                <label>
                  <span>📌 To-Dos-Beauftragte:r</span>
                  <input
                    value={selectedProtocol.todoOwner}
                    onChange={(event) => updateProtocol({ todoOwner: event.target.value })}
                    placeholder="Name"
                    aria-label="Todo owner name"
                  />
                </label>
              </div>
              <div className="protocol-actions">
                <button type="button" className="secondary" onClick={() => setShowInstruction((visible) => !visible)}>
                  {showInstruction ? 'Hide instruction' : 'Show instruction'}
                </button>
                <button type="button" className="secondary" onClick={createTodoFromProtocol}>
                  Todo from protocol
                </button>
                <button type="button" className="secondary" onClick={createEventFromProtocol}>
                  Event from protocol
                </button>
                <button type="button" className="icon-button danger" onClick={deleteProtocol} aria-label="Delete protocol">
                  x
                </button>
              </div>
              {showInstruction ? (
                <details className="protocol-instruction" open>
                  <summary>Instruction</summary>
                  <pre>{createMeetingProtocolInstruction(selectedProtocol.date)}</pre>
                </details>
              ) : null}
              <div className="protocol-body-layout">
                <div className="protocol-headlines">
                  {quickFindItems.length ? (
                    quickFindItems.map((item) => (
                      <button
                        type="button"
                        className="protocol-quickfind-item"
                        key={item.id}
                        onClick={() => document.getElementById(item.targetId)?.scrollIntoView({ block: 'center' })}
                      >
                        <b>{item.title}</b>
                        <span>{item.meta}</span>
                      </button>
                    ))
                  ) : (
                    <div className="protocol-empty">No matches</div>
                  )}
                </div>
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
                      onCreateTodo={(item) => createTodoFromItem(section.kind, item)}
                      onCreateEvent={(item) => createEventFromItem(section.kind, item)}
                    />
                  ))}
                  <section className="protocol-structured-section" id={`protocol-${selectedProtocol.id}-notes`}>
                    <div className="protocol-section-title">
                      <h3>Notes</h3>
                      <button type="button" className="secondary mini-button" onClick={() => setIsPreviewingNotes((previewing) => !previewing)}>
                        {isPreviewingNotes ? 'Edit markdown' : 'Preview markdown'}
                      </button>
                    </div>
                    {!isPreviewingNotes ? (
                      <textarea
                        className="protocol-editor protocol-notes-editor"
                        value={selectedProtocol.body}
                        onChange={(event) => updateProtocol({ body: event.target.value })}
                        placeholder="Optional markdown notes that do not fit into updates, topics, or to-dos."
                        rows={8}
                      />
                    ) : (
                      <div className="protocol-preview protocol-notes-preview">
                        <MarkdownBlock markdown={selectedProtocol.body || '_No notes yet._'} />
                      </div>
                    )}
                  </section>
                </div>
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
              <textarea
                value={editingItem.item.body}
                onChange={(event) => updateEditingItem({ body: event.target.value })}
                rows={8}
              />
            </label>
            <div className="todo-preview">
              <MarkdownBlock markdown={editingItem.item.body || '_No details yet._'} />
            </div>
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
  onCreateTodo: (item: MeetingProtocolItem) => void;
  onCreateEvent: (item: MeetingProtocolItem) => void;
}) {
  const query = search.trim().toLowerCase();
  const items = query
    ? protocol[kind].filter((item) => itemMatchesQuery(item, query))
    : protocol[kind];

  return (
    <section className={`protocol-structured-section ${kind}`}>
      <div className="protocol-section-title">
        <h3>{title}</h3>
        <button type="button" className="secondary mini-button" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {items.length ? (
        <div className="protocol-entry-list">
          {items.map((item) => (
            <article className={`protocol-entry ${kind}`} id={`protocol-${protocol.id}-${kind}-${item.id}`} key={item.id}>
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
        <div className="protocol-empty">No {title.toLowerCase()}</div>
      )}
    </section>
  );
}

function buildQuickFindItems(protocol: MeetingProtocol, search: string): QuickFindItem[] {
  const query = search.trim().toLowerCase();
  const structuredItems = sectionConfig.flatMap((section) =>
    protocol[section.kind].map((item) => ({
      id: `${section.kind}-${item.id}`,
      title: item.title,
      meta: [section.title, item.owner].filter(Boolean).join(' · '),
      targetId: `protocol-${protocol.id}-${section.kind}-${item.id}`,
      searchable: [section.title, item.title, item.owner, item.body].join(' ').toLowerCase(),
    })),
  );
  const noteItems = extractProtocolHeadlines(protocol.body).map((headline) => ({
    id: `note-${headline.id}`,
    title: headline.text,
    meta: 'Notes',
    targetId: `protocol-${protocol.id}-notes`,
    searchable: [headline.text, headline.excerpt].join(' ').toLowerCase(),
  }));
  const items = [...structuredItems, ...noteItems];

  return query ? items.filter((item) => item.searchable.includes(query)) : items;
}

function buildProtocolOverviewItems(protocols: MeetingProtocol[], search: string): ProtocolOverviewItem[] {
  const query = search.trim().toLowerCase();
  const items = protocols.flatMap((protocol) =>
    sectionConfig.flatMap((section) =>
      protocol[section.kind].map((item) => ({
        id: `protocol-${protocol.id}-${section.kind}-${item.id}`,
        protocolId: protocol.id,
        kind: section.kind,
        title: item.title,
        meta: [protocol.title, protocol.date, section.title, item.owner].filter(Boolean).join(' · '),
        body: item.body,
        searchable: [protocol.title, protocol.date, section.title, item.title, item.owner, item.body].join(' ').toLowerCase(),
      })),
    ),
  );

  return query ? items.filter((item) => item.searchable.includes(query)) : items;
}

function protocolMatchesQuery(protocol: MeetingProtocol, query: string) {
  return [
    protocol.title,
    protocol.date,
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
