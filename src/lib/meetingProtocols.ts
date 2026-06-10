import type { MeetingProtocol, MeetingProtocolItem, ProtocolCustomSection } from './types';
import { mergeTimelineComments, normalizeTimelineComments } from './comments';

const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const shortWeekdayNames = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const defaultProtocolTitle = 'Tägliches Platz-Plenum';

export const defaultProtocolInstructionTemplate = `
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

export type ProtocolItemKind = string;

export const defaultProtocolSectionKinds = ['updates', 'topics', 'todos'] as const;

type DefaultProtocolKind = typeof defaultProtocolSectionKinds[number];

const protocolItemKinds = ['updates', 'topics', 'todos'] as const;

type MeetingProtocolInput = Partial<Omit<MeetingProtocol, 'updates' | 'topics' | 'todos'>> & {
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
        sectionNames: normalizeProtocolSectionNames(protocol.sectionNames),
        sectionColors: normalizeProtocolSectionColors(protocol.sectionColors),
        customSections: normalizeProtocolCustomSections(protocol.customSections),
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

export function seedRecurringProtocolItems(
  protocol: MeetingProtocol,
  sourceProtocols: readonly MeetingProtocol[],
): MeetingProtocol {
  const latestBySource = new Map<string, { kind: DefaultProtocolKind; item: MeetingProtocolItem; protocol: MeetingProtocol }>();
  const targetKey = protocolScheduleKey(protocol);

  for (const sourceProtocol of sourceProtocols) {
    if (protocolScheduleKey(sourceProtocol) >= targetKey) continue;

    for (const kind of protocolItemKinds) {
      for (const item of sourceProtocol[kind]) {
        const sourceId = item.recurringSourceId ?? (item.recurring ? item.id : '');
        if (!sourceId) continue;

        const current = latestBySource.get(sourceId);
        if (!current || protocolScheduleKey(sourceProtocol) >= protocolScheduleKey(current.protocol)) {
          latestBySource.set(sourceId, { kind, item, protocol: sourceProtocol });
        }
      }
    }
  }

  const now = new Date().toISOString();
  const nextProtocol = { ...protocol };

  for (const { kind, item } of latestBySource.values()) {
    if (!item.recurring) continue;

    nextProtocol[kind] = [
      ...nextProtocol[kind],
      {
        id: crypto.randomUUID(),
        title: item.title,
        owner: item.owner,
        body: item.body,
        recurring: true,
        recurringSourceId: item.recurringSourceId ?? item.id,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  return nextProtocol;
}

export function toggleRecurringProtocolItem(
  protocols: readonly MeetingProtocol[],
  protocolId: string,
  kind: DefaultProtocolKind,
  itemId: string,
  updatedAt = new Date().toISOString(),
) {
  const sourceProtocol = protocols.find((protocol) => protocol.id === protocolId);
  const sourceItem = sourceProtocol?.[kind].find((item) => item.id === itemId);
  if (!sourceProtocol || !sourceItem) return [...protocols];

  const nextRecurring = !sourceItem.recurring;
  const sourceId = sourceItem.recurringSourceId ?? sourceItem.id;
  const updatedItem = {
    ...sourceItem,
    recurring: nextRecurring,
    recurringSourceId: sourceId,
    updatedAt,
  };
  const nextProtocols = protocols.map((protocol) =>
    protocol.id === protocolId
      ? {
          ...protocol,
          [kind]: protocol[kind].map((item) => (item.id === itemId ? updatedItem : item)),
          updatedAt,
        }
      : protocol,
  );

  if (!nextRecurring) return stopFutureRecurringProtocolItems(nextProtocols, protocolId, sourceId, updatedAt);

  return populateFutureRecurringProtocolItems(nextProtocols, protocolId, kind, updatedItem, updatedAt);
}

export function populateFutureRecurringProtocolItems(
  protocols: readonly MeetingProtocol[],
  sourceProtocolId: string,
  kind: DefaultProtocolKind,
  sourceItem: MeetingProtocolItem,
  updatedAt = new Date().toISOString(),
) {
  const sourceProtocol = protocols.find((protocol) => protocol.id === sourceProtocolId);
  const sourceId = sourceItem.recurringSourceId ?? sourceItem.id;
  if (!sourceProtocol || !sourceId || !sourceItem.recurring) return [...protocols];

  const nextById = new Map(protocols.map((protocol) => [protocol.id, protocol]));
  let templateKind = kind;
  let templateItem = sourceItem;
  const sourceKey = protocolScheduleKey(sourceProtocol);
  const futureProtocols = [...protocols]
    .filter((protocol) => protocol.id !== sourceProtocolId && protocolScheduleKey(protocol) > sourceKey)
    .sort((left, right) => protocolScheduleKey(left).localeCompare(protocolScheduleKey(right)));

  for (const protocol of futureProtocols) {
    const currentProtocol = nextById.get(protocol.id) ?? protocol;
    const existing = findRecurringProtocolItem(currentProtocol, sourceId);
    if (existing) {
      templateKind = existing.kind;
      templateItem = existing.item;
      if (!existing.item.recurring) {
        const reenabledItem = { ...existing.item, recurring: true, updatedAt };
        nextById.set(protocol.id, {
          ...currentProtocol,
          [templateKind]: currentProtocol[templateKind].map((i) => (i.id === existing.item.id ? reenabledItem : i)),
          updatedAt,
        });
        templateItem = reenabledItem;
      }
      continue;
    }

    const copy = {
      id: crypto.randomUUID(),
      title: templateItem.title,
      owner: templateItem.owner,
      body: templateItem.body,
      recurring: true,
      recurringSourceId: sourceId,
      createdAt: updatedAt,
      updatedAt,
    };

    nextById.set(protocol.id, {
      ...currentProtocol,
      [templateKind]: [...currentProtocol[templateKind], copy],
      updatedAt,
    });
    templateItem = copy;
  }

  return protocols.map((protocol) => nextById.get(protocol.id) ?? protocol);
}

function findRecurringProtocolItem(protocol: MeetingProtocol, sourceId: string) {
  for (const kind of protocolItemKinds) {
    const item = protocol[kind].find((entry) => (entry.recurringSourceId ?? (entry.recurring ? entry.id : '')) === sourceId);
    if (item) return { kind, item };
  }

  return undefined;
}

function stopFutureRecurringProtocolItems(
  protocols: readonly MeetingProtocol[],
  sourceProtocolId: string,
  sourceId: string,
  updatedAt: string,
) {
  const sourceProtocol = protocols.find((protocol) => protocol.id === sourceProtocolId);
  if (!sourceProtocol) return [...protocols];

  const sourceKey = protocolScheduleKey(sourceProtocol);

  return protocols.map((protocol) => {
    if (protocol.id === sourceProtocolId || protocolScheduleKey(protocol) <= sourceKey) return protocol;

    let changed = false;
    const nextProtocol = { ...protocol };

    for (const kind of protocolItemKinds) {
      nextProtocol[kind] = nextProtocol[kind].map((item) => {
        const itemSourceId = item.recurringSourceId ?? (item.recurring ? item.id : '');
        if (itemSourceId !== sourceId || !item.recurring) return item;

        changed = true;
        return {
          ...item,
          recurring: false,
          updatedAt,
        };
      });
    }

    return changed ? { ...nextProtocol, updatedAt } : protocol;
  });
}

export function createProtocolItem(sectionName: string, index: number): MeetingProtocolItem {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: `${sectionName} ${index}`,
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
  const fromItems = getProtocolSectionItems(protocol, fromKind);
  const movingItem = fromItems.find((item) => item.id === itemId);
  if (!movingItem) return protocol;
  if (fromKind === toKind && itemId === targetItemId) return protocol;

  const movedItem = {
    ...movingItem,
    updatedAt,
  };
  const nextFromItems = fromItems.filter((item) => item.id !== itemId);
  const targetItems = fromKind === toKind ? nextFromItems : getProtocolSectionItems(protocol, toKind);
  const targetIndex = targetItemId ? targetItems.findIndex((item) => item.id === targetItemId) : -1;
  const insertIndex = targetIndex >= 0 ? targetIndex : targetItems.length;
  const nextTargetItems = [
    ...targetItems.slice(0, insertIndex),
    movedItem,
    ...targetItems.slice(insertIndex),
  ];

  const fromPatch = getProtocolSectionPatch(protocol, fromKind, fromKind === toKind ? nextTargetItems : nextFromItems);
  const toPatch = fromKind === toKind ? {} : getProtocolSectionPatch(protocol, toKind, nextTargetItems);

  return {
    ...protocol,
    ...fromPatch,
    ...toPatch,
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
    protocol.time ? `Time: ${protocol.time}` : '',
    `Duration: ${formatProtocolDuration(protocol.durationSeconds)}`,
    `Section: ${getSectionDisplayName(protocol, kind)}`,
    item.owner ? `Owner: ${item.owner}` : '',
    item.body || item.title,
  ].filter(Boolean);

  return parts.join('\n\n');
}

export function protocolConversionBody(protocol: MeetingProtocol, headline?: ProtocolHeadline) {
  const structuredBody = [
    sectionMarkdown(protocol.sectionNames?.updates ?? 'Updates', protocol.updates),
    sectionMarkdown(protocol.sectionNames?.topics ?? 'Themen', protocol.topics),
    sectionMarkdown(protocol.sectionNames?.todos ?? 'To-Dos', protocol.todos),
    ...(protocol.customSections ?? []).map((s) => sectionMarkdown(s.name, s.items)),
    protocol.body ? `## Notes\n\n${protocol.body}` : '',
  ].filter(Boolean).join('\n\n');
  const parts = [
    `Protocol: ${protocol.title}`,
    `Date: ${protocol.date}`,
    protocol.time ? `Time: ${protocol.time}` : '',
    `Duration: ${formatProtocolDuration(protocol.durationSeconds)}`,
    headline ? `Headline: ${headline.text}` : '',
    headline?.excerpt || structuredBody,
  ].filter(Boolean);

  return parts.join('\n\n');
}

