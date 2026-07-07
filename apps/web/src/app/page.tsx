import { ApiStatusBadge } from '@/components/ApiStatusBadge';
import { CsvImporter } from '@/components/CsvImporter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sparkles } from '@/components/icons';

const FEATURES = [
  'Any column names',
  'AI field mapping',
  'Batch + streaming',
  'Skips invalid rows',
];

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Decorative gradient backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-300/40 via-emerald-200/30 to-sky-200/30 blur-3xl dark:from-brand-500/20 dark:via-emerald-500/10 dark:to-sky-500/10" />
      </div>

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-600 text-lg text-white shadow-sm">
            <Sparkles />
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-slate-900 dark:text-white">GrowEasy</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">AI CSV Importer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ApiStatusBadge />
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="mx-auto max-w-3xl pb-8 pt-6 text-center sm:pt-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200 backdrop-blur dark:bg-slate-900/60 dark:text-brand-300 dark:ring-brand-500/25">
            <Sparkles className="text-sm" /> Powered by Google Gemini
          </span>
          <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Turn any messy CSV into clean{' '}
            <span className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-transparent">
              CRM leads
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            Upload a Facebook or Google lead export, a real-estate CRM dump, or a hand-made
            spreadsheet. Our AI figures out the columns and maps them into GrowEasy CRM format.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {FEATURES.map((f) => (
              <span
                key={f}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
              >
                {f}
              </span>
            ))}
          </div>
          <div className="mt-4 flex justify-center sm:hidden">
            <ApiStatusBadge />
          </div>
        </section>

        <CsvImporter />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-slate-400 dark:text-slate-600 sm:px-6">
        Built for the GrowEasy assignment · Next.js + Express + Gemini
      </footer>
    </div>
  );
}
