"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CalendarPlus,
  CalendarX,
  Eye,
  EyeOff,
  History,
  ListTodo,
  X,
} from "lucide-react";
import { useAppDialog } from "./AppDialog";
import { FilterBadge } from "./FilterBadge";
import { InlineTextarea, InlineTextInput, SearchInput, SelectField } from "./FormControls";
import { IconButton } from "./IconButton";
import { MarkdownBlock } from "./MarkdownBlock";
import { SectionShell } from "./SectionShell";
import { formatShortGermanDateRange } from "@/lib/dateFormat";
import { eventCategoryOptions, eventTypeOptions } from "@/lib/eventOptions";
import type { TimelineEvent } from "@/lib/types";
import { usePersistentState } from "@/lib/usePersistentState";
import { cn } from "@/lib/cn";

type EventListProps = {
  events: TimelineEvent[];
  canEdit: boolean;
  isMinimized: boolean;
  onToggleMinimized: () => void;
  onAdd: (moment?: { date: string; time: string }) => void;
  onChange: (event: TimelineEvent) => void;
  onToggleTimeline: (event: TimelineEvent) => void;
  onSetAllTimeline: (visible: boolean) => void;
  onConvertToTodo: (event: TimelineEvent) => void;
  onDelete: (eventId: string) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  moveControls?: {
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
  };
  sectionTitle?: string;
  onRenameSection?: (name: string) => void;
};

type SortKey =
  | "date"
  | "time"
  | "what"
  | "who"
  | "type"
  | "category"
  | "timeline"
  | "note";
type SortDirection = "asc" | "desc";

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "what", label: "What" },
  { key: "who", label: "Who" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "timeline", label: "Timeline" },
  { key: "note", label: "Note" },
];