export function protocolItemLabel(kind: ProtocolItemKind) {
  if (kind === 'updates') return 'Update';
  if (kind === 'topics') return 'Thema';
  if (kind === 'todos') return 'To-Do';
  return 'Item';
}

export function getProtocolSectionItems(protocol: MeetingProtocol, kind: string): MeetingProtocolItem[] {
  if (kind === 'updates' || kind === 'topics' || kind === 'todos') {
    return protocol[kind] as MeetingProtocolItem[];
  }
  return protocol.customSections?.find((s) => s.id === kind)?.items ?? [];
}

export function getProtocolSectionPatch(protocol: MeetingProtocol, kind: string, items: MeetingProtocolItem[]): Partial<MeetingProtocol> {
  if (kind === 'updates' || kind === 'topics' || kind === 'todos') {
    return { [kind]: items };
  }
  return {
    customSections: (protocol.customSections ?? []).map((s) =>
      s.id === kind ? { ...s, items } : s,
    ),
  };
}

export function getSectionDisplayName(protocol: MeetingProtocol, kind: string): string {
  if (kind === 'updates') return protocol.sectionNames?.updates ?? 'Updates';
  if (kind === 'topics') return protocol.sectionNames?.topics ?? 'Topics';
  if (kind === 'todos') return protocol.sectionNames?.todos ?? 'To-Dos';
  return protocol.customSections?.find((s) => s.id === kind)?.name ?? kind;
}

