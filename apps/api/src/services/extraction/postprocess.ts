import {
  CRM_FIELDS,
  coerceCrmStatus,
  coerceDataSource,
  emptyCrmRecord,
  type CrmRecord,
  type CrmStatus,
  type SkippedRecord,
} from '@groweasy/shared';
import type { ProviderRecord } from './types.js';

/**
 * Deterministic post-processing applied to every record after the AI (or the
 * heuristic engine) produces it. This is where the business rules are *enforced*
 * — we never trust the model to get correctness-critical rules right:
 *
 *   - controlled vocabularies (crm_status, data_source) are validated,
 *   - dates are checked to be `new Date()`-parseable,
 *   - country code / mobile are split and cleaned,
 *   - multiple emails/phones collapse to the first + the rest go to crm_note,
 *   - newlines are escaped so each record is a single safe CSV row,
 *   - rows with neither email nor phone are skipped.
 */

const EMAIL_RE = /[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+/g;
// A phone candidate: optional +, then digit groups possibly separated by spaces,
// dashes, dots or parens; at least 6 digits overall are required downstream.
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;

export interface NormalizeResult {
  record?: CrmRecord;
  skipped?: SkippedRecord;
}

/** Replaces real line breaks with the literal two-char sequence `\n`. */
export function escapeNewlines(value: string): string {
  return value.replace(/\r\n?|\n/g, '\\n');
}

/** Extracts valid-looking emails from a string, de-duplicated, order-preserving. */
export function extractEmails(value: string): string[] {
  const matches = value.match(EMAIL_RE) ?? [];
  const out: string[] = [];
  for (const m of matches) {
    const email = m.trim().toLowerCase();
    if (!out.includes(email)) out.push(email);
  }
  return out;
}

export interface PhoneParts {
  countryCode: string;
  national: string;
  extras: string[];
}

/**
 * Splits a raw mobile field (and optional country-code field) into a country code
 * (`+NN`) and a national number (digits only), plus any extra numbers found.
 */
export function normalizePhone(rawMobile: string, rawCountryCode: string): PhoneParts {
  const candidates = rawMobile.match(PHONE_RE) ?? [];
  const digitStrings = candidates
    .map((c) => ({ raw: c, digits: c.replace(/\D/g, ''), hasPlus: c.trim().startsWith('+') }))
    .filter((c) => c.digits.length >= 6);

  if (digitStrings.length === 0) {
    return { countryCode: normalizeCountryCode(rawCountryCode), national: '', extras: [] };
  }

  const primary = digitStrings[0]!;
  let countryCode = normalizeCountryCode(rawCountryCode);
  let national = primary.digits;

  const ccDigits = countryCode.replace(/\D/g, '');
  if (ccDigits && national.startsWith(ccDigits) && national.length > ccDigits.length) {
    // Mobile field redundantly included the country code — strip it.
    national = national.slice(ccDigits.length);
  } else if (!ccDigits && (primary.hasPlus || national.length > 10)) {
    // No explicit country code, but the number carries one. Assume a 10-digit
    // national number (common for IN/US-style data) and treat the prefix as the CC.
    if (national.length > 10) {
      countryCode = `+${national.slice(0, national.length - 10)}`;
      national = national.slice(national.length - 10);
    }
  }

  const extras = digitStrings.slice(1).map((d) => d.digits);
  return { countryCode, national, extras };
}

/** Normalises a country code to `+` followed by digits (e.g. "91" -> "+91"). */
export function normalizeCountryCode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Keyword rules that map free-text statuses to the controlled vocabulary. Order
 * matters: more specific / negative phrases are checked before positive ones
 * (e.g. "not interested" must beat "interested").
 */
const STATUS_KEYWORDS: Array<[RegExp, CrmStatus]> = [
  [/\b(sale|sold|won|closed?|convert\w*|purchas\w*|deal\s*done|booked|payment\s*done)\b/i, 'SALE_DONE'],
  [/\b(not\s*interested|junk|wrong\s*(number|no)|do\s*not\s*call|dnd|cold|spam|invalid|dead|fake)\b/i, 'BAD_LEAD'],
  [/\b(no\s*answer|not\s*reachable|did\s*not\s*connect|unreachable|busy|ringing|switch(ed)?\s*off|no\s*response|call\s*later|not\s*picked|not\s*connected)\b/i, 'DID_NOT_CONNECT'],
  [/\b(interest\w*|follow[\s-]*up|warm|hot|demo|call\s*back|callback|qualif\w*|meeting|schedul\w*|good\s*lead)\b/i, 'GOOD_LEAD_FOLLOW_UP'],
];

/**
 * Resolves a free-text status to the controlled vocabulary: exact enum match first
 * (e.g. "SALE_DONE", "sale done"), then semantic keyword mapping, else "".
 */
function normalizeStatus(raw: string): string {
  if (!raw) return '';
  const exact = coerceCrmStatus(raw.trim().toUpperCase().replace(/[\s-]+/g, '_'));
  if (exact) return exact;
  const lower = raw.toLowerCase();
  for (const [re, status] of STATUS_KEYWORDS) {
    if (re.test(lower)) return status;
  }
  return '';
}

/** Lowercases + underscores a free-text source, then validates against the enum. */
function normalizeSource(raw: string): string {
  if (!raw) return '';
  const canonical = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return coerceDataSource(canonical);
}

/** Keeps a date only if `new Date()` can parse it; otherwise blanks it. */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? '' : raw.trim();
}

function get(raw: ProviderRecord, field: string): string {
  const value = (raw as Record<string, unknown>)[field];
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * Turns one loosely-typed provider record + its original CSV row into either a
 * clean CRM record or a skip decision.
 */
export function normalizeRecord(
  raw: ProviderRecord,
  sourceRow: Record<string, string>,
  rowIndex: number,
): NormalizeResult {
  const record = emptyCrmRecord();
  for (const field of CRM_FIELDS) {
    record[field] = get(raw, field);
  }

  // --- Emails: first into `email`, extras collected for the note ---
  const emails = extractEmails(record.email);
  const extraNotes: string[] = [];
  if (emails.length > 0) {
    record.email = emails[0]!;
    if (emails.length > 1) {
      extraNotes.push(`Additional emails: ${emails.slice(1).join(', ')}`);
    }
  } else {
    record.email = '';
  }

  // --- Phones: split CC/national, extras into the note ---
  const phone = normalizePhone(record.mobile_without_country_code, record.country_code);
  record.mobile_without_country_code = phone.national;
  record.country_code = phone.countryCode;
  if (phone.extras.length > 0) {
    extraNotes.push(`Additional phones: ${phone.extras.join(', ')}`);
  }

  // --- Controlled vocabularies + date ---
  record.crm_status = normalizeStatus(record.crm_status);
  record.data_source = normalizeSource(record.data_source);
  record.created_at = normalizeDate(record.created_at);

  // --- Compose the note (base note + extras), then escape everything ---
  const noteParts = [record.crm_note, ...extraNotes].map((p) => p.trim()).filter(Boolean);
  record.crm_note = noteParts.join(' | ');

  for (const field of CRM_FIELDS) {
    record[field] = escapeNewlines(record[field]).trim();
  }

  // --- Skip rule: neither email nor mobile => not importable ---
  if (record.email === '' && record.mobile_without_country_code === '') {
    return {
      skipped: {
        rowIndex,
        reason: 'No email or mobile number found',
        raw: sourceRow,
      },
    };
  }

  return { record };
}
