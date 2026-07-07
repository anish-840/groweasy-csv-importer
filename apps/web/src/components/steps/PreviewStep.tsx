'use client';

import { useMemo } from 'react';
import type { ClientParsedCsv } from '@/lib/csv';
import { formatBytes, formatNumber } from '@/lib/utils';
import { Column, DataTable } from '../DataTable';
import { Button } from '../ui/Button';
import { ArrowLeft, ArrowRight, FileText, Rows, Sparkles, Table } from '../icons';

interface PreviewRow extends Record<string, string> {
  __index: string;
}

export function PreviewStep({
  file,
  parsed,
  onConfirm,
  onBack,
}: {
  file: File;
  parsed: ClientParsedCsv;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const columns = useMemo<Column<PreviewRow>[]>(() => {
    const indexCol: Column<PreviewRow> = {
      key: '__index',
      label: '#',
      width: 56,
      className: 'text-slate-400 tabular-nums',
    };
    const dataCols: Column<PreviewRow>[] = parsed.headers.map((h) => ({
      key: h,
      label: h,
      width: 190,
    }));
    return [indexCol, ...dataCols];
  }, [parsed.headers]);

  const rows = useMemo<PreviewRow[]>(
    () => parsed.rows.map((r, i) => ({ ...r, __index: String(i + 1) })),
    [parsed.rows],
  );

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <FileText />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatBytes(file.size)} · {formatNumber(parsed.rowCount)} rows ·{' '}
              {parsed.headers.length} columns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="text-base" /> Choose another
          </Button>
          <Button onClick={onConfirm}>
            <Sparkles className="text-base" /> Confirm & Extract with AI
            <ArrowRight className="text-base" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-800">
        <Rows className="text-base text-slate-400" />
        This is a raw preview of your file.{' '}
        <span className="font-medium text-slate-600 dark:text-slate-300">No AI runs yet</span> —
        extraction starts only when you confirm.
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Table className="text-base text-brand-500" /> Uploaded data
        </div>
        <DataTable columns={columns} rows={rows} maxHeight={460} rowKey={(_r, i) => i} />
      </div>
    </div>
  );
}
