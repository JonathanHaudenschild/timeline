'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { ProjectRevisionSummary } from '@/lib/api';

type RevisionRestoreDialogProps = {
  currentRevision?: number;
  revisions: ProjectRevisionSummary[];
  restoringRevision: number | null;
  onClose: () => void;
  onRestore: (revision: ProjectRevisionSummary) => void;
};

export function RevisionRestoreDialog({
  currentRevision,
  revisions,
  restoringRevision,
  onClose,
  onRestore,
}: RevisionRestoreDialogProps) {
  const firstRestorableRevision = revisions.find((revision) => revision.revision !== currentRevision) ?? revisions[0];
  const [selectedRevision, setSelectedRevision] = useState(firstRestorableRevision?.revision);
  const [search, setSearch] = useState('');
  const filteredRevisions = useMemo(
    () => revisions.filter((revision) => revisionMatchesSearch(revision, search)),
    [revisions, search],
  );
  const selected = revisions.find((revision) => revision.revision === selectedRevision) ?? filteredRevisions[0];
  const canRestore = Boolean(selected && selected.revision !== currentRevision && restoringRevision === null);

  return (
    <div className="modal-backdrop revision-restore-backdrop" role="dialog" aria-modal="true" aria-label="Restore revision">
      <section className="editor-panel modal-panel revision-restore-dialog">
        <header className="revision-restore-header">
          <div>
            <h2>Restore revision</h2>
            <p>Choose a saved snapshot. Restoring creates a new current revision and keeps the history.</p>
          </div>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Close restore revisions" title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <label className="search-control revision-search-control">
          <span>
            <Search size={14} aria-hidden="true" />
            Search
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Revision, title, date, counts"
            autoFocus
          />
        </label>

        <div className="revision-restore-body">
          <div className="revision-list" role="listbox" aria-label="Available revisions">
            {filteredRevisions.length ? (
              filteredRevisions.map((revision) => {
                const isCurrent = revision.revision === currentRevision;
                const isSelected = revision.revision === selected?.revision;
                return (
                  <button
                    type="button"
                    className={`revision-list-item ${isSelected ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
                    key={revision.revision}
                    onClick={() => setSelectedRevision(revision.revision)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="revision-list-row">
                      <b>r{revision.revision}</b>
                      <time>{formatRevisionTimestamp(revision.createdAt)}</time>
                      <span className="revision-list-title">{revision.name || 'Untitled project'}</span>
                      <span className="revision-list-meta">
                         {revision.eventCount} events · {revision.todoCount} todos ·{' '}
                        {revision.protocolCount} protocols
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="revision-empty">No matching revisions</div>
            )}
          </div>

          <aside className="revision-detail">
            {selected ? (
              <>
                <div className="revision-detail-topline">
                  <span>Selected</span>
                  <b>r{selected.revision}</b>
                </div>
                <h3>{selected.name || 'Untitled project'}</h3>
                <dl>
                  <div>
                    <dt>Saved</dt>
                    <dd>{formatRevisionTimestamp(selected.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Range</dt>
                    <dd>{selected.startDate} to {selected.endDate}</dd>
                  </div>
                  <div>
                    <dt>Contents</dt>
                    <dd>
                      {selected.eventCount} events, {selected.todoCount} todos, {selected.boardCount} boards,{' '}
                      {selected.protocolCount} protocols
                    </dd>
                  </div>
                </dl>
                {selected.revision === currentRevision ? (
                  <p className="revision-current-note">This is already the current revision.</p>
                ) : null}
              </>
            ) : (
              <p className="revision-current-note">Select a revision to inspect it.</p>
            )}
          </aside>
        </div>

        <div className="action-row revision-restore-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canRestore}
            onClick={() => {
              if (selected) onRestore(selected);
            }}
          >
            <span>{restoringRevision === selected?.revision ? 'Restoring' : 'Restore selected'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function revisionMatchesSearch(revision: ProjectRevisionSummary, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    `r${revision.revision}`,
    String(revision.revision),
    revision.name,
    revision.startDate,
    revision.endDate,
    formatRevisionTimestamp(revision.createdAt),
    `${revision.eventCount} events`,
    `${revision.todoCount} todos`,
    `${revision.boardCount} boards`,
    `${revision.protocolCount} protocols`,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function formatRevisionTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
