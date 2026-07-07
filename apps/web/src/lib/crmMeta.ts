import { CRM_FIELDS, type CrmField } from '@groweasy/shared';

/** Human-friendly column headers for the CRM result table. */
export const CRM_COLUMN_LABELS: Record<CrmField, string> = {
  created_at: 'Created',
  name: 'Name',
  email: 'Email',
  country_code: 'Code',
  mobile_without_country_code: 'Mobile',
  company: 'Company',
  city: 'City',
  state: 'State',
  country: 'Country',
  lead_owner: 'Lead Owner',
  crm_status: 'Status',
  crm_note: 'Note',
  data_source: 'Source',
  possession_time: 'Possession',
  description: 'Description',
};

/** Pixel widths for CRM columns in the virtualized table. */
export const CRM_COLUMN_WIDTHS: Record<CrmField, number> = {
  created_at: 170,
  name: 160,
  email: 220,
  country_code: 70,
  mobile_without_country_code: 140,
  company: 160,
  city: 120,
  state: 120,
  country: 120,
  lead_owner: 170,
  crm_status: 190,
  crm_note: 320,
  data_source: 150,
  possession_time: 150,
  description: 260,
};

export const CRM_FIELD_ORDER = CRM_FIELDS;

/** Tailwind classes for each CRM status badge (light + dark). */
export const STATUS_STYLES: Record<string, string> = {
  GOOD_LEAD_FOLLOW_UP:
    'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
  DID_NOT_CONNECT:
    'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
  BAD_LEAD:
    'bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25',
  SALE_DONE:
    'bg-indigo-100 text-indigo-800 ring-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/25',
};

const STATUS_LABELS: Record<string, string> = {
  GOOD_LEAD_FOLLOW_UP: 'Follow up',
  DID_NOT_CONNECT: 'No connect',
  BAD_LEAD: 'Bad lead',
  SALE_DONE: 'Sale done',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const SOURCE_LABELS: Record<string, string> = {
  leads_on_demand: 'Leads on Demand',
  meridian_tower: 'Meridian Tower',
  eden_park: 'Eden Park',
  varah_swamy: 'Varah Swamy',
  sarjapur_plots: 'Sarjapur Plots',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
