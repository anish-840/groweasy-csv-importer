import Papa from 'papaparse';

export interface ClientParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
  rowCount: number;
}

/**
 * Client-side CSV parse used purely for the *preview* step (no AI involved).
 * Mirrors the backend's normalisation (trimmed cells, deduped headers, empty rows
 * dropped) so the preview matches what the backend will actually process.
 */
export function parseCsvText(text: string): ClientParsedCsv {
  const clean = text.replace(/^﻿/, '');
  const result = Papa.parse<Record<string, unknown>>(clean, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h, i) => h.trim() || `column_${i + 1}`);

  const rows: Array<Record<string, string>> = [];
  for (const raw of result.data) {
    const row: Record<string, string> = {};
    let hasValue = false;
    for (const header of headers) {
      const value = raw[header];
      const str = value === null || value === undefined ? '' : String(value).trim();
      row[header] = str;
      if (str !== '') hasValue = true;
    }
    if (hasValue) rows.push(row);
  }

  return { headers, rows, rowCount: rows.length };
}

/** Reads a File as text and parses it. */
export async function parseCsvFile(file: File): Promise<ClientParsedCsv> {
  const text = await file.text();
  return parseCsvText(text);
}
