import { cn } from '@/lib/utils';
import { STATUS_STYLES, statusLabel, sourceLabel } from '@/lib/crmMeta';

const NEUTRAL =
  'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-400/20';

function BasePill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-slate-400 dark:text-slate-600">—</span>;
  return <BasePill className={STATUS_STYLES[status] ?? NEUTRAL}>{statusLabel(status)}</BasePill>;
}

export function SourceBadge({ source }: { source: string }) {
  if (!source) return <span className="text-slate-400 dark:text-slate-600">—</span>;
  return (
    <BasePill className="bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25">
      {sourceLabel(source)}
    </BasePill>
  );
}
