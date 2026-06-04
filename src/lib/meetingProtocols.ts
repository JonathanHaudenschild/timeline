import type { MeetingProtocol, MeetingProtocolItem } from './types';

const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const shortWeekdayNames = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const defaultProtocolTitle = 'Tägliches Platz-Plenum';

export const defaultProtocolInstructionTemplate = `{title}
---------------------------------------------------------------------------------------------------------------------
📋 Tägliches Platz-Plenum 📅 Datum: {date} · ⏱️ Dauer: {duration}
🎤 Moderation: NAME | 📝 Protokoll: NAME | 📌 To-Dos-Beauftragte:r: NAME

👋 Begrüßung & Rahmen
Guten Morgen, ich moderiere heute das Plenum möglichst zügig & strukturiert.
Wer schreibt heute Protokoll? Wer ist Heute To-Dos-Beauftragte:r:?
Optional: kurze Vorstellungsrunde mit Name, Pronomen & Stress-/Laune-Barometer
Ich stelle kurz Ablauf & Struktur vor: 🎯 Ziel: Plenum max. 1 Stunde
Bitte lasst einander ausreden & bleibt beim Thema
Bei Bedarf nutzen wir eine Redner:innen-Liste
Den Link zum Protokoll findet ihr im SCC-Wiki: Themen fürs nächste Plenum bitte möglichst früh dort eintragen

🔄 Struktur des Plenums
1. Updates: Kurze relevante Infos ohne Diskussion ⏱️ Richtwert: max. 15 Minuten
📌 Falls Redebedarf entsteht → in den Themen-Block schieben
2. Themen: Gemeinsame Themen & Diskussionen 🎯 Richtwert: max. 10 Minuten pro Thema
📌 Beim Thema bleiben 📌 Lange Diskussionen ggf. auslagern 📌 Entstehende To-Dos direkt mitschreiben
3. To-Dos: Gemeinsame Sichtung & Planung 🔗 Decks: https://cloud.kuko-crews.org/apps/deck/board/433/
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
        updates: normalizeProtocolItems(protocol.updates, 'Update'),
        topics: normalizeProtocolItems(protocol.topics, 'Thema'),
        todos: normalizeProtocolItems(protocol.todos, 'To-Do'),
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
      updates: mergeById(baseProtocol.updates, localProtocol.updates, remoteProtocol.updates, copyRemoteProtocolItem),
      topics: mergeById(baseProtocol.topics, localProtocol.topics, remoteProtocol.topics, copyRemoteProtocolItem),
      todos: mergeById(baseProtocol.todos, localProtocol.todos, remoteProtocol.todos, copyRemoteProtocolItem),
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
    /^(📋|👋|🔄)/.test(line) ||
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
  copyRemoteConflict?: (item: T, id: string) => T,
) {
  const result = new Map(remoteItems.map((item) => [item.id, item]));
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));

  for (const [id, localItem] of localById) {
    const baseItem = baseById.get(id);
    const remoteItem = result.get(id);
    if (
      baseItem &&
      remoteItem &&
      copyRemoteConflict &&
      changed(baseItem, localItem) &&
      changed(baseItem, remoteItem) &&
      changed(localItem, remoteItem)
    ) {
      result.set(id, localItem);
      const conflictId = uniqueConflictId(id, result);
      result.set(conflictId, copyRemoteConflict(remoteItem, conflictId));
    } else if (!baseItem || changed(baseItem, localItem)) {
      result.set(id, localItem);
    }
  }

  for (const [id, baseItem] of baseById) {
    if (localById.has(id)) continue;
    const remoteItem = result.get(id);
    if (!remoteItem || !changed(baseItem, remoteItem)) result.delete(id);
  }

  return [...result.values()];
}

function mergeProtocolBody(baseBody: string, localBody: string, remoteBody: string) {
  const localChanged = changed(baseBody, localBody);
  const remoteChanged = changed(baseBody, remoteBody);
  if (localChanged && remoteChanged && localBody !== remoteBody) {
    return `${localBody}\n\n--- Version from another device ---\n\n${remoteBody}`;
  }

  return localChanged ? localBody : remoteBody;
}

function copyRemoteProtocolItem(item: MeetingProtocolItem, id: string): MeetingProtocolItem {
  return {
    ...item,
    id,
    title: `${item.title} (other device)`,
  };
}

function uniqueConflictId(baseId: string, items: ReadonlyMap<string, unknown>) {
  let index = 1;
  let id = `${baseId}-other-device`;
  while (items.has(id)) {
    index += 1;
    id = `${baseId}-other-device-${index}`;
  }
  return id;
}

function latestString(left: string, right: string) {
  return left > right ? left : right;
}

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}
