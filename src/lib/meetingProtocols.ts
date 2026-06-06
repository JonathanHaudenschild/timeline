import type { MeetingProtocol, MeetingProtocolItem } from './types';
import { mergeTimelineComments, normalizeTimelineComments } from './comments';

const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const shortWeekdayNames = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const defaultProtocolTitle = 'Tägliches Platz-Plenum';

export const defaultProtocolInstructionTemplate = `{title}
---------------------------------------------------------------------------------------------------------------------
Tägliches Platz-Plenum | Datum: {date} | Dauer: {duration}
Moderation: NAME | Protokoll: NAME | Todo-person: NAME

Begrüßung & Rahmen
Guten Morgen, ich moderiere heute das Plenum möglichst zügig & strukturiert.
Wer schreibt heute Protokoll? Wer ist heute Todo-person?
Optional: kurze Vorstellungsrunde mit Name, Pronomen & Stress-/Laune-Barometer
Ich stelle kurz Ablauf & Struktur vor: Ziel: Plenum max. 1 Stunde
Bitte lasst einander ausreden & bleibt beim Thema
Bei Bedarf nutzen wir eine Redner:innen-Liste
Den Link zum Protokoll findet ihr im SCC-Wiki: Themen fürs nächste Plenum bitte möglichst früh dort eintragen

Struktur des Plenums
1. Updates: Kurze relevante Infos ohne Diskussion | Richtwert: max. 15 Minuten
Falls Redebedarf entsteht → in den Themen-Block schieben
2. Themen: Gemeinsame Themen & Diskussionen | Richtwert: max. 10 Minuten pro Thema
Beim Thema bleiben | Lange Diskussionen ggf. auslagern | Entstehende To-Dos direkt mitschreiben
3. To-Dos: Gemeinsame Sichtung & Planung | Decks: https://cloud.kuko-crews.org/apps/deck/board/433/
Erst Alte To-Dos vorlesen: Wie ist der Stand? Wer kümmert sich? Wird Unterstützung gebraucht?
Danach Neue To-Dos sammeln & verteilen: Verantwortlichkeiten klären & Deadlines festlegen

——————————————           END Plenum {endDate}.       —————————————`;

export type ProtocolHeadline = {
  id: string;
  lineIndex: number;
  text: string;
  excerpt: string;
};

export type ProtocolItemKind = 'updates' | 'topics' | 'todos';

type MeetingProtocolInput = Partial<Omit<MeetingProtocol, ProtocolItemKind>> & {
  updates?: readonly Partial<MeetingProtocolItem>[];
  topics?: readonly Partial<MeetingProtocolItem>[];
  todos?: readonly Partial<MeetingProtocolItem>[];
};

