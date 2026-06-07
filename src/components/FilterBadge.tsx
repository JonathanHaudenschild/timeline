"use client";

import { Filter, X } from "lucide-react";

type FilterBadgeProps = {
  active: boolean;
  label: string;
  detail?: string;
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
};

export function FilterBadge({
  active,
  label,
  detail,
  onClear,
  clearLabel = "Clear filters",
  className = "",
}: FilterBadgeProps) {
  if (!active) return null;

  return (
    <span
      className={`filter-badge inline-flex h-[var(--icon-button-size)] min-h-[var(--icon-button-size)] min-w-0 items-center gap-1.5 rounded-[2px] border border-[rgba(36,34,29,0.22)] bg-[#fffef8] py-0 pr-1 pl-2 text-[11px] font-black uppercase text-[var(--text)] shadow-none ${className}`}
      title={detail ?? label}
    >
      <Filter size={15} className="shrink-0 self-center text-[var(--hot)]" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      {onClear ? (
        <button
          type="button"
          className="ml-0.5 inline-grid h-7 min-h-7 w-7 min-w-7 place-items-center self-center rounded-[2px] border-0 border-l border-[rgba(36,34,29,0.14)] bg-transparent p-0 text-[var(--muted)] shadow-none hover:bg-[var(--primary)] hover:text-[var(--text)]"
          onClick={onClear}
          aria-label={clearLabel}
          title={clearLabel}
        >
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
