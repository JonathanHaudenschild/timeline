'use client';

import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  dayToDate,
  eventMatchesTimelineFilters,
  eventSpansMultipleDays,
  eventTimelineCategory,
  momentToPixel,
  pixelToMoment,
  timeToPixel,
  totalDays,
} from '@/lib/timeline';
import { colorForType } from '@/lib/colors';
import type { TimelineEvent, TimelineProject, TimelineTodo } from '@/lib/types';

type TimelineCanvasProps = {
  project: TimelineProject;
  selectedEventId?: string;
  canEdit: boolean;
  onCreateEvent: (moment: { date: string; time: string }) => void;
  onSelectEvent: (event: TimelineEvent) => void;
};

type HitBox = {
  event: TimelineEvent;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function TimelineCanvas({
  project,
  selectedEventId,
  canEdit,
  onCreateEvent,
  onSelectEvent,
}: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitBoxesRef = useRef<HitBox[]>([]);
  const dragRef = useRef<{ x: number; pan: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());
  const eventTypes = uniqueValues(project.events.map((event) => event.type).filter(Boolean));
  const eventCategories = uniqueValues(project.events.map(eventTimelineCategory));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function panToMoment(date: string, time: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const rangeWidth = rect.width * zoom;
    const targetX = momentToPixel(date, time, project, rangeWidth, 0);
    setPan(rect.width / 2 - targetX);
  }

  function panToNow() {
    const today = clampDateToProject(localDateString(now), project.startDate, project.endDate);
    const time = today === localDateString(now) ? localTimeString(now) : '12:00';
    panToMoment(today, time);
  }

  function fitTimeline() {
    setZoom(1);
    setPan(0);
  }

  useEffect(() => {
    const today = clampDateToProject(localDateString(now), project.startDate, project.endDate);
    panToMoment(today, today === localDateString(now) ? localTimeString(now) : '12:00');
    // Run only when the project range changes; users can pan freely afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.startDate, project.endDate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTimeline(ctx, rect.width, rect.height, project, zoom, pan, selectedEventId, hiddenTypes, hiddenCategories, now, hitBoxesRef);
  }, [project, zoom, pan, selectedEventId, hiddenTypes, hiddenCategories, now]);

  function clientXToMoment(clientX: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { date: project.startDate, time: '09:00' };

    const rect = canvas.getBoundingClientRect();
    const width = rect.width * zoom;
    const x = clientX - rect.left;
    return pixelToMoment(x, project, width, pan);
  }

  return (
    <div className="timeline-shell">
      <div className="timeline-toolbar">
        <div className="timeline-title">
          <span>Timeline</span>
          <code>{project.startDate} / {project.endDate}</code>
        </div>
        <div className="timeline-actions">
          <button type="button" className="secondary" onClick={() => setZoom((current) => Math.max(0.8, current - 0.3))}>
            -
          </button>
          <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
          <button type="button" className="secondary" onClick={() => setZoom((current) => Math.min(8, current + 0.3))}>
            +
          </button>
          <button
            type="button"
            className="secondary today-button"
            onClick={panToNow}
          >
            Jump to now
          </button>
          <button type="button" className="secondary today-button" onClick={fitTimeline}>
            Fit timeline
          </button>
          {canEdit ? (
            <button type="button" onClick={() => onCreateEvent({ date: project.startDate, time: '09:00' })}>
              Add event
            </button>
          ) : null}
        </div>
      </div>
      <div className="timeline-filters">
        {eventTypes.length > 1 ? (
          <div className="filter-group">
            <span>Types</span>
            {eventTypes.map((type) => (
              <button
                type="button"
                className={hiddenTypes.includes(type) ? 'filter-chip' : 'filter-chip active'}
                key={type}
                onClick={() => setHiddenTypes((current) => toggleValue(current, type))}
              >
                {type}
              </button>
            ))}
          </div>
        ) : null}
        {eventCategories.length > 1 ? (
          <div className="filter-group">
            <span>Categories</span>
            {eventCategories.map((category) => (
              <button
                type="button"
                className={hiddenCategories.includes(category) ? 'filter-chip' : 'filter-chip active'}
                key={category}
                onClick={() => setHiddenCategories((current) => toggleValue(current, category))}
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <canvas
        ref={canvasRef}
        className={`timeline-canvas ${project.settings.mode}`}
        onWheel={(event) => {
          if (project.settings.mode !== 'view') return;
          event.preventDefault();
          setZoom((current) => Math.max(0.8, Math.min(8, current + (event.deltaY > 0 ? -0.2 : 0.2))));
        }}
        onPointerDown={(event) => {
          const hit = hitBoxesRef.current.find(
            (box) =>
              event.nativeEvent.offsetX >= box.x &&
              event.nativeEvent.offsetX <= box.x + box.width &&
              event.nativeEvent.offsetY >= box.y &&
              event.nativeEvent.offsetY <= box.y + box.height,
          );

          if (hit) {
            onSelectEvent(hit.event);
            return;
          }

          if (canEdit) {
            onCreateEvent(clientXToMoment(event.clientX));
            return;
          }

          dragRef.current = { x: event.clientX, pan };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current || project.settings.mode !== 'view') return;
          setPan(dragRef.current.pan + event.clientX - dragRef.current.x);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      />
    </div>
  );
}

function drawTimeline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: TimelineProject,
  zoom: number,
  pan: number,
  selectedEventId: string | undefined,
  hiddenTypes: readonly string[],
  hiddenCategories: readonly string[],
  now: Date,
  hitBoxesRef: MutableRefObject<HitBox[]>,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fffdf4';
  ctx.fillRect(0, 0, width, height);

  const timelineY = Math.round(height * 0.48);
  const rangeWidth = width * zoom;
  const days = totalDays(project);
  const tickEvery = Math.max(1, Math.ceil(days / (10 * zoom)));
  const showHours = zoom >= 2;

  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#111111';

  for (let day = 0; day <= days; day += tickEvery) {
    const date = dayToDate(day, project.startDate);
    const x = timeToPixel(date, project, rangeWidth, pan);
    if (x < -80 || x > width + 80) continue;
    if (day < days) {
      const nextDate = dayToDate(Math.min(days, day + tickEvery), project.startDate);
      const nextX = timeToPixel(nextDate, project, rangeWidth, pan);
      ctx.fillStyle = day / tickEvery % 2 === 0 ? '#fff8d8' : '#f8efc7';
      ctx.fillRect(x, 0, Math.max(0, nextX - x), height);
    }
    ctx.strokeStyle = '#ded7c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 30);
    ctx.lineTo(x, height - 34);
    ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.fillRect(x + 4, 16, 58, 22);
    ctx.fillStyle = '#d7ff2f';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(date.slice(5), x + 9, 21);

    if (showHours && day < days) {
      [6, 12, 18].forEach((hour) => {
        const hourX = momentToPixel(date, `${String(hour).padStart(2, '0')}:00`, project, rangeWidth, pan);
        if (hourX < -40 || hourX > width + 40) return;
        ctx.strokeStyle = '#eee7d7';
        ctx.beginPath();
        ctx.moveTo(hourX, 62);
        ctx.lineTo(hourX, height - 44);
        ctx.stroke();
      });
    }
  }

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(24, timelineY);
  ctx.lineTo(width - 34, timelineY);
  ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(width - 24, timelineY);
  ctx.lineTo(width - 40, timelineY - 8);
  ctx.lineTo(width - 40, timelineY + 8);
  ctx.closePath();
  ctx.fill();

  drawNowMarker(ctx, project, rangeWidth, pan, width, height, now);

  const visibleEvents = project.events
    .filter((event) => eventMatchesTimelineFilters(event, hiddenTypes, hiddenCategories))
    .map((event, index) => ({
      event,
      index,
      x: momentToPixel(event.date, event.time, project, rangeWidth, pan),
    }))
    .filter(({ x }) => x > -220 && x < width + 220);
  const denseMode = visibleEvents.length > 55 && zoom < 2.4;
  const displayEvents = denseMode
    ? visibleEvents.filter(
        ({ event }, visibleIndex) =>
          event.id === selectedEventId ||
          eventTimelineCategory(event) === 'milestone' ||
          visibleIndex % 18 === 0,
      )
    : visibleEvents;
  const maxCallouts = denseMode ? 8 : zoom < 1.2 ? 14 : zoom < 2 ? 24 : zoom < 4 ? 40 : 72;
  const calloutStride = Math.max(1, Math.ceil(displayEvents.length / maxCallouts));
  const selectedVisibleIndex = displayEvents.findIndex(({ event }) => event.id === selectedEventId);
  const hitBoxes: HitBox[] = [];
  const calloutLanes = createCalloutLanes(timelineY, height, 116);
  const occupiedLanes = calloutLanes.map(() => [] as Array<{ left: number; right: number }>);

  if (denseMode) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(18, height - 34, 154, 22);
    ctx.fillStyle = '#d7ff2f';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText('KEY VIEW - ZOOM IN', 28, height - 29);
  }

  displayEvents.forEach(({ event, x }) => {
    const category = eventTimelineCategory(event);
    const color = event.color || colorForType(event.type, project.settings.typeColors) || (category === 'milestone' ? '#d7ff2f' : '#ffffff');

    if (category === 'milestone') {
      ctx.strokeStyle = '#ff3b9d';
      ctx.lineWidth = selectedEventId === event.id ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.lineTo(x, height - 34);
      ctx.stroke();
    }

    if (eventSpansMultipleDays(event) && event.endDate) {
      const endX = momentToPixel(event.endDate, '23:59', project, rangeWidth, pan);
      const spanWidth = Math.max(20, endX - x);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      roundRect(ctx, x, timelineY - 8, spanWidth, 16, 0);
      ctx.fill();
      ctx.stroke();
      hitBoxes.push({ event, x, y: timelineY - 12, width: spanWidth, height: 24 });
      return;
    }

    ctx.fillStyle = selectedEventId === event.id ? '#ff3b9d' : '#111111';
    ctx.beginPath();
    ctx.arc(x, timelineY, selectedEventId === event.id ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    hitBoxes.push({ event, x: x - 9, y: timelineY - 9, width: 18, height: 18 });
  });

  displayEvents.forEach(({ event, x }, visibleIndex) => {
    const category = eventTimelineCategory(event);
    const isSelected = selectedEventId === event.id;
    const isNearSelected =
      selectedVisibleIndex >= 0 && Math.abs(visibleIndex - selectedVisibleIndex) <= (zoom < 1.5 ? 1 : 2);
    const shouldDrawCallout =
      isSelected ||
      isNearSelected ||
      (category === 'milestone' && (!denseMode || visibleIndex % 2 === 0)) ||
      visibleIndex % calloutStride === 0;

    if (!shouldDrawCallout) return;

    const boxWidth = isSelected ? 280 : 220;
    const boxHeight = isSelected ? 116 : 96;
    const boxX = Math.max(12, Math.min(width - boxWidth - 12, x - boxWidth / 2));
    const laneIndex = findAvailableLane(occupiedLanes, boxX, boxWidth);

    if (laneIndex === -1 && !isSelected) return;

    const safeLaneIndex = laneIndex === -1 ? 0 : laneIndex;
    const laneY = calloutLanes[safeLaneIndex];
    const isTop = laneY < timelineY;
    const boxY = laneY;
    const anchorY = isTop ? boxY + boxHeight : boxY;
    const color = event.color || colorForType(event.type, project.settings.typeColors) || (category === 'milestone' ? '#d7ff2f' : '#ffffff');

    occupiedLanes[safeLaneIndex].push({ left: boxX - 10, right: boxX + boxWidth + 10 });

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, timelineY);
    ctx.lineTo(x, anchorY);
    ctx.lineTo(boxX + boxWidth / 2, anchorY);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = selectedEventId === event.id ? 4 : 2;
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111111';
    drawBoxText(ctx, event, category, boxX, boxY, boxWidth, boxHeight, isSelected);
    hitBoxes.push({ event, x: boxX, y: boxY, width: boxWidth, height: boxHeight });
  });

  if (project.settings.showTodosOnTimeline) {
    project.todos.filter(shouldDrawTodo).forEach((todo) => {
      const x = timeToPixel(todo.dueDate as string, project, rangeWidth, pan);
      ctx.fillStyle = '#11181622';
      ctx.beginPath();
      ctx.rect(x - 3, timelineY + 22, 6, 6);
      ctx.fill();
    });
  }

  hitBoxesRef.current = hitBoxes;
}

function shouldDrawTodo(todo: TimelineTodo) {
  return Boolean(todo.showOnTimeline && todo.dueDate && todo.status !== 'done');
}

function createCalloutLanes(timelineY: number, height: number, boxHeight: number) {
  const topPadding = 82;
  const bottomPadding = 62;
  const railGap = 46;
  const laneGap = 18;
  const lanes: number[] = [];

  for (let y = topPadding; y + boxHeight < timelineY - railGap; y += boxHeight + laneGap) {
    lanes.push(y);
  }

  for (let y = timelineY + railGap; y + boxHeight < height - bottomPadding; y += boxHeight + laneGap) {
    lanes.push(y);
  }

  return lanes.length ? lanes : [Math.max(topPadding, timelineY - boxHeight - railGap)];
}

function findAvailableLane(
  occupiedLanes: Array<Array<{ left: number; right: number }>>,
  boxX: number,
  boxWidth: number,
) {
  const left = boxX - 10;
  const right = boxX + boxWidth + 10;

  return occupiedLanes.findIndex((occupied) =>
    occupied.every((box) => right < box.left || left > box.right),
  );
}

function drawBoxText(
  ctx: CanvasRenderingContext2D,
  event: TimelineEvent,
  category: string,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  isSelected: boolean,
) {
  const padding = 10;
  const textWidth = boxWidth - padding * 2;
  const metaY = boxY + 10;
  const titleY = boxY + 34;
  const titleLineHeight = isSelected ? 18 : 17;
  const ownerLineHeight = 16;
  const ownerY = boxY + boxHeight - ownerLineHeight - 8;
  const maxTitleLines = Math.max(1, Math.floor((ownerY - titleY - 2) / titleLineHeight));

  ctx.save();
  ctx.beginPath();
  ctx.rect(boxX + padding, boxY + 6, textWidth, boxHeight - 12);
  ctx.clip();

  ctx.fillStyle = '#111111';
  ctx.font = '900 12px system-ui, sans-serif';
  ctx.fillText(truncateToWidth(ctx, `${event.time} / ${category}`.toUpperCase(), textWidth), boxX + padding, metaY);

  ctx.font = isSelected ? '900 14px system-ui, sans-serif' : '800 13px system-ui, sans-serif';
  const titleLines = wrapText(ctx, event.what, textWidth, isSelected ? Math.min(3, maxTitleLines) : Math.min(2, maxTitleLines));
  titleLines.forEach((line, index) => {
    ctx.fillText(line, boxX + padding, titleY + index * titleLineHeight);
  });

  if (event.who.trim()) {
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(truncateToWidth(ctx, event.who, textWidth), boxX + padding, ownerY);
  }

  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > 0 && words.length > lines.join(' ').split(/\s+/).length) {
    lines[lines.length - 1] = truncateToWidth(ctx, `${lines[lines.length - 1]}...`, maxWidth);
  }

  return lines.length ? lines : [''];
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function clampDateToProject(date: string, startDate: string, endDate: string) {
  if (date < startDate) return startDate;
  if (date > endDate) return endDate;
  return date;
}

function drawNowMarker(
  ctx: CanvasRenderingContext2D,
  project: TimelineProject,
  rangeWidth: number,
  pan: number,
  width: number,
  height: number,
  now: Date,
) {
  const today = localDateString(now);
  if (today < project.startDate || today > project.endDate) return;

  const time = localTimeString(now);
  const x = momentToPixel(today, time, project, rangeWidth, pan);
  if (x < -40 || x > width + 40) return;

  ctx.strokeStyle = '#00c2ff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, 34);
  ctx.lineTo(x, height - 38);
  ctx.stroke();

  ctx.fillStyle = '#111111';
  ctx.fillRect(Math.max(12, Math.min(width - 112, x - 56)), 48, 112, 30);
  ctx.fillStyle = '#00c2ff';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillText(`NOW ${time}`, Math.max(20, Math.min(width - 104, x - 48)), 56);
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeString(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
