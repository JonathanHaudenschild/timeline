"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { uiChip, uiIconButton, uiSectionHeader, uiSectionShell, uiSectionTitle } from "@/lib/ui";

type SectionShellProps = {
  as?: "div" | "section";
  title: string;
  showTitle?: boolean;
  className?: string;
  meta?: ReactNode;
  metaClassName?: string;
  actions?: ReactNode;
  moveControls?: {
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
  };
  isCollapsed?: boolean;
  onToggle?: () => void;
  copyLink?: {
    onCopy: () => void;
    copied: boolean;
    label: string;
  };
  subheader?: ReactNode;
  subheaderClassName?: string;
  children: ReactNode;
};

export function SectionShell({
  as: Component = "section",
  title,
  showTitle = true,
  className = "",
  meta,
  metaClassName = "",
  actions,
  moveControls,
  isCollapsed,
  onToggle,
  copyLink,
  subheader,
  subheaderClassName,
  children,
}: SectionShellProps) {
  const shellClassName = cn(
    uiSectionShell,
    className,
  );
  const chipClassName = cn(
    uiChip,
    metaClassName,
  );
  const collapsed = Boolean(isCollapsed);
  const canCollapse = Boolean(onToggle);
  const hasHeaderContent = showTitle || Boolean(copyLink) || Boolean(meta) || Boolean(actions) || Boolean(moveControls) || canCollapse;

  return (
    <Component className={shellClassName} aria-label={!showTitle ? title : undefined}>
      {hasHeaderContent ? (
        <div className={uiSectionHeader}>
          <div className="flex min-w-0 items-center gap-2 max-[420px]:w-full">
            {copyLink ? (
              <button
                type="button"
                className={cn(uiIconButton, "section-copy-link tertiary h-4 min-h-4 w-4 min-w-4")}
                onClick={copyLink.onCopy}
                aria-label={copyLink.label}
                title={copyLink.copied ? "Copied" : copyLink.label}
              >
                {copyLink.copied ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Link2 size={15} aria-hidden="true" />
                )}
              </button>
            ) : null}
            <h2 className={showTitle ? uiSectionTitle : "sr-only"}>{title}</h2>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:gap-1.5 max-[420px]:w-full max-[420px]:justify-start">
            {meta ? <span className={chipClassName}>{meta}</span> : null}
            {actions}
            {moveControls ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className={cn(uiIconButton, "secondary h-8 min-h-8 w-8 min-w-8")}
                  onClick={moveControls.onMoveUp}
                  disabled={!moveControls.canMoveUp}
                  aria-label={`Move ${title} up`}
                  title="Move up"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={cn(uiIconButton, "secondary h-8 min-h-8 w-8 min-w-8")}
                  onClick={moveControls.onMoveDown}
                  disabled={!moveControls.canMoveDown}
                  aria-label={`Move ${title} down`}
                  title="Move down"
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
              </span>
            ) : null}
            {canCollapse ? (
              <button
                type="button"
                className={`event-table-toggle ${collapsed ? "collapsed" : "expanded"}`}
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Show ${title}` : `Hide ${title}`}
                title={collapsed ? `Show ${title}` : `Hide ${title}`}
              >
                {collapsed ? (
                  <Eye size={18} aria-hidden="true" />
                ) : (
                  <EyeOff size={18} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {collapsed ? null : (
        <>
          {subheader ? (
            <div className={subheaderClassName ?? "mt-3 mb-1.5 flex flex-wrap items-center justify-end gap-1.5 max-sm:justify-stretch max-sm:gap-2 max-sm:[&>label]:max-w-none max-sm:[&>label]:flex-[1_0_100%] max-sm:[&>.filter-badge]:flex-[1_0_100%] max-sm:[&>.filter-badge]:justify-start max-sm:[&>details]:flex-[1_0_100%]"}>
              {subheader}
            </div>
          ) : null}
          {children}
        </>
      )}
    </Component>
  );
}
