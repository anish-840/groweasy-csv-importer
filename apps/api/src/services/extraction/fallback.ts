import { CRM_FIELDS, type CrmField } from '@groweasy/shared';
import type { Batch, ExtractionProvider, ProviderRecord } from './types.js';

/**
 * Deterministic, no-AI extraction engine.
 *
 * Used (a) when no GEMINI_API_KEY is configured so the app is always demoable, and
 * (b) as a per-batch safety net when the AI fails after all retries. It maps columns
 * to CRM fields via header keyword matching, and preserves any unmapped-but-useful
 * columns into crm_note so no data is silently lost.
 *
 * It is intentionally conservative — real AI extraction is far more capable — but it
 * handles the common, well-labelled cases (and every sample CSV) correctly.
 */

/** Keyword catalogue per CRM field, ordered most-specific first. `false` synonyms exclude. */
const FIELD_SYNONYMS: Partial<Record<CrmField, string[]>> = {
  created_at: ['createdat', 'createdon', 'createddate', 'leaddate', 'datecreated', 'submittedon', 'timestamp', 'createtime', 'date', 'time'],
  name: ['fullname', 'leadname', 'customername', 'contactname', 'clientname', 'personname', 'name'],
  email: ['emailaddress', 'email', 'emailid', 'mail', 'e-mail'],
  country_code: ['countrycode', 'dialcode', 'isdcode', 'phonecode', 'ccode'],
  mobile_without_country_code: ['mobilenumber', 'phonenumber', 'contactnumber', 'whatsappnumber', 'mobile', 'phone', 'contact', 'whatsapp', 'cell', 'telephone', 'tel', 'msisdn'],
  company: ['companyname', 'company', 'organization', 'organisation', 'business', 'firm', 'employer'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  country: ['countryname', 'country', 'nation'],
  lead_owner: ['leadowner', 'assignedexecutive', 'assignedto', 'assigned', 'owner', 'assignee', 'salesrep', 'salesperson', 'executive', 'agent', 'handledby', 'accountmanager', 'relationshipmanager', 'counsellor', 'counselor', 'advisor'],
  crm_status: ['leadstatus', 'crmstatus', 'status', 'stage', 'disposition', 'leadstage'],
  crm_note: ['crmnote', 'notes', 'note', 'remarks', 'remark', 'comments', 'comment'],
  data_source: ['datasource', 'leadsource', 'utmsource', 'source', 'campaign', 'channel', 'project', 'platform'],
  possession_time: ['possessiontime', 'possession', 'timeline', 'movein', 'readytomove'],
  description: ['description', 'details', 'requirement', 'requirements', 'message', 'enquiry', 'inquiry', 'about', 'desc'],
};

/** Bonus added to high-value contact fields so they win ambiguous headers. */
const FIELD_PRIORITY: Partial<Record<CrmField, number>> = {
  email: 40,
  mobile_without_country_code: 40,
  name: 30,
  created_at: 10,
};

// Non-global (stateless) detectors used for content-based recovery.
const HAS_EMAIL = /[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+/;
const HAS_PHONE = /\+?\d[\d\s().-]{5,}\d/;

const normalizeHeader = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Builds a header -> CRM field mapping for a set of headers. Each header is scored
 * against every field's synonyms; the best (field, header) pairs win, and each CRM
 * field is filled at most once.
 */
export function buildHeaderMap(headers: string[]): { map: Map<string, CrmField>; unmapped: string[] } {
  interface Candidate {
    header: string;
    field: CrmField;
    score: number;
  }
  const candidates: Candidate[] = [];

  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) continue;
    for (const field of CRM_FIELDS) {
      const synonyms = FIELD_SYNONYMS[field];
      if (!synonyms) continue;
      let best = 0;
      for (let i = 0; i < synonyms.length; i += 1) {
        const syn = synonyms[i]!;
        // Earlier synonyms are more specific -> higher base weight.
        const specificity = synonyms.length - i;
        if (norm === syn) best = Math.max(best, 1000 + specificity);
        else if (norm.includes(syn)) best = Math.max(best, 500 + specificity + syn.length);
        else if (syn.includes(norm) && norm.length >= 3) best = Math.max(best, 100 + norm.length);
      }
      if (best > 0) candidates.push({ header, field, score: best + (FIELD_PRIORITY[field] ?? 0) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const map = new Map<string, CrmField>();
  const usedFields = new Set<CrmField>();
  const usedHeaders = new Set<string>();

  for (const c of candidates) {
    if (usedFields.has(c.field) || usedHeaders.has(c.header)) continue;
    map.set(c.header, c.field);
    usedFields.add(c.field);
    usedHeaders.add(c.header);
  }

  const unmapped = headers.filter((h) => !usedHeaders.has(h) && normalizeHeader(h) !== '');
  return { map, unmapped };
}

/** Maps a single row using a precomputed header map. */
function mapRow(
  row: Record<string, string>,
  headerMap: Map<string, CrmField>,
  unmapped: string[],
  rowIndex: number,
  ownerHeader: string | undefined,
): ProviderRecord {
  const record: ProviderRecord = { _row: rowIndex };
  for (const [header, field] of headerMap) {
    const value = row[header];
    if (value) record[field] = value;
  }

  // Content-based recovery: header mapping can miss contact info that lives in a
  // generically-named column (e.g. "Contact Details", "Extra"). If we still have
  // no email/phone, scan the row's own values — skipping the lead-owner column so
  // we don't mistake the agent's address for the lead's. Post-processing then
  // splits multiple values and moves extras into the note.
  for (const [header, value] of Object.entries(row)) {
    if (!value || header === ownerHeader) continue;
    if (!record.email && HAS_EMAIL.test(value)) record.email = value;
    if (!record.mobile_without_country_code && HAS_PHONE.test(value)) {
      record.mobile_without_country_code = value;
    }
  }

  // Preserve unmapped, non-empty columns in the note so nothing is lost.
  const leftovers = unmapped
    .map((h) => ({ h, v: row[h] }))
    .filter((x) => x.v)
    .map((x) => `${x.h}: ${x.v}`);
  if (leftovers.length > 0) {
    const existing = record.crm_note ? [record.crm_note] : [];
    record.crm_note = [...existing, ...leftovers].join(' | ');
  }

  return record;
}

/** Creates the deterministic heuristic provider. */
export function createFallbackProvider(): ExtractionProvider {
  return {
    name: 'heuristic',
    model: null,
    async extractBatch(batch: Batch, headers: string[]): Promise<ProviderRecord[]> {
      const { map, unmapped } = buildHeaderMap(headers);
      const ownerHeader = [...map.entries()].find(([, f]) => f === 'lead_owner')?.[0];
      return batch.rows.map((row, j) => mapRow(row, map, unmapped, batch.startIndex + j, ownerHeader));
    },
  };
}
