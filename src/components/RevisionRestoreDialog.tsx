'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SearchInput } from './FormControls';
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
    <div className="fixed inset-0 z-[70] grid place-items-center p-[18px] bg-[rgba(18,24,22,0.42)]" role="dialog" aria-modal="true" aria-label="Restore revision">
      <section className="bg-[var(--panel)] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-[3px] shadow-[var(--shadow)] p-[16px] w-[min(980px,100%)] max-w-[calc(100vw-36px)] max-h-[calc(100vh-36px)] overflow-auto shadow-[0_20px_60px_color-mix(in_srgb,var(--line)_20%,transparent)] grid gap-[14px] overflow-x-hidden">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
          <div>
            <h2>Restore revision</h2>
            <p>Choose a saved snapshot. Restoring creates a new current revision and keeps the history.</p>
          </div>
          <button type="button" className="icon-button tertiary" onClick={onClose} aria-label="Close restore revisions" title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Revision, title, date, counts"
          className="max-w-none"
          autoFocus
        />

        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] gap-3 min-w-0 min-h-[360px]">
          <div className="grid content-start gap-2 min-w-0 max-h-[min(52dvh,520px)] overflow-auto pr-1" role="listbox" aria-label="Available revisions">
            {filteredRevisions.length ? (
              filteredRevisions.map((revision) => {
                const isCurrent = revision.revision === currentRevision;
                const isSelected = revision.revision === selected?.revision;
                return (
                  <button
                    type="button"
                    className={`grid gap-2 w-full min-w-0 max-w-full items-start min-h-[70px] p-[12px] border border-l-[5px] text-[var(--text)] text-left shadow-none text-[14px] leading-[1.2] whitespace-normal normal-case font-normal ${
                      isSelected || !isCurrent
                        ? 'hover:border-[color-mix(in_srgb,var(--line)_50%,transparent)] hover:border-l-[var(--accent)] hover:bg-[var(--date-bg)]'
                        : ''
                    } ${
                      isSelected
                        ? 'border-[color-mix(in_srgb,var(--line)_50%,transparent)] border-l-[var(--accent)] bg-[var(--date-bg)]'
                        : 'border-[var(--soft-line)] border-l-[color-mix(in_srgb,var(--line)_30%,transparent)] bg-[var(--input-bg)]'
                    } ${
                      isCurrent
                        ? '!border-l-[var(--pink)] !bg-[var(--hot-soft)]'
                        : ''
                    }`}
                    key={revision.revision}
                    onClick={() => setSelectedRevision(revision.revision)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-[7px_10px] w-full min-w-0 items-center leading-none">
                      <b>{revision.revision}</b>
                      <time className="min-w-0 text-[var(--muted)] text-[13px] font-[900] overflow-wrap-anywhere leading-[1.1]">{formatRevisionTimestamp(revision.createdAt)}</time>
                      <span className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-[900] leading-[1.15] uppercase">{revision.name || 'Untitled project'}</span>
                      <span className="col-span-full min-w-0 max-w-full text-[var(--muted)] text-[12px] font-[800] leading-[1.25] overflow-wrap-anywhere normal-case">
                         {revision.eventCount} events · {revision.todoCount} todos ·{' '}
                        {revision.protocolCount} protocols
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="border border-dashed border-[color-mix(in_srgb,var(--line)_24%,transparent)] text-[var(--muted)] p-3 font-[900] uppercase">No matching revisions</div>
            )}
          </div>

          <aside className="grid content-start gap-3 min-w-0 border border-l-4 border-[var(--soft-line)] border-l-[var(--primary)] bg-[var(--input-bg)] p-3">
            {selected ? (
              <>
                <div className="flex min-w-0 justify-between gap-[10px] items-center flex-wrap">
                  <span className="min-w-0 text-[var(--muted)] text-[11px] font-[900] uppercase">Selected</span>
                  <b>{selected.revision}</b>
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
                  <p className="m-0 border border-dashed border-[color-mix(in_srgb,var(--line)_24%,transparent)] text-[var(--muted)] p-3 font-[900] uppercase bg-[var(--hot-soft)]">This is already the current revision.</p>
                ) : null}
              </>
            ) : (
              <p className="m-0 border border-dashed border-[color-mix(in_srgb,var(--line)_24%,transparent)] text-[var(--muted)] p-3 font-[900] uppercase bg-[var(--hot-soft)]">Select a revision to inspect it.</p>
            )}
          </aside>
        </div>

        <div className="grid grid-cols-[auto_auto_auto] justify-end gap-2">
          <button type="button" className="tertiary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!selected}
            onClick={() => {
              if (selected) downloadRevision(selected);
            }}
          >
            <span>Download revision</span>
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

function downloadRevision(revision: ProjectRevisionSummary) {
  const fileName = `${revision.project.hash}-revision-${revision.revision}.json`;
  const blob = new Blob([JSON.stringify(revision.project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
