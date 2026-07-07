'use client';

import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  width: number;
  /** Custom cell renderer; defaults to the string value at `key`. */
  render?: (row: T, rowIndex: number) => ReactNode;
  className?: string;
}

const ROW_HEIGHT = 44;

/**
 * A virtualized, horizontally + vertically scrollable table with a sticky header.
 * Only the visible rows are rendered, so it stays smooth for very large CSVs.
 */
export function DataTable<T>({
  columns,
  rows,
  maxHeight = 460,
  emptyMessage = 'No rows to display.',
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  maxHeight?: number;
  emptyMessage?: string;
  rowKey?: (row: T, index: number) => string | number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-soft dark:border-slate-800">
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }}>
        <div style={{ minWidth: totalWidth }}>
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            {columns.map((col) => (
              <div
                key={col.key}
                style={{ width: col.width }}
                className="shrink-0 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Virtualized body */}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = rows[vItem.index] as T;
              return (
                <div
                  key={rowKey ? rowKey(row, vItem.index) : vItem.key}
                  className="absolute left-0 flex w-full items-center border-b border-slate-100 bg-white text-sm text-slate-700 transition-colors hover:bg-brand-50/40 dark:border-slate-800/70 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/40"
                  style={{ height: ROW_HEIGHT, transform: `translateY(${vItem.start}px)` }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      style={{ width: col.width }}
                      className={cn('shrink-0 truncate px-3', col.className)}
                      title={typeof (row as Record<string, unknown>)[col.key] === 'string'
                        ? ((row as Record<string, string>)[col.key] as string)
                        : undefined}
                    >
                      {col.render
                        ? col.render(row, vItem.index)
                        : renderValue((row as Record<string, unknown>)[col.key])}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }
  return String(value);
}