export function EventList({
  events,
  canEdit,
  isMinimized,
  onToggleMinimized,
  onAdd,
  onChange,
  onToggleTimeline,
  onSetAllTimeline,
  onConvertToTodo,
  onDelete,
  onCopyLink,
  linkCopied,
  moveControls,
  sectionTitle = 'Events',
  onRenameSection,
}: EventListProps) {
  const appDialog = useAppDialog();
  const [sortKey, setSortKey] = usePersistentState<SortKey>(
    "timeline:ui:event-list-sort-key",
    "date",
  );
  const [sortDirection, setSortDirection] = usePersistentState<SortDirection>(
    "timeline:ui:event-list-sort-direction",
    "asc",
  );
  const [hidePastEvents, setHidePastEvents] = usePersistentState(
    "timeline:ui:event-list-hide-past",
    false,
  );
  const [search, setSearch] = useState("");
  const pastEventCount = useMemo(
    () => events.filter(isPastEvent).length,
    [events],
  );
  const eventTypes = useMemo(() => eventTypeOptions(events), [events]);
  const eventCategories = useMemo(() => eventCategoryOptions(events), [events]);
  const hasActiveFilter = Boolean(search.trim()) || hidePastEvents;
  const sortedEventRows = useMemo(
    () =>
      sortEvents(
        events.filter(
          (event) =>
            (!hidePastEvents || !isPastEvent(event)) &&
            eventMatchesSearch(event, search),
        ),
        sortKey,
        sortDirection,
      ),
    [events, hidePastEvents, search, sortDirection, sortKey],
  );
  const visibleColumns = canEdit
    ? sortableColumns.filter((column) => column.key !== "timeline")
    : sortableColumns;

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  return (
    <SectionShell
      title={sectionTitle}
      onRename={onRenameSection}
      className="relative min-w-0 max-w-full overflow-x-clip overflow-y-visible"
      isCollapsed={isMinimized}
      onToggle={onToggleMinimized}
      copyLink={{
        onCopy: onCopyLink,
        copied: linkCopied,
        label: "Copy events link",
      }}
      moveControls={moveControls}
      meta={`${sortedEventRows.length} / ${events.length}`}
      subheaderClassName="mt-3 mb-1.5 flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5"
      subheader={
        <>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Event, person, note"
            className="flex-[1_1_320px] sm:max-w-[380px] max-sm:max-w-none"
          />
          <SelectField
            label="Sort"
            value={sortKey}
            onValueChange={(key) => setSortKey(key as SortKey)}
            className="flex-none max-sm:hidden"
          >
            {visibleColumns.map((column) => (
              <option key={column.key} value={column.key}>{column.label}</option>
            ))}
          </SelectField>
          <FilterBadge
            active={hasActiveFilter}
            label={`${sortedEventRows.length} / ${events.length}`}
            detail="Event filters active"
            onClear={() => {
              setSearch("");
              setHidePastEvents(false);
            }}
            clearLabel="Clear event filters"
          />
          <button
            type="button"
            className={cn(
              "relative inline-flex w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] min-h-[var(--icon-button-size)] items-center justify-center border shadow-none p-0 text-[13px] font-[950] uppercase",
              hidePastEvents
                ? "bg-[var(--card-bg)] text-[var(--muted)]"
                : "bg-[var(--primary)] text-[var(--on-primary)]",
            )}
            onClick={() => setHidePastEvents((hidden) => !hidden)}
            aria-pressed={hidePastEvents}
            aria-label={
              hidePastEvents
                ? `Show ${pastEventCount} old events`
                : `Hide ${pastEventCount} old events`
            }
            title={
              hidePastEvents
                ? `Show ${pastEventCount} old events`
                : `Hide ${pastEventCount} old events`
            }
          >
            <History size={18} aria-hidden="true" />
          </button>
          {canEdit ? (
            <button
              type="button"
              className="icon-button w-[var(--icon-button-size)] min-w-[var(--icon-button-size)] p-0 max-sm:justify-self-end"
              onClick={() => onAdd()}
              aria-label="Add event"
              title="Add event"
            >
              <CalendarPlus size={18} aria-hidden="true" />
            </button>
          ) : null}
          {canEdit ? (
            <div className="hidden">
              <button
                type="button"
                className="secondary"
                onClick={() => onSetAllTimeline(true)}
              >
                Show all
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => onSetAllTimeline(false)}
              >
                Hide all
              </button>
            </div>
          ) : null}
        </>
      }
    >
      <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden mt-4 overscroll-x-contain [scrollbar-gutter:stable]">
        <datalist id="event-list-type-suggestions">
          {eventTypes.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
        <datalist id="event-list-category-suggestions">
          {eventCategories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <table>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    sortKey === column.key
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="w-full min-h-0 flex justify-between gap-2 border-0 bg-transparent shadow-none p-0 text-left hover:bg-transparent hover:shadow-none hover:[transform:none] [&>span]:text-[var(--muted)] [&>span]:text-[10px]"
                    onClick={() => changeSort(column.key)}
                  >
                    {column.label}
                    <span>
                      {sortKey === column.key
                        ? sortDirection === "asc"
                          ? "up"
                          : "down"
                        : "sort"}
                    </span>
                  </button>
                </th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sortedEventRows.map((event) => {
              const isAlt = event.type.trim().toLowerCase() === "alt";
              const isPast = isPastEvent(event);
              const isHidden = event.showOnTimeline === false;

              return (
                <Fragment key={event.id}>
                  {canEdit ? (
                    <EventInsertRow
                      colSpan={visibleColumns.length + 1}
                      label={`Add event before ${event.what || formatShortGermanDateRange(event.date, event.endDate)}`}
                      onAdd={() => onAdd({ date: event.date, time: "" })}
                    />
                  ) : null}
                  <tr
                    id={`event-row-${event.id}`}
                    className={cn(
                      "max-sm:p-2",
                      isAlt &&
                        "[&>td]:bg-[var(--alt-row-bg)] [&>.event-date-cell]:bg-[color-mix(in_srgb,var(--alt-row-bg)_80%,var(--date-bg))] [&>.event-time-cell]:bg-[color-mix(in_srgb,var(--alt-row-bg)_80%,var(--time-bg))]",
                      isPast &&
                        "bg-[var(--past-row-bg)] bg-[repeating-linear-gradient(135deg,transparent_0_11px,color-mix(in_srgb,var(--line)_4.5%,transparent)_11px_17px)] [&>td]:border-t-[color-mix(in_srgb,var(--line)_10%,transparent)] [&>td]:bg-[var(--past-row-bg)] [&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_11px,color-mix(in_srgb,var(--line)_4.5%,transparent)_11px_17px)] [&>td]:text-[color-mix(in_srgb,var(--text)_66%,transparent)]",
                      isAlt &&
                        isPast &&
                        "bg-[var(--alt-past-row-bg)] bg-[repeating-linear-gradient(135deg,transparent_0_11px,color-mix(in_srgb,var(--line)_5%,transparent)_11px_17px)] [&>td]:border-t-[color-mix(in_srgb,var(--line)_12%,transparent)] [&>td]:bg-[var(--alt-past-row-bg)] [&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_11px,color-mix(in_srgb,var(--line)_5%,transparent)_11px_17px)]",
                      isHidden &&
                        "bg-[repeating-linear-gradient(135deg,transparent_0_12px,rgba(17,17,17,0.035)_12px_18px)] [&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_12px,rgba(17,17,17,0.035)_12px_18px)] [&>td]:text-[var(--muted)]",
                    )}
                  >
                <td className="event-date-cell w-[188px] min-w-[188px] bg-[var(--date-bg)] text-[var(--text)] [font-weight:950] whitespace-nowrap max-sm:w-auto max-sm:min-w-0" data-label="Date">
                  {canEdit ? (
                    <div
                      className="grid gap-1 min-w-[150px]"
                      onClick={(click) => click.stopPropagation()}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 items-center">
                        <InlineTextInput
                          type="date"
                          value={event.date}
                          onValueChange={(date) => onChange({ ...event, date })}
                          aria-label={`Date for ${event.what}`}
                        />
                        {!event.endDate ? (
                          <button
	                            type="button"
	                            className="relative inline-flex w-[30px] min-w-[30px] min-h-[28px] items-center justify-center border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] shadow-none p-0 text-[10px] font-[950] uppercase"
	                            onClick={() =>
	                              onChange({ ...event, endDate: event.date, endTime: undefined })
	                            }
                            aria-label={`Add end date for ${event.what}`}
                            title="Add end date"
                          >
                            <CalendarPlus size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      {event.endDate ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 items-center">
                          <InlineTextInput
                            type="date"
                            value={event.endDate}
                            onValueChange={(endDate) =>
                              onChange({
                                ...event,
                                endDate: endDate || undefined,
                                endTime: endDate ? event.endTime : undefined,
                              })
                            }
                            aria-label={`End date for ${event.what}`}
                          />
                          <button
                            type="button"
                            className="relative inline-flex w-[30px] min-w-[30px] min-h-[28px] items-center justify-center border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] shadow-none p-0 text-[10px] font-[950] uppercase"
                            onClick={() =>
                              onChange({ ...event, endDate: undefined, endTime: undefined })
                            }
                            aria-label={`Remove end date for ${event.what}`}
                            title="Remove end date"
                          >
                            <CalendarX size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    formatShortGermanDateRange(event.date, event.endDate)
                  )}
                </td>
                <td className="event-time-cell w-[140px] min-w-[140px] bg-[var(--time-bg)] text-[var(--text)] [font-weight:950] whitespace-nowrap max-sm:w-auto max-sm:min-w-0" data-label="Time">
                  {canEdit ? (
                    <div className="grid gap-1 min-w-[86px]" onClick={(click) => click.stopPropagation()}>
                      <div className={cn("grid gap-1 items-center", !event.time ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto]")}>
                        <InlineTextInput
                          className="w-full min-w-0 min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs font-extrabold focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]"
                          type="time"
                          value={event.time}
                          onValueChange={(time) => onChange({ ...event, time, endTime: time ? event.endTime : undefined })}
                          aria-label={`Time for ${event.what}`}
                        />
                        {event.time ? (
                          <button
                            type="button"
                            className="relative inline-flex w-[30px] min-w-[30px] min-h-[28px] items-center justify-center border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] shadow-none p-0 text-[10px] font-[950] uppercase"
                            onClick={() => onChange({ ...event, time: "", endTime: undefined })}
                            aria-label={`Make ${event.what || "event"} all day`}
                            title="Make all day"
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      {!event.time ? (
                        <span className="text-[10px] font-black uppercase text-[var(--muted)]">All day</span>
                      ) : event.endDate ? (
                        event.endTime ? (
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 items-center">
                            <InlineTextInput
                              className="w-full min-w-0 min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs font-extrabold focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]"
                              type="time"
                              value={event.endTime}
                              onValueChange={(endTime) => onChange({ ...event, endTime: endTime || undefined })}
                              aria-label={`End time for ${event.what}`}
                            />
                            <button
                              type="button"
                              className="relative inline-flex w-[30px] min-w-[30px] min-h-[28px] items-center justify-center border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] shadow-none p-0 text-[10px] font-[950] uppercase"
                              onClick={() => onChange({ ...event, endTime: undefined })}
                              aria-label={`Remove end time for ${event.what}`}
                              title="Remove end time"
                            >
                              x
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] bg-[var(--input-bg)] shadow-none px-[7px] py-0 text-[10px] font-[950]"
                            onClick={() => onChange({ ...event, endTime: event.time })}
                            aria-label={`Add end time for ${event.what}`}
                            title="Add end time"
                          >
                            + time
                          </button>
                        )
                      ) : null}
                    </div>
                  ) : (
                    formatEventTimeRange(event)
                  )}
                </td>
                <td className="min-w-[240px] font-black" data-label="What">
                  {canEdit ? (
                    <InlineTextInput
                      className="w-full min-w-0 min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs font-extrabold focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]"
                      value={event.what}
                      onClick={(click) => click.stopPropagation()}
                      onValueChange={(what) => onChange({ ...event, what })}
                      aria-label={`Title for ${event.what}`}
                    />
                  ) : (
                    event.what
                  )}
                </td>
                <td data-label="Who">
                  {canEdit ? (
                    <InlineTextInput
                      className="w-full min-w-0 min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs font-extrabold focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]"
                      value={event.who}
                      onClick={(click) => click.stopPropagation()}
                      onValueChange={(who) => onChange({ ...event, who })}
                      aria-label={`Person for ${event.what}`}
                    />
                  ) : (
                    event.who
                  )}
                </td>
                <td data-label="Type">
                  {canEdit ? (
                    <InlineTextInput
                      className={cn(
                        "w-full min-w-0 min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs font-extrabold uppercase focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]",
                        isAlt && "bg-[var(--cyan)]",
                      )}
                      list="event-list-type-suggestions"
                      value={event.type}
                      onClick={(click) => click.stopPropagation()}
                      onValueChange={(type) =>
                        onChange({
                          ...event,
                          type,
                          color: "",
                        })
                      }
                      aria-label={`Type for ${event.what}`}
                    />
                  ) : (
                    <span className={cn(
                      "inline-flex items-center min-h-6 border border-[color-mix(in_srgb,var(--line)_26%,transparent)] rounded-[3px] bg-[var(--primary)] shadow-none px-[7px] py-0.5 text-[11px] [font-weight:950] leading-none uppercase",
                      isAlt && "bg-[var(--cyan)]",
                    )}>{event.type}</span>
                  )}
                </td>
                <td data-label="Category">
                  {canEdit ? (
                    <InlineTextInput
                      className="w-full min-w-0 min-h-[28px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs font-extrabold focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]"
                      list="event-list-category-suggestions"
                      value={event.category ?? ""}
                      onClick={(click) => click.stopPropagation()}
                      onValueChange={(category) =>
                        onChange({
                          ...event,
                          category: category || undefined,
                        })
                      }
                      aria-label={`Category for ${event.what}`}
                    />
                  ) : (
                    <span className="inline-flex items-center min-h-6 border border-[color-mix(in_srgb,var(--line)_26%,transparent)] rounded-[3px] bg-[var(--category-bg)] shadow-none px-[7px] py-0.5 text-[11px] [font-weight:950] leading-none uppercase">
                      {event.category || event.type || "event"}
                    </span>
                  )}
                </td>
                {!canEdit ? (
                  <td data-label="Timeline">
                    <span
                      className={cn(
                        "inline-flex items-center min-h-6 border border-[color-mix(in_srgb,var(--line)_26%,transparent)] rounded-[3px] shadow-none px-[7px] py-0.5 text-[11px] [font-weight:950] leading-none uppercase",
                        event.showOnTimeline === false
                          ? "bg-[var(--alt-bg)] text-[var(--muted)]"
                          : "bg-[var(--scheduled-bg)]",
                      )}
                    >
                      {event.showOnTimeline === false ? "hidden" : "shown"}
                    </span>
                  </td>
                ) : null}
                <td className="max-w-[360px] text-[var(--text)] [overflow-wrap:anywhere]" data-label="Note">
                  {canEdit ? (
                    <InlineTextarea
                      className="w-full min-w-0 min-h-[30px] max-h-[34px] border border-[color-mix(in_srgb,var(--line)_22%,transparent)] rounded-sm bg-[var(--input-bg)] shadow-none px-1.5 py-1 text-xs [font-weight:650] leading-[1.25] resize-none overflow-hidden focus:min-h-[92px] focus:max-h-[160px] focus:overflow-auto focus:border-[var(--text)] focus:outline-[2px] focus:outline-[color-mix(in_srgb,var(--cyan)_24%,transparent)]"
                      value={event.note}
                      onClick={(click) => click.stopPropagation()}
                      onValueChange={(note) => onChange({ ...event, note })}
                      aria-label={`Note for ${event.what}`}
                      placeholder="Note"
                      rows={1}
                    />
                  ) : event.note.trim() ? (
                    <div className="max-h-[86px] overflow-auto text-xs leading-[1.25]">
                      <MarkdownBlock markdown={event.note} />
                    </div>
                  ) : null}
                </td>
                <td data-label="Actions">
                  {canEdit ? (
                    <div className="flex justify-end gap-1.5 items-center flex-nowrap min-w-max">
                      <IconButton
                        tone="tertiary"
                        size="sm"
                        className={cn(
                          "min-h-[28px] border shadow-none px-[9px] py-0 text-[11px] font-[950]",
                          event.showOnTimeline === false
                            ? "bg-[var(--alt-bg)] text-[var(--muted)]"
                            : "bg-[var(--primary)]",
                        )}
                        onClick={(click) => {
                          click.stopPropagation();
                          onToggleTimeline(event);
                        }}
                        aria-label={`${event.showOnTimeline === false ? "Show" : "Hide"} ${event.what} on timeline`}
                        title={
                          event.showOnTimeline === false
                            ? "Show on timeline"
                            : "Hide from timeline"
                        }
                      >
                        {event.showOnTimeline === false ? (
                          <Eye size={17} aria-hidden="true" />
                        ) : (
                          <EyeOff size={17} aria-hidden="true" />
                        )}
                      </IconButton>
                      <IconButton
                        size="sm"
                        onClick={(click) => {
                          click.stopPropagation();
                          onConvertToTodo(event);
                        }}
                        aria-label={`Convert ${event.what} to todo`}
                        title="Convert to todo"
                      >
                        <ListTodo size={17} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        size="sm"
                        onClick={(click) => {
                          click.stopPropagation();
                          void appDialog
                            .confirm({
                              title: "Delete event?",
                              message: `Delete "${event.what}"?`,
                              confirmLabel: "Delete event",
                              tone: "danger",
                            })
                            .then((confirmed) => {
                              if (confirmed) onDelete(event.id);
                            });
                        }}
                        aria-label={`Delete ${event.what}`}
                      >
                        x
                      </IconButton>
                    </div>
                  ) : null}
                </td>
                  </tr>
                </Fragment>
              );
            })}
            {canEdit ? (
              <EventInsertRow
                colSpan={visibleColumns.length + 1}
                label="Add event at end"
                onAdd={() => {
                  const lastEvent = sortedEventRows.at(-1);
                  if (lastEvent) {
                    onAdd({ date: lastEvent.endDate ?? lastEvent.date, time: "" });
                    return;
                  }

                  onAdd();
                }}
              />
            ) : null}
          </tbody>
        </table>
      </div>
      {appDialog.dialog}
    </SectionShell>
  );
}

function EventInsertRow({
  colSpan,
  label,
  onAdd,
}: {
  colSpan: number;
  label: string;
  onAdd: () => void;
}) {
  return (
    <tr className="event-insert-row group/insert h-0 border-0">
      <td colSpan={colSpan} className="h-0 border-0 bg-transparent p-0 leading-none">
        <button
          type="button"
          className="event-insert-button relative flex w-full h-0 min-h-0 items-center justify-center border-0 bg-transparent shadow-none p-0 opacity-0 group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 before:content-[''] before:absolute before:right-2 before:left-2 before:h-px before:bg-transparent"
          onClick={onAdd}
          aria-label={label}
          title={label}
        >
          <span aria-hidden="true" className="relative z-[1] inline-grid w-[72px] min-w-[72px] h-[6px] place-items-center border-0 rounded-[2px] bg-transparent text-[var(--text)] leading-none group-hover/insert:bg-[var(--hot)] group-focus-within/insert:bg-[var(--hot)]" />
        </button>
      </td>
    </tr>
  );
}

function sortEvents(
  events: TimelineEvent[],
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...events].sort((a, b) => {
    const primary = compareValues(
      eventSortValue(a, sortKey),
      eventSortValue(b, sortKey),
    );
    if (primary !== 0) return primary * direction;

    const dateCompare = compareValues(a.date, b.date);
    if (dateCompare !== 0) return dateCompare;

    const timeCompare = compareValues(a.time, b.time);
    if (timeCompare !== 0) return timeCompare;

    return compareValues(a.what, b.what);
  });
}

function eventSortValue(event: TimelineEvent, sortKey: SortKey) {
  switch (sortKey) {
    case "category":
      return event.category || event.type || "event";
    case "timeline":
      return event.showOnTimeline === false ? "hidden" : "shown";
    default:
      return event[sortKey] ?? "";
  }
}

function compareValues(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function eventMatchesSearch(event: TimelineEvent, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    event.date,
    event.endDate ?? "",
    event.time || "all day",
    event.endTime ?? "",
    event.what,
    event.who,
    event.type,
    event.category ?? "",
    event.note,
    event.showOnTimeline === false ? "hidden" : "shown",
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function formatEventTimeRange(event: TimelineEvent) {
  if (!event.time) return "All day";
  return event.endTime ? `${event.time} - ${event.endTime}` : event.time;
}

function isPastEvent(event: TimelineEvent) {
  const compareDate = event.endDate || event.date;
  return Boolean(compareDate) && compareDate < localDateString(new Date());
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
