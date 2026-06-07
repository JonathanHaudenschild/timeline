"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CalendarX,
  Eye,
  EyeOff,
  History,
  ListTodo,
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
  onAdd: () => void;
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
      title="Events"
      className="event-list"
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
            className={`event-table-toggle event-past-toggle ${hidePastEvents ? "collapsed" : "expanded"}`}
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
              className="icon-button event-add-button max-sm:justify-self-end"
              onClick={onAdd}
              aria-label="Add event"
              title="Add event"
            >
              <CalendarPlus size={18} aria-hidden="true" />
            </button>
          ) : null}
          {canEdit ? (
            <div className="desktop-control-group bulk-event-actions">
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
      <div className="table-wrap">
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
                    className="table-sort-button"
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
                <tr
                  key={event.id}
                  id={`event-row-${event.id}`}
                  className={cn(
                    "max-sm:p-2",
                    isAlt &&
                      "[&>td]:bg-[#eef7ff] [&>.event-date-cell]:bg-[#dff1ff] [&>.event-time-cell]:bg-[#dff1ff]",
                    isPast &&
                      "bg-[#f0eee7] bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgba(36,34,29,0.045)_11px_17px)] [&>td]:border-t-[rgba(36,34,29,0.1)] [&>td]:bg-[#f0eee7] [&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgba(36,34,29,0.045)_11px_17px)] [&>td]:text-[rgba(36,34,29,0.66)]",
                    isAlt &&
                      isPast &&
                      "bg-[#e6eef0] bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgba(36,34,29,0.05)_11px_17px)] [&>td]:border-t-[rgba(36,34,29,0.12)] [&>td]:bg-[#e6eef0] [&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgba(36,34,29,0.05)_11px_17px)]",
                    isHidden &&
                      "bg-[repeating-linear-gradient(135deg,transparent_0_12px,rgba(17,17,17,0.035)_12px_18px)] [&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_12px,rgba(17,17,17,0.035)_12px_18px)] [&>td]:text-[var(--muted)]",
                  )}
                >
                <td className="event-date-cell bg-[#fff8d8]" data-label="Date">
                  {canEdit ? (
                    <div
                      className="inline-date-range"
                      onClick={(click) => click.stopPropagation()}
                    >
                      <div className="inline-date-row">
                        <InlineTextInput
                          type="date"
                          value={event.date}
                          onValueChange={(date) => onChange({ ...event, date })}
                          aria-label={`Date for ${event.what}`}
                        />
                        {!event.endDate ? (
                          <button
	                            type="button"
	                            className="inline-date-add"
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
                        <div className="inline-date-row">
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
                            className="inline-date-add"
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
                <td className="event-time-cell bg-[#e8fbff]" data-label="Time">
                  {canEdit ? (
                    <div className="inline-time-range" onClick={(click) => click.stopPropagation()}>
                      <InlineTextInput
                        className="event-inline-input"
                        type="time"
                        value={event.time}
                        onValueChange={(time) => onChange({ ...event, time })}
                        aria-label={`Time for ${event.what}`}
                      />
	                      {event.endDate ? (
	                        event.endTime ? (
	                          <div className="inline-time-with-action">
	                            <InlineTextInput
	                              className="event-inline-input"
	                              type="time"
	                              value={event.endTime}
	                              onValueChange={(endTime) => onChange({ ...event, endTime: endTime || undefined })}
	                              aria-label={`End time for ${event.what}`}
	                            />
	                            <button
	                              type="button"
	                              className="inline-date-add"
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
	                            className="inline-time-add"
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
                <td className="event-what-cell" data-label="What">
                  {canEdit ? (
                    <InlineTextInput
                      className="event-inline-input"
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
                      className="event-inline-input"
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
                        "event-inline-input event-inline-type",
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
                    <span className={cn("event-badge type-badge", isAlt && "bg-[var(--cyan)]")}>{event.type}</span>
                  )}
                </td>
                <td data-label="Category">
                  {canEdit ? (
                    <InlineTextInput
                      className="event-inline-input"
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
                    <span className="event-badge category-badge">
                      {event.category || event.type || "event"}
                    </span>
                  )}
                </td>
                {!canEdit ? (
                  <td data-label="Timeline">
                    <span
                      className={`event-badge timeline-badge ${event.showOnTimeline === false ? "hidden" : "shown"}`}
                    >
                      {event.showOnTimeline === false ? "hidden" : "shown"}
                    </span>
                  </td>
                ) : null}
                <td className="event-note-cell" data-label="Note">
                  {canEdit ? (
                    <InlineTextarea
                      className="event-inline-note"
                      value={event.note}
                      onClick={(click) => click.stopPropagation()}
                      onValueChange={(note) => onChange({ ...event, note })}
                      aria-label={`Note for ${event.what}`}
                      placeholder="Note"
                      rows={1}
                    />
                  ) : event.note.trim() ? (
                    <MarkdownBlock markdown={event.note} />
                  ) : null}
                </td>
                <td data-label="Actions">
                  {canEdit ? (
                    <div className="event-row-actions">
                      <IconButton
                        tone="tertiary"
                        size="sm"
                        className={`timeline-toggle action-toggle ${event.showOnTimeline === false ? "off" : "on"}`}
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
              );
            })}
          </tbody>
        </table>
      </div>
      {appDialog.dialog}
    </SectionShell>
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
    event.time,
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
  return event.endTime ? `${event.time} - ${event.endTime}` : event.time;
}

function isPastEvent(event: TimelineEvent) {
  const compareDate = event.endDate || event.date;
  return Boolean(compareDate) && compareDate < localDateString(new Date());
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
