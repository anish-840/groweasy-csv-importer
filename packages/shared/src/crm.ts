import { z } from 'zod';

/**
 * The GrowEasy CRM schema — the canonical target shape that every uploaded CSV,
 * regardless of its original columns, is mapped into.
 *
 * This file is the single source of truth for:
 *   - the ordered list of CRM fields,
 *   - the allowed enum values for `crm_status` and `data_source`,
 *   - runtime validation (Zod) shared by the API and the web app.
 */

// ---------------------------------------------------------------------------
// Field catalogue
// ---------------------------------------------------------------------------

/** CRM fields in their canonical output order (matches the CRM CSV header). */
export const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
] as const;

export type CrmField = (typeof CRM_FIELDS)[number];

/** Human-friendly descriptions used in the AI prompt and (optionally) the UI. */
export const CRM_FIELD_DESCRIPTIONS: Record<CrmField, string> = {
  created_at: 'Lead creation date/time (any format parseable by JS `new Date()`).',
  name: 'Full name of the lead.',
  email: 'Primary email address.',
  country_code: 'Phone country code including the leading "+" (e.g. +91).',
  mobile_without_country_code: 'Mobile number digits only, excluding the country code.',
  company: 'Company / organisation name.',
  city: 'City.',
  state: 'State / province / region.',
  country: 'Country name.',
  lead_owner: 'Person or email who owns/handles this lead.',
  crm_status: 'Lead status — one of the allowed CRM_STATUS values, or blank.',
  crm_note: 'Notes, remarks, follow-ups, and any extra emails/phones that do not fit elsewhere.',
  data_source: 'Campaign/source — one of the allowed DATA_SOURCE values, or blank.',
  possession_time: 'Property possession time / timeline (real-estate leads).',
  description: 'Any additional free-text description.',
};

// ---------------------------------------------------------------------------
// Controlled vocabularies
// ---------------------------------------------------------------------------

export const CRM_STATUS_VALUES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

const CRM_STATUS_SET = new Set<string>(CRM_STATUS_VALUES);
const DATA_SOURCE_SET = new Set<string>(DATA_SOURCE_VALUES);

/** Returns the value if it is a valid CRM status, otherwise `''`. */
export function coerceCrmStatus(value: string): CrmStatus | '' {
  return CRM_STATUS_SET.has(value) ? (value as CrmStatus) : '';
}

/** Returns the value if it is a valid data source, otherwise `''`. */
export function coerceDataSource(value: string): DataSource | '' {
  return DATA_SOURCE_SET.has(value) ? (value as DataSource) : '';
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * A fully-normalised CRM record. Every field is a string ('' when unknown) so a
 * record is always safe to render in a table or serialise to a CSV row.
 */
export const crmRecordSchema = z.object({
  created_at: z.string(),
  name: z.string(),
  email: z.string(),
  country_code: z.string(),
  mobile_without_country_code: z.string(),
  company: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  lead_owner: z.string(),
  crm_status: z.string(),
  crm_note: z.string(),
  data_source: z.string(),
  possession_time: z.string(),
  description: z.string(),
});

export type CrmRecord = z.infer<typeof crmRecordSchema>;

/**
 * Coerces any scalar the AI might return (string | number | boolean | null) into
 * a trimmed string. Used to parse raw model output leniently before normalising.
 */
const looseField = z
  .union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? '' : String(v).trim()));

/** Lenient schema for a single record as returned by the LLM (all fields optional). */
export const aiCrmRecordSchema = z
  .object({
    created_at: looseField,
    name: looseField,
    email: looseField,
    country_code: looseField,
    mobile_without_country_code: looseField,
    company: looseField,
    city: looseField,
    state: looseField,
    country: looseField,
    lead_owner: looseField,
    crm_status: looseField,
    crm_note: looseField,
    data_source: looseField,
    possession_time: looseField,
    description: looseField,
  })
  .partial();

export type AiCrmRecord = z.infer<typeof aiCrmRecordSchema>;

/** The batch shape we ask the LLM to return: `{ records: [...] }`. */
export const aiBatchResponseSchema = z.object({
  records: z.array(aiCrmRecordSchema),
});

/** Returns a fresh CRM record with every field blank. */
export function emptyCrmRecord(): CrmRecord {
  return {
    created_at: '',
    name: '',
    email: '',
    country_code: '',
    mobile_without_country_code: '',
    company: '',
    city: '',
    state: '',
    country: '',
    lead_owner: '',
    crm_status: '',
    crm_note: '',
    data_source: '',
    possession_time: '',
    description: '',
  };
}