export function normalizeMeetingProtocols(protocols: readonly MeetingProtocolInput[] | undefined) {
  if (!Array.isArray(protocols)) return [];

  return protocols
    .filter((protocol) => protocol && typeof protocol === 'object')
    .map((protocol, index) => {
      const date = normalizeProtocolDate(protocol.date) || localDateString(new Date());
      const time = normalizeProtocolTime(protocol.time);
      const title = protocol.title && protocol.title.trim() ? protocol.title : defaultProtocolTitle;
      const now = new Date().toISOString();

      return {
        id: protocol.id?.trim() || `protocol-${index + 1}`,
        title,
        date,
        time,
        durationSeconds: normalizeProtocolDuration(protocol.durationSeconds),
        timerStartedAt: normalizeProtocolTimestamp(protocol.timerStartedAt),
        moderation: protocol.moderation?.trim() || '',
        protocolWriter: protocol.protocolWriter?.trim() || '',
        todoOwner: protocol.todoOwner?.trim() || '',
        updates: removeGeneratedProtocolItemConflictDuplicates(normalizeProtocolItems(protocol.updates, 'Update')),
        topics: removeGeneratedProtocolItemConflictDuplicates(normalizeProtocolItems(protocol.topics, 'Thema')),
        todos: removeGeneratedProtocolItemConflictDuplicates(normalizeProtocolItems(protocol.todos, 'To-Do')),
        body: protocol.body ?? '',
        createdAt: protocol.createdAt || now,
        updatedAt: protocol.updatedAt || protocol.createdAt || now,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export function createMeetingProtocol(date?: string, time?: string): MeetingProtocol {
  const currentDate = new Date();
  const normalizedDate = normalizeProtocolDate(date) || localDateString(currentDate);
  const normalizedTime = normalizeProtocolTime(time) || localTimeString(currentDate);
  const now = currentDate.toISOString();

  return {
    id: crypto.randomUUID(),
    title: defaultProtocolTitle,
    date: normalizedDate,
    time: normalizedTime,
    durationSeconds: 0,
    timerStartedAt: undefined,
    moderation: '',
    protocolWriter: '',
    todoOwner: '',
    updates: [],
    topics: [],
    todos: [],
    body: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createProtocolItem(kind: ProtocolItemKind, index: number): MeetingProtocolItem {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: `${protocolItemLabel(kind)} ${index}`,
    owner: '',
    body: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function moveProtocolItem(
  protocol: MeetingProtocol,
  fromKind: ProtocolItemKind,
  itemId: string,
  toKind: ProtocolItemKind,
  targetItemId?: string,
  updatedAt = new Date().toISOString(),
) {
  const movingItem = protocol[fromKind].find((item) => item.id === itemId);
  if (!movingItem) return protocol;
  if (fromKind === toKind && itemId === targetItemId) return protocol;

  const movedItem = {
    ...movingItem,
    updatedAt,
  };
  const nextFromItems = protocol[fromKind].filter((item) => item.id !== itemId);
  const targetItems = fromKind === toKind ? nextFromItems : protocol[toKind];
  const targetIndex = targetItemId ? targetItems.findIndex((item) => item.id === targetItemId) : -1;
  const insertIndex = targetIndex >= 0 ? targetIndex : targetItems.length;
  const nextTargetItems = [
    ...targetItems.slice(0, insertIndex),
    movedItem,
    ...targetItems.slice(insertIndex),
  ];

  return {
    ...protocol,
    [fromKind]: fromKind === toKind ? nextTargetItems : nextFromItems,
    [toKind]: nextTargetItems,
    updatedAt,
  };
}

export function protocolTitle(date: string, time = '') {
  return [weekdayName(date), formatProtocolDate(date), normalizeProtocolTime(time)].filter(Boolean).join(' ');
}

export function createMeetingProtocolInstruction(
  date: string,
  durationSeconds = 0,
  template = defaultProtocolInstructionTemplate,
) {
  const longDate = formatProtocolDate(date);
  const shortDate = `${shortWeekdayName(date)} ${longDate}`;
  const displayDuration = formatProtocolDuration(durationSeconds);

  return (template.trim() ? template : defaultProtocolInstructionTemplate)
    .replaceAll('{title}', defaultProtocolTitle)
    .replaceAll('{date}', shortDate)
    .replaceAll('{duration}', displayDuration)
    .replaceAll('{endDate}', longDate);
}

export const createMeetingProtocolTemplate = createMeetingProtocolInstruction;

export function formatProtocolDuration(durationSeconds: number) {
  const seconds = normalizeProtocolDuration(durationSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function extractProtocolHeadlines(body: string) {
  const lines = body.split('\n');
  const headlineIndexes = lines
    .map((line, lineIndex) => ({ line: line.trim(), lineIndex }))
    .filter(({ line }) => isProtocolHeadline(line))
    .map(({ line, lineIndex }) => ({ line: stripMarkdownHeading(line), lineIndex }));

  return headlineIndexes.map(({ line, lineIndex }, index) => {
    const nextLineIndex = headlineIndexes[index + 1]?.lineIndex ?? lines.length;
    const excerpt = lines
      .slice(lineIndex + 1, nextLineIndex)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join('\n');

    return {
      id: `${lineIndex}-${slugify(line)}`,
      lineIndex,
      text: line,
      excerpt,
    };
  });
}

export function protocolItemConversionBody(
  protocol: MeetingProtocol,
  kind: ProtocolItemKind,
  item: MeetingProtocolItem,
) {
  const parts = [
    `Protocol: ${protocol.title}`,
    `Date: ${protocol.date}`,
    `Duration: ${formatProtocolDuration(protocol.durationSeconds)}`,
    `Section: ${protocolItemLabel(kind)}`,
    item.owner ? `Owner: ${item.owner}` : '',
    item.body || item.title,
  ].filter(Boolean);

  return parts.join('\n\n');
}

export function protocolConversionBody(protocol: MeetingProtocol, headline?: ProtocolHeadline) {
  const structuredBody = [
    sectionMarkdown('Updates', protocol.updates),
    sectionMarkdown('Themen', protocol.topics),
    sectionMarkdown('To-Dos', protocol.todos),
    protocol.body ? `## Notes\n\n${protocol.body}` : '',
  ].filter(Boolean).join('\n\n');
  const parts = [
    `Protocol: ${protocol.title}`,
    `Date: ${protocol.date}`,
    `Duration: ${formatProtocolDuration(protocol.durationSeconds)}`,
    headline ? `Headline: ${headline.text}` : '',
    headline?.excerpt || structuredBody,
  ].filter(Boolean);

  return parts.join('\n\n');
}

export function protocolItemLabel(kind: ProtocolItemKind) {
  if (kind === 'updates') return 'Update';
  if (kind === 'topics') return 'Thema';
  return 'To-Do';
}

export function mergeMeetingProtocols(
  baseProtocols: MeetingProtocol[],
  localProtocols: MeetingProtocol[],
  remoteProtocols: MeetingProtocol[],
) {
  const mergedProtocols = mergeById(baseProtocols, localProtocols, remoteProtocols);

  return mergedProtocols.map((protocol) => {
    const baseProtocol = baseProtocols.find((item) => item.id === protocol.id);
    const localProtocol = localProtocols.find((item) => item.id === protocol.id);
    const remoteProtocol = remoteProtocols.find((item) => item.id === protocol.id);
    if (!baseProtocol || !localProtocol || !remoteProtocol) return protocol;

    return {
      ...protocol,
      title: changed(baseProtocol.title, localProtocol.title) ? localProtocol.title : remoteProtocol.title,
      date: changed(baseProtocol.date, localProtocol.date) ? localProtocol.date : remoteProtocol.date,
      time: changed(baseProtocol.time, localProtocol.time) ? localProtocol.time : remoteProtocol.time,
      durationSeconds: changed(baseProtocol.durationSeconds, localProtocol.durationSeconds)
        ? localProtocol.durationSeconds
        : remoteProtocol.durationSeconds,
      timerStartedAt: changed(baseProtocol.timerStartedAt, localProtocol.timerStartedAt)
        ? localProtocol.timerStartedAt
        : remoteProtocol.timerStartedAt,
      moderation: changed(baseProtocol.moderation, localProtocol.moderation)
        ? localProtocol.moderation
        : remoteProtocol.moderation,
      protocolWriter: changed(baseProtocol.protocolWriter, localProtocol.protocolWriter)
        ? localProtocol.protocolWriter
        : remoteProtocol.protocolWriter,
      todoOwner: changed(baseProtocol.todoOwner, localProtocol.todoOwner)
        ? localProtocol.todoOwner
        : remoteProtocol.todoOwner,
      body: mergeProtocolBody(baseProtocol.body, localProtocol.body, remoteProtocol.body),
      updates: mergeProtocolItems(baseProtocol.updates, localProtocol.updates, remoteProtocol.updates),
      topics: mergeProtocolItems(baseProtocol.topics, localProtocol.topics, remoteProtocol.topics),
      todos: mergeProtocolItems(baseProtocol.todos, localProtocol.todos, remoteProtocol.todos),
      updatedAt: latestString(localProtocol.updatedAt, remoteProtocol.updatedAt),
    };
  });
}

function normalizeProtocolItems(
  items: readonly Partial<MeetingProtocolItem>[] | undefined,
  fallbackTitle: string,
) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const now = new Date().toISOString();

    return {
      id: item.id?.trim() || `${fallbackTitle.toLowerCase()}-${index + 1}`,
      title: item.title && item.title.trim() ? item.title : `${fallbackTitle} ${index + 1}`,
      owner: item.owner?.trim() || '',
      body: item.body ?? '',
      convertedTodoId: item.convertedTodoId?.trim() || undefined,
      convertedEventId: item.convertedEventId?.trim() || undefined,
      comments: normalizeTimelineComments(item.comments),
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || item.createdAt || now,
    };
  });
}

function sectionMarkdown(title: string, items: MeetingProtocolItem[]) {
  if (!items.length) return '';

  return [
    `## ${title}`,
    ...items.map((item) => [
      `### ${item.title}`,
      item.owner ? `Owner: ${item.owner}` : '',
      item.body,
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}

function isProtocolHeadline(line: string) {
  if (!line || line.length > 120) return false;
  if (/^-{5,}$/.test(line)) return false;

  return (
    /^#{1,6}\s+\S/.test(line) ||
    /^(Tägliches Platz-Plenum|Begrüßung & Rahmen|Struktur des Plenums)/.test(line) ||
    /^\d+\.\s+(Updates|Themen|To-Dos)\b/i.test(line) ||
    /^(Update|Thema)\s+\d+\b/i.test(line) ||
    /^(Alte|Neue)\s+To-Dos\b/i.test(line) ||
    /^Samstag\s+\d{2}\.\d{2}\.\d{2}$/i.test(line)
  );
}

function stripMarkdownHeading(line: string) {
  return line.replace(/^#{1,6}\s+/, '').trim();
}

function normalizeProtocolDate(date: string | undefined) {
  if (!date) return '';
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return date;

  const german = date.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/);
  if (!german) return '';

  const [, day, month, year] = german;
  return `${year.length === 2 ? `20${year}` : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeProtocolTime(time: string | undefined) {
  if (!time) return '';
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeProtocolDuration(durationSeconds: number | undefined) {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) return 0;
  return Math.max(0, Math.floor(durationSeconds));
}

function normalizeProtocolTimestamp(timestamp: string | undefined) {
  if (!timestamp) return undefined;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function weekdayName(date: string) {
  return weekdayNames[dateToNoon(date).getDay()];
}

function shortWeekdayName(date: string) {
  return shortWeekdayNames[dateToNoon(date).getDay()];
}

function formatProtocolDate(date: string) {
  const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return year ? `${day}.${month}.${year.slice(2)}` : date;
}

function dateToNoon(date: string) {
  return new Date(`${date}T12:00:00`);
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localTimeString(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

function mergeById<T extends { id: string }>(
  baseItems: readonly T[],
  localItems: readonly T[],
  remoteItems: readonly T[],
) {
  const result = new Map(remoteItems.map((item) => [item.id, item]));
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));
  const localOrderChanged = idsChanged(baseItems, localItems);

  for (const [id, localItem] of localById) {
    const baseItem = baseById.get(id);
    if (!baseItem || changed(baseItem, localItem)) {
      result.set(id, localItem);
    }
  }

  for (const [id, baseItem] of baseById) {
    if (localById.has(id)) continue;
    const remoteItem = result.get(id);
    if (!remoteItem || !changed(baseItem, remoteItem)) result.delete(id);
  }

  if (!localOrderChanged) return [...result.values()];

  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const item of localItems) {
    const resultItem = result.get(item.id);
    if (!resultItem) continue;

    ordered.push(resultItem);
    seen.add(item.id);
  }

  for (const item of result.values()) {
    if (!seen.has(item.id)) ordered.push(item);
  }

  return ordered;
}

function mergeProtocolItems(
  baseItems: readonly MeetingProtocolItem[],
  localItems: readonly MeetingProtocolItem[],
  remoteItems: readonly MeetingProtocolItem[],
) {
  const result = new Map(remoteItems.map((item) => [item.id, item]));
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));
  const localOrderChanged = idsChanged(baseItems, localItems);

  for (const [id, localItem] of localById) {
    const baseItem = baseById.get(id);
    const remoteItem = result.get(id);
    if (
      baseItem &&
      remoteItem &&
      changed(baseItem, localItem) &&
      changed(baseItem, remoteItem) &&
      changed(localItem, remoteItem)
    ) {
      result.set(id, mergeProtocolItem(baseItem, localItem, remoteItem));
    } else if (!baseItem || changed(baseItem, localItem)) {
      result.set(id, localItem);
    }
  }

  for (const [id, baseItem] of baseById) {
    if (localById.has(id)) continue;
    const remoteItem = result.get(id);
    if (!remoteItem || !changed(baseItem, remoteItem)) result.delete(id);
  }

  if (!localOrderChanged) return [...result.values()];

  const ordered: MeetingProtocolItem[] = [];
  const seen = new Set<string>();
  for (const item of localItems) {
    const resultItem = result.get(item.id);
    if (!resultItem) continue;

    ordered.push(resultItem);
    seen.add(item.id);
  }

  for (const item of result.values()) {
    if (!seen.has(item.id)) ordered.push(item);
  }

  return ordered;
}

function mergeProtocolItem(
  baseItem: MeetingProtocolItem,
  localItem: MeetingProtocolItem,
  remoteItem: MeetingProtocolItem,
): MeetingProtocolItem {
  return {
    ...remoteItem,
    title: mergeProtocolChoiceField(baseItem.title, localItem.title, remoteItem.title, localItem, remoteItem),
    owner: mergeProtocolChoiceField(baseItem.owner, localItem.owner, remoteItem.owner, localItem, remoteItem),
    body: mergeProtocolBody(baseItem.body, localItem.body, remoteItem.body),
    convertedTodoId: mergeProtocolChoiceField(
      baseItem.convertedTodoId,
      localItem.convertedTodoId,
      remoteItem.convertedTodoId,
      localItem,
      remoteItem,
    ),
    convertedEventId: mergeProtocolChoiceField(
      baseItem.convertedEventId,
      localItem.convertedEventId,
      remoteItem.convertedEventId,
      localItem,
      remoteItem,
    ),
    comments: mergeTimelineComments(baseItem.comments, localItem.comments, remoteItem.comments),
    updatedAt: latestString(localItem.updatedAt, remoteItem.updatedAt),
  };
}

function mergeProtocolChoiceField<T>(
  baseValue: T,
  localValue: T,
  remoteValue: T,
  localItem: MeetingProtocolItem,
  remoteItem: MeetingProtocolItem,
) {
  const localChanged = changed(baseValue, localValue);
  const remoteChanged = changed(baseValue, remoteValue);
  if (localChanged && remoteChanged && changed(localValue, remoteValue)) {
    return localItem.updatedAt >= remoteItem.updatedAt ? localValue : remoteValue;
  }

  return localChanged ? localValue : remoteValue;
}

function idsChanged(left: readonly { id: string }[], right: readonly { id: string }[]) {
  if (left.length !== right.length) return true;
  return left.some((item, index) => item.id !== right[index]?.id);
}

function mergeProtocolBody(baseBody: string, localBody: string, remoteBody: string) {
  const localChanged = changed(baseBody, localBody);
  const remoteChanged = changed(baseBody, remoteBody);
  if (localChanged && remoteChanged && localBody !== remoteBody) {
    return `${localBody}\n\n--- Version from another device ---\n\n${remoteBody}`;
  }

  return localChanged ? localBody : remoteBody;
}

function removeGeneratedProtocolItemConflictDuplicates(items: MeetingProtocolItem[]) {
  const itemIds = new Set(items.map((item) => item.id));

  return items.filter((item) => {
    const originalId = generatedProtocolItemConflictOriginalId(item.id);
    return !originalId || !itemIds.has(originalId);
  });
}

function generatedProtocolItemConflictOriginalId(itemId: string) {
  const match = itemId.match(/^(.+)-other-device(?:-\d+)?$/);
  return match?.[1];
}

function latestString(left: string, right: string) {
  return left > right ? left : right;
}

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}
