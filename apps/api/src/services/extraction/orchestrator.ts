import type {
  CrmRecord,
  ExtractResponse,
  ExtractionSource,
  ExtractionSummary,
  SkippedRecord,
  StreamEvent,
} from '@groweasy/shared';
import { config } from '../../config.js';
import { PayloadTooLargeError } from '../../errors.js';
import { logger } from '../../logger.js';
import { mapWithConcurrency, withRetry } from '../../utils/async.js';
import { parseCsv } from '../csv.js';
import { normalizeRecord } from './postprocess.js';
import { createFallbackProvider, createProvider } from './provider.js';
import type { Batch, ExtractionProvider, ProviderRecord } from './types.js';

/** Callback used to stream progress events; omit for the buffered (non-stream) path. */
export type EventSink = (event: StreamEvent) => void;

interface BatchOutcome {
  records: CrmRecord[];
  skipped: SkippedRecord[];
  source: ExtractionSource;
}

function splitIntoBatches(rows: Array<Record<string, string>>, size: number): Batch[] {
  const batches: Batch[] = [];
  for (let i = 0; i < rows.length; i += size) {
    batches.push({ startIndex: i, rows: rows.slice(i, i + size) });
  }
  return batches;
}

/** Aligns provider records to their source rows using the echoed `_row`, positional as backup. */
function alignByRow(results: ProviderRecord[], batch: Batch): Map<number, ProviderRecord> {
  const byRow = new Map<number, ProviderRecord>();
  results.forEach((rec, j) => {
    const key =
      typeof rec._row === 'number' && Number.isFinite(rec._row)
        ? rec._row
        : batch.startIndex + j;
    if (!byRow.has(key)) byRow.set(key, rec);
  });
  return byRow;
}

/**
 * Runs the full extraction pipeline: parse -> batch -> (AI with retry, falling back
 * to the heuristic engine per-batch on failure) -> deterministic post-processing.
 *
 * Emits `StreamEvent`s through `onEvent` (if provided) as batches complete, and also
 * returns the fully-assembled result once everything settles.
 */
export async function runExtraction(csvText: string, onEvent?: EventSink): Promise<ExtractResponse> {
  const startedAt = Date.now();
  const { headers, rows } = parseCsv(csvText);

  if (rows.length > config.extraction.maxRows) {
    throw new PayloadTooLargeError(
      `CSV has ${rows.length} rows, which exceeds the limit of ${config.extraction.maxRows}.`,
      'TOO_MANY_ROWS',
    );
  }

  const provider = createProvider();
  const fallback: ExtractionProvider =
    provider.name === 'heuristic' ? provider : createFallbackProvider();
  const batches = splitIntoBatches(rows, config.extraction.batchSize);

  onEvent?.({
    type: 'start',
    totalRows: rows.length,
    totalBatches: batches.length,
    source: provider.name,
    model: provider.model,
  });

  let usedFallback = provider.name === 'heuristic';
  let processedRows = 0;

  const outcomes = await mapWithConcurrency(
    batches,
    config.extraction.batchConcurrency,
    async (batch, batchIndex): Promise<BatchOutcome> => {
      let results: ProviderRecord[];
      let batchSource: ExtractionSource = provider.name;

      try {
        results = await withRetry(() => provider.extractBatch(batch, headers), {
          retries: config.extraction.maxRetries,
          onRetry: (attempt, error) =>
            logger.warn(`Batch ${batchIndex} AI attempt ${attempt} failed; retrying`, {
              error: error instanceof Error ? error.message : String(error),
            }),
        });
      } catch (error) {
        // AI exhausted retries — fall back to the deterministic engine for this batch.
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Batch ${batchIndex} falling back to heuristic engine`, { message });
        onEvent?.({
          type: 'warning',
          batchIndex,
          message: `AI extraction failed for batch ${batchIndex + 1}; used heuristic fallback.`,
        });
        results = await fallback.extractBatch(batch, headers);
        batchSource = 'heuristic';
        usedFallback = true;
      }

      const byRow = alignByRow(results, batch);
      const records: CrmRecord[] = [];
      const skipped: SkippedRecord[] = [];

      batch.rows.forEach((sourceRow, j) => {
        const globalIndex = batch.startIndex + j;
        const raw = byRow.get(globalIndex) ?? {};
        const { record, skipped: skip } = normalizeRecord(raw, sourceRow, globalIndex);
        if (record) records.push(record);
        if (skip) skipped.push(skip);
      });

      processedRows += batch.rows.length;
      onEvent?.({
        type: 'batch',
        batchIndex,
        records,
        skipped,
        source: batchSource,
        processedRows,
      });

      return { records, skipped, source: batchSource };
    },
  );

  const records = outcomes.flatMap((o) => o.records);
  const skipped = outcomes.flatMap((o) => o.skipped);

  const summary: ExtractionSummary = {
    totalRows: rows.length,
    imported: records.length,
    skipped: skipped.length,
    batches: batches.length,
    source: provider.name,
    usedFallback,
    model: provider.model,
    durationMs: Date.now() - startedAt,
  };

  onEvent?.({ type: 'done', summary });
  return { records, skipped, summary };
}
