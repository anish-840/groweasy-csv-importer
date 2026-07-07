import { cn } from '@/lib/utils';

/**
 * Progress bar. When `indeterminate` it shows an animated stripe; otherwise it
 * fills to `value` (0–100).
 */
export function ProgressBar({
  value,
  indeterminate = false,
  className,
}: {
  value: number;
  indeterminate?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        'h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800',
        className,
      )}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-[width] duration-500 ease-out',
          indeterminate &&
            'w-1/3 animate-bar-stripes bg-[length:2rem_100%] bg-[linear-gradient(45deg,rgba(255,255,255,0.25)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.25)_50%,rgba(255,255,255,0.25)_75%,transparent_75%)]',
        )}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}