export function renameProtocolSection(
  protocol: MeetingProtocol,
  kind: string,
  name: string,
  now = new Date().toISOString(),
): MeetingProtocol {
  if (kind === 'updates' || kind === 'topics' || kind === 'todos') {
    return {
      ...protocol,
      sectionNames: { ...protocol.sectionNames, [kind]: name },
      updatedAt: now,
    };
  }
  return {
    ...protocol,
    customSections: (protocol.customSections ?? []).map((s) =>
      s.id === kind ? { ...s, name } : s,
    ),
    updatedAt: now,
  };
}

export function addProtocolSection(
  protocol: MeetingProtocol,
  name: string,
  now = new Date().toISOString(),
): MeetingProtocol {
  const newSection: ProtocolCustomSection = {
    id: crypto.randomUUID(),
    name,
    items: [],
  };
  return {
    ...protocol,
    customSections: [...(protocol.customSections ?? []), newSection],
    updatedAt: now,
  };
}

export function deleteProtocolSection(
  protocol: MeetingProtocol,
  kind: string,
  now = new Date().toISOString(),
): MeetingProtocol {
  if (kind === 'updates' || kind === 'topics' || kind === 'todos') return protocol;
  return {
    ...protocol,
    customSections: (protocol.customSections ?? []).filter((s) => s.id !== kind),
    updatedAt: now,
  };
}

