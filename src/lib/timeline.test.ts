import { describe, expect, it } from 'vitest';
import {
  clamp,
  dateToDay,
  dayToDate,
  eventSpansMultipleDays,
  eventMatchesTimelineFilters,
  eventTimelineCategory,
  eventVisibleOnTimeline,
  pixelToMoment,
  pixelToTime,
  timeOfDayToMinutes,
  momentToPixel,
  timeToPixel,
} from './timeline';
import type { TimelineEvent } from './types';

describe('timeline math', () => {
  it('converts dates to whole day offsets', () => {
    expect(dateToDay('2026-06-03', '2026-06-01')).toBe(2);
  });

  it('converts day offsets back to ISO dates', () => {
    expect(dayToDate(2, '2026-06-01')).toBe('2026-06-03');
  });

  it('maps a date to a pixel and back', () => {
    const range = { startDate: '2026-06-01', endDate: '2026-06-11' };
    const pixel = timeToPixel('2026-06-06', range, 1000, 0);

    expect(pixel).toBe(500);
    expect(pixelToTime(pixel, range, 1000, 0)).toBe('2026-06-06');
  });

  it('maps a timed moment inside a day', () => {
    const range = { startDate: '2026-06-01', endDate: '2026-06-03' };

    expect(momentToPixel('2026-06-02', '12:00', range, 480, 0)).toBe(360);
    expect(pixelToMoment(360, range, 480, 0)).toEqual({ date: '2026-06-02', time: '12:00' });
  });

  it('parses time of day to minutes', () => {
    expect(timeOfDayToMinutes('09:30')).toBe(570);
    expect(timeOfDayToMinutes('')).toBe(0);
  });

  it('respects pan offsets while mapping pixels to dates', () => {
    const range = { startDate: '2026-06-01', endDate: '2026-06-11' };

    expect(pixelToTime(600, range, 1000, 100)).toBe('2026-06-06');
  });

  it('detects multi-day events', () => {
    const event: TimelineEvent = {
      id: 'event-1',
      date: '2026-06-03',
      endDate: '2026-06-05',
      time: '09:00',
      what: 'Workshop',
      who: 'Team',
      type: 'meeting',
      note: '',
    };

    expect(eventSpansMultipleDays(event)).toBe(true);
  });

  it('keeps existing events visible on the timeline by default', () => {
    const event: TimelineEvent = {
      id: 'event-1',
      date: '2026-06-03',
      time: '09:00',
      what: 'Workshop',
      who: 'Team',
      type: 'meeting',
      note: '',
    };

    expect(eventVisibleOnTimeline(event)).toBe(true);
  });

  it('can hide events from the timeline', () => {
    const event: TimelineEvent = {
      id: 'event-1',
      date: '2026-06-03',
      time: '09:00',
      what: 'Workshop',
      who: 'Team',
      type: 'meeting',
      category: 'event',
      showOnTimeline: false,
      note: '',
    };

    expect(eventVisibleOnTimeline(event)).toBe(false);
  });

  it('falls back to the old type as timeline category', () => {
    const event: TimelineEvent = {
      id: 'event-1',
      date: '2026-06-03',
      time: '09:00',
      what: 'Launch',
      who: 'Team',
      type: 'milestone',
      note: '',
    };

    expect(eventTimelineCategory(event)).toBe('milestone');
  });

  it('filters visible events by type and category', () => {
    const event: TimelineEvent = {
      id: 'event-1',
      date: '2026-06-03',
      time: '09:00',
      what: 'Launch',
      who: 'Team',
      type: 'SCC',
      category: 'milestone',
      showOnTimeline: true,
      note: '',
    };

    expect(eventMatchesTimelineFilters(event, [], [])).toBe(true);
    expect(eventMatchesTimelineFilters(event, ['SCC'], [])).toBe(false);
    expect(eventMatchesTimelineFilters(event, [], ['milestone'])).toBe(false);
  });

  it('clamps numeric values', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});
