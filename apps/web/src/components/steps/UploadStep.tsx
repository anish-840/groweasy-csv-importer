'use client';

import { useCallback, useRef, useState } from 'react';
import { cn, formatBytes } from '@/lib/utils';
import { AlertTriangle, FileText, Sparkles, UploadCloud } from '../icons';

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

const SAMPLES: Array<{ label: string; file: string }> = [
  { label: 'Facebook Lead Ads', file: 'facebook-leads.csv' },
  { label: 'Real-estate CRM', file: 'real-estate-crm.csv' },
  { label: 'Messy agency export', file: 'messy-agency.csv' },
];

function validate(file: File): string | null {
  const isCsv = /\.csv$/i.test(file.name) || /csv|text\/plain|excel|octet-stream/i.test(file.type);
  if (!isCsv) return 'Please choose a .csv file.';
  if (file.size > MAX_SIZE_BYTES) return `File is too large (max ${formatBytes(MAX_SIZE_BYTES)}).`;
  if (file.size === 0) return 'That file appears to be empty.';
  return null;
}

export function UploadStep({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      accept(e.dataTransfer.files?.[0]);
    },
    [accept],
  );

  const loadSample = useCallback(
    async (sample: { label: string; file: string }) => {
      setError(null);
      setLoadingSample(sample.file);
      try {
        const res = await fetch(`/samples/${sample.file}`);
        if (!res.ok) throw new Error();
        const text = await res.text();
        accept(new File([text], sample.file, { type: 'text/csv' }));
      } catch {
        setError('Could not load the sample file.');
      } finally {
        setLoadingSample(null);
      }
    },
    [accept],
  );

  return (
    <div className="animate-fade-in">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors',
          dragging
            ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-500/10'
            : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/70 dark:hover:bg-slate-800/50',
        )}
      >
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition-transform group-hover:scale-105',
            'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
          )}
        >
          <UploadCloud />
        </div>
        <p className="mt-5 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Drag & drop your CSV here
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          or <span className="font-medium text-brand-600 dark:text-brand-400">browse files</span> —
          any layout, any column names
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
          <AlertTriangle className="shrink-0 text-base" />
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Sparkles className="text-base text-brand-500" /> Try a sample:
        </span>
        {SAMPLES.map((s) => (
          <button
            key={s.file}
            onClick={() => loadSample(s)}
            disabled={loadingSample !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:ring-brand-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
          >
            <FileText className="text-sm text-slate-400" />
            {loadingSample === s.file ? 'Loading…' : s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
