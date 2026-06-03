import type { TimelineEvent, TimelineRange } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dateToDay(date: string, startDate: string) {
  return Math.round((parseDate(date).getTime() - parseDate(startDate).getTime()) / DAY_MS);
}

export function dayToDate(day: number, startDate: string) {
  const date = parseDate(startDate);
  date.setUTCDate(date.getUTCDate() + day);
  return formatDate(date);
}

export function totalDays(range: TimelineRange) {
  return Math.max(1, dateToDay(range.endDate, range.startDate));
}

export function timeToPixel(date: string, range: TimelineRange, width: number, panOffset: number) {
  const day = dateToDay(date, range.startDate);
  return (day / totalDays(range)) * width + panOffset;
}

export function pixelToTime(pixel: number, range: TimelineRange, width: number, panOffset: number) {
  const rawDay = ((pixel - panOffset) / width) * totalDays(range);
  const day = clamp(Math.round(rawDay), 0, totalDays(range));
  return dayToDate(day, range.startDate);
}

export function timeOfDayToMinutes(time: string) {
  const [hours = '0', minutes = '0'] = time.split(':');
  return clamp(Number(hours) * 60 + Number(minutes), 0, 1439);
}

export function minutesToTime(minutes: number) {
  const safeMinutes = clamp(Math.round(minutes / 15) * 15, 0, 1439);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function momentToFraction(date: string, time: string, range: TimelineRange) {
  const day = dateToDay(date, range.startDate);
  return (day + timeOfDayToMinutes(time) / 1440) / totalDays(range);
}

export function momentToPixel(
  date: string,
  time: string,
  range: TimelineRange,
  width: number,
  panOffset: number,
) {
  return momentToFraction(date, time, range) * width + panOffset;
}

export function pixelToMoment(pixel: number, range: TimelineRange, width: number, panOffset: number) {
  const rawDays = clamp(((pixel - panOffset) / width) * totalDays(range), 0, totalDays(range));
  const wholeDay = Math.floor(rawDays);
  const minutes = (rawDays - wholeDay) * 1440;
  return {
    date: dayToDate(wholeDay, range.startDate),
    time: minutesToTime(minutes),
  };
}

export function eventSpansMultipleDays(event: TimelineEvent) {
  return Boolean(event.endDate && event.endDate !== event.date);
}

export function eventVisibleOnTimeline(event: TimelineEvent) {
  return event.showOnTimeline !== false;
}

export function eventTimelineCategory(event: TimelineEvent) {
  return (event.category || event.type || 'event').trim().toLowerCase();
}

export function eventMatchesTimelineFilters(
  event: TimelineEvent,
  hiddenTypes: readonly string[] = [],
  hiddenCategories: readonly string[] = [],
) {
  return (
    eventVisibleOnTimeline(event) &&
    !hiddenTypes.includes(event.type) &&
    !hiddenCategories.includes(eventTimelineCategory(event))
  );
}

export function sortedEvents(events: TimelineEvent[]) {
  return [...events].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
}

export function visibleDateRange(range: TimelineRange, zoom: number) {
  const days = totalDays(range);
  return Math.max(1, Math.round(days / zoom));
}
