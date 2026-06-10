'use client';

import { useState } from 'react';
import { findDuplicateHints, type DuplicateCandidate } from '@/lib/duplicateHints';

type DuplicateHintsProps = {
  draftId?: string;
  title: string;
  body?: string;
  candidates: readonly DuplicateCandidate[];
  excludeIds?: readonly string[];
};

export function DuplicateHints({
  draftId,
  title,
  body = '',
  candidates,
  excludeIds = [],
}: DuplicateHintsProps) {
  const [expandedId, setExpandedId] = useState('');
  const hints = findDuplicateHints(
    { id: draftId, title, body },
    candidates,
    excludeIds,
  );

  if (!hints.length) return null;

  return (
    <div className="rounded-[2px] border border-[color-mix(in_srgb,var(--line)_16%,transparent)] bg-[var(--date-bg)] px-2 py-1.5 text-[11px] font-black text-[var(--muted)] uppercase">
      <div className="mb-0.5 text-[10px]">Possible duplicate</div>
      <div className="grid gap-0.5 normal-case">
        {hints.map((hint) => {
          const expanded = expandedId === hint.id;

          return (
            <div className="min-w-0" key={hint.id}>
              <button
                type="button"
                className="min-h-0 w-full border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[color-mix(in_srgb,var(--line)_22%,transparent)]"
                onClick={() => setExpandedId(expanded ? '' : hint.id)}
                aria-expanded={expanded}
                title={`${hint.title} · ${hint.meta}`}
              >
                <span className="block min-w-0 truncate">
                  <span className="text-[var(--text)]">{hint.title || 'Untitled'}</span>
                  <span> · {hint.meta}</span>
                </span>
              </button>
              {expanded ? (
                <div className="mt-1 rounded-[2px] border border-[color-mix(in_srgb,var(--line)_14%,transparent)] bg-[var(--input-bg)] p-1.5 text-[11px] font-bold text-[var(--muted)]">
                  <div className="mb-1 text-[var(--text)]">{hint.title || 'Untitled'}</div>
                  <div className="mb-1 text-[10px] font-black uppercase">{hint.meta}</div>
                  {hint.body?.trim() ? (
                    <div className="max-h-20 overflow-auto whitespace-pre-wrap normal-case">
                      {hint.body.trim()}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
