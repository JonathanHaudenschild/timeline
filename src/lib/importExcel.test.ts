import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { importProjectWorkbook } from './importExcel';

describe('Excel import', () => {
  it('imports timeline rows hidden from the timeline by default', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Zeitplan');
    sheet.addRow(['Title']);
    sheet.addRow(['Datum', 'Uhrzeit', 'Was', 'Wer', 'Bereich', 'Anmerkungen', 'Links']);
    sheet.addRow(['01.06.2026', '12:30', 'Arrival', 'Team', 'Ops', 'Bring gear', 'https://example.com']);

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await importProjectWorkbook('import-test', buffer);

    expect(result.importedEvents).toBe(1);
    expect(result.project.events[0]).toMatchObject({
      date: '2026-06-01',
      time: '12:30',
      what: 'Arrival',
      who: 'Team',
      type: 'Ops',
      showOnTimeline: false,
    });
  });
});
