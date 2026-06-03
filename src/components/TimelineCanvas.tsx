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
import { formatShortGermanDate } from '@/lib/dateFormat';
import { isTodoCompleted } from '@/lib/todos';
import type { TimelineEvent, TimelineProject, TimelineTodo } from '@/lib/types';

type TimelineCanvasProps = {
  project: TimelineProject;
  completedTodoStatus: string;
  selectedEventId?: string;
  canEdit: boolean;
  onCreateEvent: (moment: { date: string; time: string }) => void;
  onSelectEvent: (event: TimelineEvent) => void;
  onSelectTodo: (todo: TimelineTodo) => void;
  onToggleTodoOverlay: (visible: boolean) => void;
};

type HitBox = {
  event?: TimelineEvent;
  todo?: TimelineTodo;
  x: number;
  y: number;
  width: number;
  height: number;
};

type EventCalloutPlacement = {
  event: TimelineEvent;
  category: string;
  color: string;
  x: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  anchorY: number;
  isSelected: boolean;
};

type TodoMarkerPlacement = {
  todo?: TimelineTodo;
  label: string;
  x: number;
  markerX: number;
  y: number;
  markerWidth: number;
};

export function TimelineCanvas({
  project,
  completedTodoStatus,
  selectedEventId,
  canEdit,
  onCreateEvent,
  onSelectEvent,
  onSelectTodo,
  onToggleTodoOverlay,
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
    drawTimeline(ctx, rect.width, rect.height, project, completedTodoStatus, zoom, pan, selectedEventId, hiddenTypes, hiddenCategories, now, hitBoxesRef);
  }, [project, completedTodoStatus, zoom, pan, selectedEventId, hiddenTypes, hiddenCategories, now]);

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
          <div className="zoom-control-group">
            <button type="button" className="secondary" onClick={() => setZoom((current) => Math.max(0.8, current - 0.3))}>
              -
            </button>
            <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
            <button type="button" className="secondary" onClick={() => setZoom((current) => Math.min(8, current + 0.3))}>
              +
            </button>
          </div>
          <details className="mobile-control-menu timeline-mobile-menu">
            <summary>Tools</summary>
            <div className="mobile-control-panel">
              <button type="button" className="secondary today-button" onClick={panToNow}>
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
          </details>
          <div className="desktop-control-group">
            <button type="button" className="secondary today-button" onClick={panToNow}>
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
        <div className="filter-group">
          <span>Todos</span>
          <label className="check-control compact switch-control timeline-overlay-control">
            <input
              type="checkbox"
              checked={project.settings.showTodosOnTimeline}
              onChange={(event) => onToggleTodoOverlay(event.target.checked)}
            />
            <span>Overlay</span>
          </label>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className={`timeline-canvas ${project.settings.mode}`}
        onPointerDown={(event) => {
          const hit = hitBoxesRef.current.find(
            (box) =>
              event.nativeEvent.offsetX >= box.x &&
              event.nativeEvent.offsetX <= box.x + box.width &&
              event.nativeEvent.offsetY >= box.y &&
              event.nativeEvent.offsetY <= box.y + box.height,
          );

          if (hit) {
            if (hit.event) onSelectEvent(hit.event);
            if (hit.todo) onSelectTodo(hit.todo);
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
  completedTodoStatus: string,
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
    ctx.fillText(formatShortGermanDate(date), x + 9, 21);

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
  const maxCallouts = denseMode ? 8 : zoom < 1.2 ? 16 : zoom < 2 ? 28 : zoom < 4 ? 46 : 80;
  const calloutStride = Math.max(1, Math.ceil(displayEvents.length / maxCallouts));
  const selectedVisibleIndex = displayEvents.findIndex(({ event }) => event.id === selectedEventId);
  const hitBoxes: HitBox[] = [];
  const calloutLanes = createCalloutLanes(timelineY, height, 96);
  const occupiedLanes = calloutLanes.map(() => [] as Array<{ left: number; right: number }>);
  const eventCallouts: EventCalloutPlacement[] = [];
  const hasSelectedEvent = Boolean(selectedEventId);

  if (denseMode) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(18, height - 34, 154, 22);
    ctx.fillStyle = '#d7ff2f';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText('KEY VIEW - ZOOM IN', 28, height - 29);
  }

  displayEvents.forEach(({ event, x }) => {
    const category = eventTimelineCategory(event);
    const isSelected = selectedEventId === event.id;
    const isDimmed = hasSelectedEvent && !isSelected;
    const color = event.color || colorForType(event.type, project.settings.typeColors) || (category === 'milestone' ? '#d7ff2f' : '#ffffff');

    ctx.save();
    if (isDimmed) ctx.globalAlpha = 0.22;

    if (category === 'milestone') {
      ctx.strokeStyle = '#ff3b9d';
      ctx.lineWidth = isSelected ? 5 : 3;
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
      ctx.restore();
      hitBoxes.push({ event, x, y: timelineY - 12, width: spanWidth, height: 24 });
      return;
    }

    if (isSelected) {
      ctx.fillStyle = '#d7ff2f';
      ctx.beginPath();
      ctx.arc(x, timelineY, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isSelected ? '#ff3b9d' : '#111111';
    ctx.beginPath();
    ctx.arc(x, timelineY, isSelected ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

    eventCallouts.push({
      event,
      category,
      color,
      x,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      anchorY,
      isSelected,
    });
    hitBoxes.push({ event, x: boxX, y: boxY, width: boxWidth, height: boxHeight });
  });

  const layeredEventCallouts = [...eventCallouts].sort((a, b) => Number(a.isSelected) - Number(b.isSelected));

  layeredEventCallouts.forEach((callout) => {
    ctx.save();
    if (hasSelectedEvent && !callout.isSelected) ctx.globalAlpha = 0.28;
    ctx.strokeStyle = callout.isSelected ? '#ff3b9d' : '#111111';
    ctx.lineWidth = callout.isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(callout.x, timelineY);
    ctx.lineTo(callout.x, callout.anchorY);
    ctx.lineTo(callout.boxX + callout.boxWidth / 2, callout.anchorY);
    ctx.stroke();
    ctx.restore();
  });

  if (project.settings.showTodosOnTimeline) {
    const todoMarkers = planTodoMarkers(
      ctx,
      project.todos.filter((todo) => shouldDrawTodo(todo, completedTodoStatus)),
      project,
      rangeWidth,
      pan,
      timelineY,
      width,
      height,
      hitBoxes,
      calloutLanes,
      occupiedLanes,
    );

    todoMarkers.forEach((marker) => {
      ctx.save();
      if (hasSelectedEvent) ctx.globalAlpha = 0.24;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marker.x, timelineY);
      ctx.lineTo(marker.x, marker.y);
      ctx.lineTo(marker.markerX + marker.markerWidth / 2, marker.y);
      ctx.stroke();
      ctx.restore();
    });

    layeredEventCallouts.forEach(drawEventCalloutBox);
    todoMarkers.forEach(drawTodoMarkerBox);
  } else {
    layeredEventCallouts.forEach(drawEventCalloutBox);
  }

  hitBoxesRef.current = hitBoxes;

  function drawEventCalloutBox(callout: EventCalloutPlacement) {
    ctx.save();
    if (hasSelectedEvent && !callout.isSelected) ctx.globalAlpha = 0.42;
    if (callout.isSelected) {
      ctx.fillStyle = '#ff3b9d';
      roundRect(ctx, callout.boxX - 7, callout.boxY - 7, callout.boxWidth + 14, callout.boxHeight + 14, 0);
      ctx.fill();
      ctx.fillStyle = '#d7ff2f';
      roundRect(ctx, callout.boxX - 3, callout.boxY - 3, callout.boxWidth + 6, callout.boxHeight + 6, 0);
      ctx.fill();
    }

    ctx.fillStyle = callout.color;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = callout.isSelected ? 4 : 2;
    roundRect(ctx, callout.boxX, callout.boxY, callout.boxWidth, callout.boxHeight, 0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111111';
    drawBoxText(
      ctx,
      callout.event,
      callout.category,
      callout.boxX,
      callout.boxY,
      callout.boxWidth,
      callout.boxHeight,
      callout.isSelected,
    );
    ctx.restore();
  }

  function drawTodoMarkerBox(marker: TodoMarkerPlacement) {
    ctx.save();
    if (hasSelectedEvent) ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#e8fbff';
    ctx.strokeStyle = '#111111';
    ctx.setLineDash([5, 4]);
    roundRect(ctx, marker.markerX, marker.y, marker.markerWidth, 22, 0);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#111111';
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.fillText(truncateToWidth(ctx, marker.label, marker.markerWidth - 16), marker.markerX + 8, marker.y + 6);
    ctx.restore();
  }
}

function shouldDrawTodo(todo: TimelineTodo, completedTodoStatus: string) {
  return Boolean(todo.showOnTimeline && todo.dueDate && !isTodoCompleted(todo, completedTodoStatus));
}

function planTodoMarkers(
  ctx: CanvasRenderingContext2D,
  todos: TimelineTodo[],
  project: TimelineProject,
  rangeWidth: number,
  pan: number,
  timelineY: number,
  width: number,
  height: number,
  hitBoxes: HitBox[],
  sharedLanes: number[],
  sharedOccupiedLanes: Array<Array<{ left: number; right: number }>>,
) {
  const todosByDate = new Map<string, TimelineTodo[]>();
  const markers: TodoMarkerPlacement[] = [];

  todos.forEach((todo) => {
    if (!todo.dueDate) return;
    todosByDate.set(todo.dueDate, [...(todosByDate.get(todo.dueDate) ?? []), todo]);
  });

  [...todosByDate.entries()]
    .map(([date, dateTodos]) => ({
      date,
      dateTodos,
      x: momentToPixel(date, '12:00', project, rangeWidth, pan),
    }))
    .filter(({ x }) => x > -120 && x < width + 120)
    .sort((a, b) => a.x - b.x)
    .forEach(({ dateTodos, x }) => {
      const firstTitle = dateTodos[0]?.title ?? 'Todo';
      const label = dateTodos.length > 1 ? `${dateTodos.length}x ${firstTitle}` : firstTitle;
      const markerWidth = Math.min(180, Math.max(86, ctx.measureText(label).width + 18));
      const markerX = Math.max(8, Math.min(width - markerWidth - 8, x - markerWidth / 2));
      const laneIndex = findAvailableLane(sharedOccupiedLanes, markerX, markerWidth);

      if (laneIndex === -1) return;

      const eventLaneY = sharedLanes[laneIndex];
      const y = eventLaneY < timelineY ? eventLaneY + 106 : eventLaneY - 34;
      if (y < 56 || y > height - 56) return;

      sharedOccupiedLanes[laneIndex].push({ left: markerX - 8, right: markerX + markerWidth + 8 });

      markers.push({ todo: dateTodos[0], label, x, markerX, y, markerWidth });
      if (dateTodos[0]) {
        hitBoxes.push({ todo: dateTodos[0], x: markerX, y, width: markerWidth, height: 22 });
      }
    });

  return markers;
}

function createCalloutLanes(timelineY: number, height: number, boxHeight: number) {
  const topPadding = 82;
  const bottomPadding = 48;
  const railGap = 34;
  const laneGap = 12;
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