export function getSectionColor(protocol: MeetingProtocol, kind: string): string | undefined {
  if (kind === 'updates') return protocol.sectionColors?.updates;
  if (kind === 'topics') return protocol.sectionColors?.topics;
  if (kind === 'todos') return protocol.sectionColors?.todos;
  return protocol.customSections?.find((s) => s.id === kind)?.color;
}

export function setProtocolSectionColor(
  protocol: MeetingProtocol,
  kind: string,
  color: string,
  now = new Date().toISOString(),
): MeetingProtocol {
  if (kind === 'updates' || kind === 'topics' || kind === 'todos') {
    return {
      ...protocol,
      sectionColors: { ...protocol.sectionColors, [kind]: color },
      updatedAt: now,
    };
  }
  return {
    ...protocol,
    customSections: (protocol.customSections ?? []).map((s) =>
      s.id === kind ? { ...s, color } : s,
    ),
    updatedAt: now,
  };
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
      ...mergeProtocolSections(baseProtocol, localProtocol, remoteProtocol),
      sectionNames: mergeProtocolSectionStringRecord(baseProtocol.sectionNames, localProtocol.sectionNames, remoteProtocol.sectionNames),
      sectionColors: mergeProtocolSectionStringRecord(baseProtocol.sectionColors, localProtocol.sectionColors, remoteProtocol.sectionColors),
      customSections: mergeCustomSections(baseProtocol.customSections ?? [], localProtocol.customSections ?? [], remoteProtocol.customSections ?? []),
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
      recurring: Boolean(item.recurring),
      recurringSourceId: item.recurringSourceId?.trim() || undefined,
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

function protocolScheduleKey(protocol: MeetingProtocol) {
  return `${protocol.date}T${protocol.time || '00:00'}:${protocol.createdAt}`;
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

function mergeProtocolSections(
  baseProtocol: MeetingProtocol,
  localProtocol: MeetingProtocol,
  remoteProtocol: MeetingProtocol,
): Record<ProtocolItemKind, MeetingProtocolItem[]> {
  const baseById = protocolItemPositions(baseProtocol);
  const localById = protocolItemPositions(localProtocol);
  const remoteById = protocolItemPositions(remoteProtocol);
  const mergedById = new Map<string, { kind: ProtocolItemKind; item: MeetingProtocolItem }>();
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);

  for (const id of ids) {
    const basePosition = baseById.get(id);
    const localPosition = localById.get(id);
    const remotePosition = remoteById.get(id);

    if (!basePosition) {
      const addedPosition = localPosition ?? remotePosition;
      if (addedPosition) mergedById.set(id, { kind: addedPosition.kind, item: addedPosition.item });
      continue;
    }

    const baseItem = basePosition.item;
    if (!localPosition && !remotePosition) continue;

    if (!localPosition) {
      if (
        remotePosition &&
        (remotePosition.kind !== basePosition.kind || changed(baseItem, remotePosition.item))
      ) {
        mergedById.set(id, { kind: remotePosition.kind, item: remotePosition.item });
      }
      continue;
    }

    if (!remotePosition) {
      if (localPosition.kind !== basePosition.kind || changed(baseItem, localPosition.item)) {
        mergedById.set(id, { kind: localPosition.kind, item: localPosition.item });
      }
      continue;
    }

    const localChanged = changed(baseItem, localPosition.item);
    const remoteChanged = changed(baseItem, remotePosition.item);
    const item =
      localChanged && remoteChanged && changed(localPosition.item, remotePosition.item)
        ? mergeProtocolItem(baseItem, localPosition.item, remotePosition.item)
        : localChanged
          ? localPosition.item
          : remotePosition.item;
    const kind = mergeProtocolItemKind(basePosition, localPosition, remotePosition);
    mergedById.set(id, { kind, item });
  }

  return {
    updates: orderMergedProtocolItems('updates', baseProtocol, localProtocol, remoteProtocol, mergedById),
    topics: orderMergedProtocolItems('topics', baseProtocol, localProtocol, remoteProtocol, mergedById),
    todos: orderMergedProtocolItems('todos', baseProtocol, localProtocol, remoteProtocol, mergedById),
  };
}

function protocolItemPositions(protocol: MeetingProtocol) {
  const positions = new Map<string, { kind: ProtocolItemKind; item: MeetingProtocolItem }>();

  for (const kind of protocolItemKinds) {
    for (const item of protocol[kind]) {
      positions.set(item.id, { kind, item });
    }
  }

  return positions;
}

function mergeProtocolItemKind(
  basePosition: { kind: ProtocolItemKind; item: MeetingProtocolItem },
  localPosition: { kind: ProtocolItemKind; item: MeetingProtocolItem },
  remotePosition: { kind: ProtocolItemKind; item: MeetingProtocolItem },
) {
  const localMoved = localPosition.kind !== basePosition.kind;
  const remoteMoved = remotePosition.kind !== basePosition.kind;

  if (localMoved && remoteMoved && localPosition.kind !== remotePosition.kind) {
    return localPosition.item.updatedAt >= remotePosition.item.updatedAt ? localPosition.kind : remotePosition.kind;
  }
  if (localMoved) return localPosition.kind;
  if (remoteMoved) return remotePosition.kind;
  return remotePosition.kind;
}

function orderMergedProtocolItems(
  kind: DefaultProtocolKind,
  baseProtocol: MeetingProtocol,
  localProtocol: MeetingProtocol,
  remoteProtocol: MeetingProtocol,
  mergedById: Map<string, { kind: ProtocolItemKind; item: MeetingProtocolItem }>,
) {
  const orderSource = idsChanged(baseProtocol[kind], localProtocol[kind])
    ? localProtocol[kind]
    : remoteProtocol[kind];
  const ordered: MeetingProtocolItem[] = [];
  const seen = new Set<string>();

  for (const sourceItem of orderSource) {
    const merged = mergedById.get(sourceItem.id);
    if (!merged || merged.kind !== kind || seen.has(sourceItem.id)) continue;

    ordered.push(merged.item);
    seen.add(sourceItem.id);
  }

  for (const [id, merged] of mergedById) {
    if (merged.kind !== kind || seen.has(id)) continue;

    ordered.push(merged.item);
    seen.add(id);
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
    recurring: mergeProtocolChoiceField(baseItem.recurring, localItem.recurring, remoteItem.recurring, localItem, remoteItem),
    recurringSourceId: mergeProtocolChoiceField(
      baseItem.recurringSourceId,
      localItem.recurringSourceId,
      remoteItem.recurringSourceId,
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

function normalizeProtocolSectionColors(
  sectionColors: unknown,
): MeetingProtocol['sectionColors'] {
  if (!sectionColors || typeof sectionColors !== 'object') return undefined;
  const obj = sectionColors as Record<string, unknown>;
  const result: MeetingProtocol['sectionColors'] = {};
  if (typeof obj.updates === 'string' && obj.updates.trim()) result.updates = obj.updates.trim();
  if (typeof obj.topics === 'string' && obj.topics.trim()) result.topics = obj.topics.trim();
  if (typeof obj.todos === 'string' && obj.todos.trim()) result.todos = obj.todos.trim();
  return Object.keys(result).length ? result : undefined;
}

function normalizeProtocolSectionNames(
  sectionNames: unknown,
): MeetingProtocol['sectionNames'] {
  if (!sectionNames || typeof sectionNames !== 'object') return undefined;
  const obj = sectionNames as Record<string, unknown>;
  const result: MeetingProtocol['sectionNames'] = {};
  if (typeof obj.updates === 'string' && obj.updates.trim()) result.updates = obj.updates.trim();
  if (typeof obj.topics === 'string' && obj.topics.trim()) result.topics = obj.topics.trim();
  if (typeof obj.todos === 'string' && obj.todos.trim()) result.todos = obj.todos.trim();
  return Object.keys(result).length ? result : undefined;
}

function normalizeProtocolCustomSections(
  customSections: unknown,
): ProtocolCustomSection[] {
  if (!Array.isArray(customSections)) return [];
  return customSections.filter(
    (s): s is ProtocolCustomSection =>
      s && typeof s === 'object' &&
      typeof s.id === 'string' && s.id.trim() !== '' &&
      typeof s.name === 'string' && s.name.trim() !== '' &&
      Array.isArray(s.items),
  ).map((s) => ({
    id: s.id.trim(),
    name: s.name.trim(),
    color: typeof s.color === 'string' && s.color.trim() ? s.color.trim() : undefined,
    items: normalizeProtocolItems(s.items, s.name),
  }));
}

function mergeProtocolSectionStringRecord(
  base: Record<string, string | undefined> | undefined,
  local: Record<string, string | undefined> | undefined,
  remote: Record<string, string | undefined> | undefined,
): Record<string, string | undefined> | undefined {
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(local ?? {}), ...Object.keys(remote ?? {})]);
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    result[key] = changed(base?.[key], local?.[key]) ? local?.[key] : remote?.[key];
  }
  const defined = Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined));
  return Object.keys(defined).length ? defined : undefined;
}

