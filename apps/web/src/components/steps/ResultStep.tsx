'use client';

import { useMemo, useState } from 'react';
import type { CrmRecord, SkippedRecord } from '@groweasy/shared';
import {
  CRM_COLUMN_LABELS,
  CRM_COLUMN_WIDTHS,
  CRM_FIELD_ORDER,
} from '@/lib/crmMeta';
import { downloadCrmCsv } from '@/lib/exportCsv';
import { cn, formatDuration, formatNumber } from '@/lib/utils';
import type { ExtractionState } from '../CsvImporter';
import { Column, DataTable } from '../DataTable';
import { StatusBadge, SourceBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { StatCard } from '../ui/StatCard';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Rows,
  SkipForward,
  Sparkles,
  Spinner,
} from '../icons';

type Tab = 'imported' | 'skipped';

export function ResultStep({
  state,
  fileName,
  onReset,
  onRetry,
}: {
  state: ExtractionState;
  fileName: string;
  onReset: () => void;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState<Tab>('imported');
  const streaming = state.status === 'streaming';

  const importedColumns = useMemo<Column<CrmRecord>[]>(
    () =>
      CRM_FIELD_ORDER.map((field) => ({
        key: field,
        label: CRM_COLUMN_LABELS[field],
        width: CRM_COLUMN_WIDTHS[field],
        render:
          field === 'crm_status'
            ? (row) => <StatusBadge status={row.crm_status} />
            : field === 'data_source'
              ? (row) => <SourceBadge source={row.data_source} />
              : undefined,
      })),
    [],
  );

  const skippedColumns = useMemo<Column<SkippedRecord>[]>(
    () => [
      { key: 'row', label: 'Row', width: 70, className: 'tabular-nums text-slate-400', render: (r) => r.rowIndex + 1 },
      { key: 'reason', label: 'Reason', width: 240 },
      {
        key: 'raw',
        label: 'Original data',
        width: 640,
        render: (r) => (
          <span className="text-slate-500 dark:text-slate-400">
            {Object.entries(r.raw)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join('  ·  ') || '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const pct = state.totalRows > 0 ? (state.processedRows / state.totalRows) * 100 : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Progress / status banner */}
      {streaming && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-500/20 dark:bg-brand-500/10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium text-brand-800 dark:text-brand-200">
              <Spinner className="text-lg text-brand-600 dark:text-brand-400" />
              {state.source === 'heuristic' ? 'Mapping fields…' : 'Extracting with AI…'}
            </div>
            <span className="text-sm tabular-nums text-brand-700 dark:text-brand-300">
              {formatNumber(state.processedRows)} / {formatNumber(state.totalRows)} rows
            </span>
          </div>
          <ProgressBar value={pct} indeterminate={state.totalRows === 0} />
          <p className="mt-2 text-xs text-brand-700/80 dark:text-brand-300/80">
            {state.model ? `Model: ${state.model} · ` : ''}
            Batch {Math.min(state.completedBatches + (streaming ? 1 : 0), state.totalBatches)} of{' '}
            {state.totalBatches}
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-lg text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-medium text-rose-800 dark:text-rose-200">Extraction failed</p>
              <p className="text-sm text-rose-700 dark:text-rose-300">{state.error}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onReset}>
              Start over
            </Button>
            <Button onClick={onRetry}>
              <RefreshCw className="text-base" /> Retry
            </Button>
          </div>
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total rows" value={state.totalRows} icon={<Rows />} tone="slate" />
        <StatCard label="Imported" value={state.records.length} icon={<CheckCircle />} tone="emerald" />
        <StatCard label="Skipped" value={state.skipped.length} icon={<SkipForward />} tone="amber" />
        <StatCard
          label={streaming ? 'Engine' : 'Completed in'}
          value={
            streaming
              ? state.source === 'heuristic'
                ? 'Heuristic'
                : 'Gemini AI'
              : state.summary
                ? formatDuration(state.summary.durationMs)
                : '—'
          }
          hint={state.model ?? (state.source === 'heuristic' ? 'No API key' : undefined)}
          icon={<Sparkles />}
          tone="indigo"
        />
      </div>

      {state.usedFallback && state.source !== 'heuristic' && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
          <AlertTriangle className="text-base" />
          Some batches used the heuristic fallback after AI retries were exhausted.
        </div>
      )}

      {/* Tabs + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <TabButton active={tab === 'imported'} onClick={() => setTab('imported')}>
            Imported <Count>{state.records.length}</Count>
          </TabButton>
          <TabButton active={tab === 'skipped'} onClick={() => setTab('skipped')}>
            Skipped <Count>{state.skipped.length}</Count>
          </TabButton>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReset}>
            Import another
          </Button>
          <Button
            onClick={() => downloadCrmCsv(state.records, `crm-${fileName.replace(/\.csv$/i, '')}.csv`)}
            disabled={state.records.length === 0}
          >
            <Download className="text-base" /> Download CRM CSV
          </Button>
        </div>
      </div>

      {tab === 'imported' ? (
        <DataTable
          columns={importedColumns}
          rows={state.records}
          maxHeight={520}
          emptyMessage={streaming ? 'Waiting for the first records…' : 'No records were imported.'}
          rowKey={(_r, i) => i}
        />
      ) : (
        <DataTable
          columns={skippedColumns}
          rows={state.skipped}
          maxHeight={520}
          emptyMessage="No rows were skipped. 🎉"
          rowKey={(r) => r.rowIndex}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-600 dark:text-slate-200">
      {children}
    </span>
  );
}
