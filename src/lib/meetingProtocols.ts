import type { MeetingProtocol, MeetingProtocolItem } from './types';

const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const shortWeekdayNames = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

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
      const title = protocol.title?.trim() || protocolTitle(date);
      const now = new Date().toISOString();

      return {
        id: protocol.id?.trim() || `protocol-${index + 1}`,
        title,
        date,
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

export function createMeetingProtocol(date = localDateString(new Date())): MeetingProtocol {
  const normalizedDate = normalizeProtocolDate(date) || localDateString(new Date());
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: protocolTitle(normalizedDate),
    date: normalizedDate,
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

export function protocolTitle(date: string) {
  return `${weekdayName(date)} ${formatProtocolDate(date)}`;
}

export function createMeetingProtocolInstruction(date: string) {
  const longDate = formatProtocolDate(date);
  const shortDate = `${shortWeekdayName(date)} ${longDate}`;

  return `${protocolTitle(date)}
---------------------------------------------------------------------------------------------------------------------
📋 Tägliches Platz-Plenum 📅 Datum: ${shortDate} · 🕚 Uhrzeit:
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

——————————————           END Plenum ${longDate}.       —————————————`;
}

export const createMeetingProtocolTemplate = createMeetingProtocolInstruction;

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
      moderation: changed(baseProtocol.moderation, localProtocol.moderation)
        ? localProtocol.moderation
        : remoteProtocol.moderation,
      protocolWriter: changed(baseProtocol.protocolWriter, localProtocol.protocolWriter)
        ? localProtocol.protocolWriter
        : remoteProtocol.protocolWriter,
      todoOwner: changed(baseProtocol.todoOwner, localProtocol.todoOwner)
        ? localProtocol.todoOwner
        : remoteProtocol.todoOwner,
      body: changed(baseProtocol.body, localProtocol.body) ? localProtocol.body : remoteProtocol.body,
      updates: mergeById(baseProtocol.updates, localProtocol.updates, remoteProtocol.updates),
      topics: mergeById(baseProtocol.topics, localProtocol.topics, remoteProtocol.topics),
      todos: mergeById(baseProtocol.todos, localProtocol.todos, remoteProtocol.todos),
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
      title: item.title?.trim() || `${fallbackTitle} ${index + 1}`,
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

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

function mergeById<T extends { id: string }>(baseItems: readonly T[], localItems: readonly T[], remoteItems: readonly T[]) {
  const result = new Map(remoteItems.map((item) => [item.id, item]));
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const localById = new Map(localItems.map((item) => [item.id, item]));

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

  return [...result.values()];
}

function latestString(left: string, right: string) {
  return left > right ? left : right;
}

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}
