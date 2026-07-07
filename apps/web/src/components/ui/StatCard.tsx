import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils';

type Tone = 'brand' | 'emerald' | 'amber' | 'slate' | 'indigo';

const TONES: Record<Tone, string> = {
  brand: 'text-brand-600 bg-brand-50 dark:text-brand-300 dark:bg-brand-500/10',
  emerald: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
  amber: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  slate: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700/40',
  indigo: 'text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/10',
};

export function StatCard({
  label,
  value,
  icon,
  tone = 'slate',
  hint,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl', TONES[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
        <div className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {hint && <div className="truncate text-xs text-slate-400 dark:text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}
