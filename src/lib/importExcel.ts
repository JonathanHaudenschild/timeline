import ExcelJS from 'exceljs';
import type { TimelineEvent, TimelineProject } from './types';
import { createDefaultProject, normalizeHash } from './project';
import { sortedEvents } from './timeline';

type ImportResult = {
  project: TimelineProject;
  importedEvents: number;
  importedLinks: number;
};

const excelEpoch = Date.UTC(1899, 11, 30);

export async function importProjectWorkbook(
  hash: string,
  input: ArrayBuffer,
  existingProject?: TimelineProject,
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);

  const project = existingProject ?? createDefaultProject(hash);
  const timelineSheet = workbook.getWorksheet('Zeitplan') ?? workbook.worksheets[0];
  const linksSheet = workbook.getWorksheet('Wichtige Links');
  const events = timelineSheet ? parseTimelineSheet(timelineSheet) : [];
  const linksMarkdown = linksSheet ? parseLinksSheet(linksSheet) : '';
  const importedEvents = sortedEvents(events);

  const nextProject: TimelineProject = {
    ...project,
    hash: normalizeHash(hash),
    name: project.name || 'Imported timeline',
    events: importedEvents,
    startDate: importedEvents[0]?.date ?? project.startDate,
    endDate: importedEvents.at(-1)?.endDate ?? importedEvents.at(-1)?.date ?? project.endDate,
    infoMarkdown: linksMarkdown
      ? `${project.infoMarkdown}\n\n## Imported links\n\n${linksMarkdown}`
      : project.infoMarkdown,
  };

  return {
    project: nextProject,
    importedEvents: importedEvents.length,
    importedLinks: linksMarkdown ? linksMarkdown.split('\n').filter((line) => line.startsWith('- ')).length : 0,
  };
}

function parseTimelineSheet(sheet: ExcelJS.Worksheet) {
  const headerRowNumber = findHeaderRow(sheet, ['datum', 'uhrzeit', 'was']);
  if (!headerRowNumber) return [];

  const headers = readHeaders(sheet.getRow(headerRowNumber));
  const events: TimelineEvent[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const date = parseDateCell(cellByHeader(row, headers, 'datum'));
    const what = stringifyCell(cellByHeader(row, headers, 'was')).trim();
    if (!date || !what) return;

    const rawTime = stringifyCell(cellByHeader(row, headers, 'uhrzeit')).trim();
    const area = stringifyCell(cellByHeader(row, headers, 'bereich')).trim();
    const note = stringifyCell(cellByHeader(row, headers, 'anmerkungen')).trim();
    const link = stringifyCell(cellByHeader(row, headers, 'links')).trim();

    events.push({
      id: `import-${rowNumber}-${slugify(`${date}-${what}`)}`,
      date,
      time: parseTime(rawTime),
      what,
      who: stringifyCell(cellByHeader(row, headers, 'wer')).trim(),
      type: area || 'import',
      category: inferCategory(what, area),
      color: '',
      showOnTimeline: false,
      note: [note, link].filter(Boolean).join('\n'),
    });
  });

  return events;
}

function parseLinksSheet(sheet: ExcelJS.Worksheet) {
  const headerRowNumber = findHeaderRow(sheet, ['beschreibung', 'link']) ?? 1;
  const headers = readHeaders(sheet.getRow(headerRowNumber));
  const lines: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const description = stringifyCell(cellByHeader(row, headers, 'beschreibung')).trim();
    const link = stringifyCell(cellByHeader(row, headers, 'link')).trim();
    if (!description && !link) return;

    lines.push(link ? `- [${description || link}](${link})` : `- ${description}`);
  });

  return lines.join('\n');
}

function findHeaderRow(sheet: ExcelJS.Worksheet, requiredHeaders: string[]) {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 12); rowNumber += 1) {
    const headers = readHeaders(sheet.getRow(rowNumber));
    if (requiredHeaders.every((header) => headers.has(header))) {
      return rowNumber;
    }
  }

  return undefined;
}

function readHeaders(row: ExcelJS.Row) {
  const headers = new Map<string, number>();

  row.eachCell((cell, columnNumber) => {
    const value = stringifyCell(cell.value).trim().toLowerCase();
    if (value) headers.set(value, columnNumber);
  });

  return headers;
}

function cellByHeader(row: ExcelJS.Row, headers: Map<string, number>, header: string) {
  const columnNumber = headers.get(header);
  return columnNumber ? row.getCell(columnNumber).value : undefined;
}

function parseDateCell(value: ExcelJS.CellValue | undefined) {
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'number') return formatDate(new Date(excelEpoch + value * 24 * 60 * 60 * 1000));

  const text = stringifyCell(value).trim();
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return '';

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseTime(value: string) {
  const match = value.match(/(\d{1,2})(?::|\.| Uhr)?\s*(\d{2})?/i);
  if (!match) return '09:00';

  const hours = Math.min(23, Number(match[1]));
  const minutes = Math.min(59, Number(match[2] ?? '00'));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function inferCategory(what: string, area: string) {
  const text = `${what} ${area}`.toLowerCase();
  if (text.includes('deadline') || text.includes('start') || text.includes('beginn') || text.includes('ende')) {
    return 'milestone';
  }
  return 'event';
}

function stringifyCell(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && value.text) return String(value.text);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join('');
    }
    if ('hyperlink' in value && value.hyperlink) return String(value.hyperlink);
    if ('result' in value) return stringifyCell(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
