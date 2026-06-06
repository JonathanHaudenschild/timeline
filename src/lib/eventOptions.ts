import type { TimelineEvent } from './types';

const defaultEventTypes = ['milestone', 'meeting', 'decision', 'incident', 'review', 'note'];
const defaultEventCategories = ['event', 'milestone', 'deadline', 'period'];

export function eventTypeOptions(events: readonly TimelineEvent[]) {
  return uniqueValues([...defaultEventTypes, ...events.map((event) => event.type)]);
}

export function eventCategoryOptions(events: readonly TimelineEvent[]) {
  return uniqueValues([
    ...defaultEventCategories,
    ...events.map((event) => event.category || event.type),
  ]);
}

function uniqueValues(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
