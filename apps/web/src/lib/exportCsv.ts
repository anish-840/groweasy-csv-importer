import Papa from 'papaparse';
import { CRM_FIELDS, type CrmRecord } from '@groweasy/shared';

/** Serialises CRM records into a GrowEasy-format CSV string (canonical column order). */
export function buildCrmCsv(records: CrmRecord[]): string {
  // Papa auto-quotes any field containing a comma, quote, or newline, so the
  // output stays valid without blanket-quoting every cell (and the header).
  return Papa.unparse(
    {
      fields: [...CRM_FIELDS],
      data: records.map((r) => CRM_FIELDS.map((f) => r[f])),
    },
    { newline: '\n' },
  );
}

/** Triggers a browser download of the records as a CSV file. */
export function downloadCrmCsv(records: CrmRecord[], filename = 'groweasy-crm-import.csv'): void {
  const csv = buildCrmCsv(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
