import { describe, expect, it } from 'vitest';
import {
  escapeNewlines,
  extractEmails,
  normalizeCountryCode,
  normalizeDate,
  normalizePhone,
  normalizeRecord,
} from './postprocess.js';
import type { ProviderRecord } from './types.js';

describe('escapeNewlines', () => {
  it('replaces CR/LF/CRLF with the literal \\n', () => {
    expect(escapeNewlines('a\nb\r\nc\rd')).toBe('a\\nb\\nc\\nd');
  });
});

describe('extractEmails', () => {
  it('extracts and de-duplicates emails, lowercased', () => {
    expect(extractEmails('A@X.com, b@y.com; A@x.com')).toEqual(['a@x.com', 'b@y.com']);
  });
  it('returns [] when none present', () => {
    expect(extractEmails('not an email')).toEqual([]);
  });
});

describe('normalizeCountryCode', () => {
  it('prefixes digits with +', () => {
    expect(normalizeCountryCode('91')).toBe('+91');
    expect(normalizeCountryCode('+1')).toBe('+1');
    expect(normalizeCountryCode('')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('uses an explicit country code and cleans the national number', () => {
    expect(normalizePhone('98765 43210', '+91')).toEqual({
      countryCode: '+91',
      national: '9876543210',
      extras: [],
    });
  });

  it('strips a redundant country code embedded in the number', () => {
    expect(normalizePhone('919876543210', '+91')).toEqual({
      countryCode: '+91',
      national: '9876543210',
      extras: [],
    });
  });

  it('splits a +CC-prefixed number when no CC field is given', () => {
    expect(normalizePhone('+91 98765 43210', '')).toEqual({
      countryCode: '+91',
      national: '9876543210',
      extras: [],
    });
  });

  it('collects extra numbers', () => {
    const parts = normalizePhone('9876543210, 9123456789', '+91');
    expect(parts.national).toBe('9876543210');
    expect(parts.extras).toEqual(['9123456789']);
  });

  it('returns empty national when there is no phone', () => {
    expect(normalizePhone('n/a', '').national).toBe('');
  });
});

describe('normalizeDate', () => {
  it('keeps a parseable date', () => {
    expect(normalizeDate('2026-05-13 14:20:48')).toBe('2026-05-13 14:20:48');
  });
  it('blanks an unparseable date', () => {
    expect(normalizeDate('not a date')).toBe('');
  });
});

function raw(partial: Partial<ProviderRecord>): ProviderRecord {
  return { _row: 0, ...partial };
}

describe('normalizeRecord', () => {
  it('normalises a well-formed record', () => {
    const { record } = normalizeRecord(
      raw({
        name: 'John Doe',
        email: 'john@x.com',
        country_code: '+91',
        mobile_without_country_code: '9876543210',
        crm_status: 'follow up',
        data_source: 'Meridian Tower',
        created_at: '2026-05-13 14:20:48',
      }),
      {},
      0,
    );
    expect(record).toBeDefined();
    expect(record?.crm_status).toBe('GOOD_LEAD_FOLLOW_UP');
    expect(record?.data_source).toBe('meridian_tower');
    expect(record?.country_code).toBe('+91');
    expect(record?.mobile_without_country_code).toBe('9876543210');
  });

  it('maps free-text statuses to the controlled vocabulary', () => {
    const cases: Array<[string, string]> = [
      ['Interested', 'GOOD_LEAD_FOLLOW_UP'],
      ['call back', 'GOOD_LEAD_FOLLOW_UP'],
      ['No answer', 'DID_NOT_CONNECT'],
      ['call later', 'DID_NOT_CONNECT'],
      ['Not interested', 'BAD_LEAD'],
      ['wrong number', 'BAD_LEAD'],
      ['Closed won', 'SALE_DONE'],
      ['deal done', 'SALE_DONE'],
      ['SALE_DONE', 'SALE_DONE'],
    ];
    for (const [input, expected] of cases) {
      const { record } = normalizeRecord(raw({ email: 'a@x.com', crm_status: input }), {}, 0);
      expect(record?.crm_status, `"${input}"`).toBe(expected);
    }
  });

  it('blanks an invalid status and unknown source', () => {
    const { record } = normalizeRecord(
      raw({ email: 'a@x.com', crm_status: 'maybe later', data_source: 'random_ad' }),
      {},
      1,
    );
    expect(record?.crm_status).toBe('');
    expect(record?.data_source).toBe('');
  });

  it('keeps the first email/phone and moves the rest into crm_note', () => {
    const { record } = normalizeRecord(
      raw({
        email: 'a@x.com, b@y.com',
        mobile_without_country_code: '9876543210, 9123456789',
        country_code: '+91',
        crm_note: 'called once',
      }),
      {},
      2,
    );
    expect(record?.email).toBe('a@x.com');
    expect(record?.mobile_without_country_code).toBe('9876543210');
    expect(record?.crm_note).toContain('called once');
    expect(record?.crm_note).toContain('Additional emails: b@y.com');
    expect(record?.crm_note).toContain('Additional phones: 9123456789');
  });

  it('skips a row with neither email nor mobile', () => {
    const { record, skipped } = normalizeRecord(raw({ name: 'No Contact' }), { name: 'No Contact' }, 3);
    expect(record).toBeUndefined();
    expect(skipped?.reason).toMatch(/no email or mobile/i);
    expect(skipped?.rowIndex).toBe(3);
  });

  it('escapes newlines so the record stays a single CSV row', () => {
    const { record } = normalizeRecord(
      raw({ email: 'a@x.com', crm_note: 'line1\nline2' }),
      {},
      4,
    );
    expect(record?.crm_note).toBe('line1\\nline2');
  });
});
