import Papa from 'papaparse';
import { BadRequestError } from '../errors.js';

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Parses raw CSV text into normalised string rows.
 *
 * - Uses a real CSV parser (handles quotes, embedded commas/newlines, `\r\n`).
 * - Header names are trimmed; blank/duplicate headers get stable synthetic names.
 * - Every cell is coerced to a trimmed string.
 * - Fully empty rows are dropped.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, ''); // strip BOM
  if (!text.trim()) {
    throw new BadRequestError('The uploaded CSV is empty.', 'EMPTY_CSV');
  }

  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  const rawHeaders = (result.meta.fields ?? []).map((h) => h ?? '');
  const headers = dedupeHeaders(rawHeaders);
  if (headers.length === 0) {
    throw new BadRequestError('Could not detect any columns in the CSV.', 'NO_COLUMNS');
  }

  const headerMap = new Map(rawHeaders.map((raw, i) => [raw, headers[i] as string]));

  const rows: Array<Record<string, string>> = [];
  for (const raw of result.data) {
    const row: Record<string, string> = {};
    let hasValue = false;
    for (const rawHeader of rawHeaders) {
      const key = headerMap.get(rawHeader) as string;
      const value = raw[rawHeader];
      const str = value === null || value === undefined ? '' : String(value).trim();
      row[key] = str;
      if (str !== '') hasValue = true;
    }
    if (hasValue) rows.push(row);
  }

  return { headers, rows };
}

/** Ensures headers are unique and non-empty (blank -> column_N, dup -> name_2). */
function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    let base = h.trim();
    if (base === '') base = `column_${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}
