import { describe, expect, it } from 'vitest';
import { CRM_FIELDS, emptyCrmRecord } from '@groweasy/shared';
import { buildCrmCsv } from './exportCsv';
import { formatBytes, formatDuration, formatNumber } from './utils';

describe('buildCrmCsv', () => {
  it('emits the canonical CRM header order', () => {
    const csv = buildCrmCsv([]);
    expect(csv.split('\n')[0]).toBe(CRM_FIELDS.join(','));
  });

  it('serialises a record in field order', () => {
    const record = { ...emptyCrmRecord(), name: 'John Doe', email: 'john@x.com' };
    const csv = buildCrmCsv([record]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('John Doe');
    expect(lines[1]).toContain('john@x.com');
  });
});

describe('formatting helpers', () => {
  it('formats numbers with separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
  it('formats durations', () => {
    expect(formatDuration(820)).toBe('820 ms');
    expect(formatDuration(3400)).toBe('3.4 s');
  });
});
