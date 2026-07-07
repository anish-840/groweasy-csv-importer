import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('parses a simple CSV into trimmed string rows', () => {
    const { headers, rows } = parseCsv('name,email\n John , john@x.com \nJane,jane@x.com');
    expect(headers).toEqual(['name', 'email']);
    expect(rows).toEqual([
      { name: 'John', email: 'john@x.com' },
      { name: 'Jane', email: 'jane@x.com' },
    ]);
  });

  it('handles quoted fields with embedded commas and newlines', () => {
    const csv = 'name,note\n"Doe, John","line1\nline2"';
    const { rows } = parseCsv(csv);
    expect(rows[0]).toEqual({ name: 'Doe, John', note: 'line1\nline2' });
  });

  it('strips a UTF-8 BOM from the first header', () => {
    const { headers } = parseCsv('﻿name,email\nA,a@x.com');
    expect(headers[0]).toBe('name');
  });

  it('gives blank and duplicate headers stable unique names', () => {
    const { headers } = parseCsv('name,,name\n1,2,3');
    // Header names must be unique and non-empty (exact suffixing may vary).
    expect(headers).toHaveLength(3);
    expect(new Set(headers).size).toBe(3);
    expect(headers[0]).toBe('name');
    expect(headers[1]).toBe('column_2');
    expect(headers.every((h) => h.trim() !== '')).toBe(true);
  });

  it('drops fully-empty rows', () => {
    const { rows } = parseCsv('name,email\nA,a@x.com\n,\nB,b@x.com');
    expect(rows).toHaveLength(2);
  });

  it('throws on empty input', () => {
    expect(() => parseCsv('   ')).toThrow();
  });
});
