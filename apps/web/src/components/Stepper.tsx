import { cn } from '@/lib/utils';
import { Check } from './icons';

export type StepId = 'upload' | 'preview' | 'result';

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'preview', label: 'Preview & Confirm' },
  { id: 'result', label: 'Results' },
];

export function Stepper({ current }: { current: StepId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
        return (
          <li key={step.id} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 transition-colors',
                  state === 'done' &&
                    'bg-brand-600 text-white ring-brand-600',
                  state === 'active' &&
                    'bg-brand-50 text-brand-700 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-300',
                  state === 'todo' &&
                    'bg-transparent text-slate-400 ring-slate-300 dark:text-slate-500 dark:ring-slate-700',
                )}
              >
                {state === 'done' ? <Check className="text-sm" /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:inline',
                  state === 'todo'
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-slate-700 dark:text-slate-200',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  'h-px w-6 sm:w-10',
                  i < currentIndex ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
