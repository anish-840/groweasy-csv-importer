'use client';

import { useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/api';
import { AlertTriangle, Sparkles, X } from './icons';

type Status = 'loading' | 'ai' | 'heuristic' | 'offline';

export function ApiStatusBadge() {
  const [status, setStatus] = useState<Status>('loading');
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((h) => {
        setStatus(h.aiEnabled ? 'ai' : 'heuristic');
        setModel(h.model);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  const config = {
    loading: { text: 'Checking API…', className: 'text-slate-500 ring-slate-200 dark:text-slate-400 dark:ring-slate-700', icon: null },
    ai: {
      text: model ? `AI: ${model}` : 'AI extraction on',
      className: 'text-brand-700 ring-brand-200 bg-brand-50 dark:text-brand-300 dark:ring-brand-500/25 dark:bg-brand-500/10',
      icon: <Sparkles className="text-sm" />,
    },
    heuristic: {
      text: 'Heuristic mode (no API key)',
      className: 'text-amber-700 ring-amber-200 bg-amber-50 dark:text-amber-300 dark:ring-amber-500/25 dark:bg-amber-500/10',
      icon: <AlertTriangle className="text-sm" />,
    },
    offline: {
      text: 'API offline',
      className: 'text-rose-700 ring-rose-200 bg-rose-50 dark:text-rose-300 dark:ring-rose-500/25 dark:bg-rose-500/10',
      icon: <X className="text-sm" />,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.icon}
      {config.text}
    </span>
  );
}