function mergeCustomSections(
  baseSections: ProtocolCustomSection[],
  localSections: ProtocolCustomSection[],
  remoteSections: ProtocolCustomSection[],
): ProtocolCustomSection[] {
  const merged = mergeById(baseSections, localSections, remoteSections);
  return merged.map((section) => {
    const baseSection = baseSections.find((s) => s.id === section.id);
    const localSection = localSections.find((s) => s.id === section.id);
    const remoteSection = remoteSections.find((s) => s.id === section.id);
    if (!baseSection || !localSection || !remoteSection) return section;

    const name = changed(baseSection.name, localSection.name) ? localSection.name : remoteSection.name;
    const color = changed(baseSection.color, localSection.color) ? localSection.color : remoteSection.color;
    const items = mergeCustomSectionItems(baseSection.items, localSection.items, remoteSection.items);
    return { ...section, name, color, items };
  });
}

function mergeCustomSectionItems(
  baseItems: MeetingProtocolItem[],
  localItems: MeetingProtocolItem[],
  remoteItems: MeetingProtocolItem[],
): MeetingProtocolItem[] {
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  const mergedById = new Map<string, MeetingProtocolItem>();
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);

  for (const id of ids) {
    const baseItem = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);

    if (!baseItem) {
      const added = localItem ?? remoteItem;
      if (added) mergedById.set(id, added);
      continue;
    }

    if (!localItem && !remoteItem) continue;

    if (!localItem) {
      if (remoteItem && changed(baseItem, remoteItem)) mergedById.set(id, remoteItem);
      continue;
    }

    if (!remoteItem) {
      if (changed(baseItem, localItem)) mergedById.set(id, localItem);
      continue;
    }

    const localChanged = changed(baseItem, localItem);
    const remoteChanged = changed(baseItem, remoteItem);
    const item =
      localChanged && remoteChanged && changed(localItem, remoteItem)
        ? mergeProtocolItem(baseItem, localItem, remoteItem)
        : localChanged
          ? localItem
          : remoteItem;
    mergedById.set(id, item);
  }

  const localOrderChanged = idsChanged(baseItems, localItems);
  const orderSource = localOrderChanged ? localItems : remoteItems;
  const ordered: MeetingProtocolItem[] = [];
  const seen = new Set<string>();

  for (const sourceItem of orderSource) {
    const merged = mergedById.get(sourceItem.id);
    if (!merged || seen.has(sourceItem.id)) continue;
    ordered.push(merged);
    seen.add(sourceItem.id);
  }

  for (const [id, merged] of mergedById) {
    if (!seen.has(id)) ordered.push(merged);
  }

  return ordered;
}
