import type { CrmRecord } from './crm';

/** Which engine produced a record / batch. */
export type ExtractionSource = 'gemini' | 'heuristic';

/** A source row that could not be imported, with the reason why. */
export interface SkippedRecord {
  /** Zero-based index of the row in the parsed CSV (data rows, excluding header). */
  rowIndex: number;
  /** Human-readable reason the row was skipped. */
  reason: string;
  /** The original row as parsed from the CSV, for display/debugging. */
  raw: Record<string, string>;
}

/** Roll-up returned once extraction finishes. */
export interface ExtractionSummary {
  totalRows: number;
  imported: number;
  skipped: number;
  batches: number;
  /** Which engine handled the majority of the work. */
  source: ExtractionSource;
  /** True if any batch fell back to the heuristic engine (e.g. after AI retries failed). */
  usedFallback: boolean;
  model: string | null;
  durationMs: number;
}

/** Response body of the non-streaming `POST /api/extract` endpoint. */
export interface ExtractResponse {
  records: CrmRecord[];
  skipped: SkippedRecord[];
  summary: ExtractionSummary;
}

/**
 * NDJSON events emitted by `POST /api/extract/stream` — one JSON object per line.
 * The client reads these incrementally to drive live progress + partial results.
 */
export type StreamEvent =
  | {
      type: 'start';
      totalRows: number;
      totalBatches: number;
      source: ExtractionSource;
      model: string | null;
    }
  | {
      type: 'batch';
      batchIndex: number;
      /** Records successfully extracted from this batch (already normalised). */
      records: CrmRecord[];
      /** Rows in this batch that were skipped. */
      skipped: SkippedRecord[];
      /** How the batch was processed (gemini, or heuristic if it fell back). */
      source: ExtractionSource;
      /** Total rows processed so far (across all completed batches). */
      processedRows: number;
    }
  | {
      /** A non-fatal problem with a single batch (it still resolves via fallback). */
      type: 'warning';
      batchIndex: number;
      message: string;
    }
  | {
      type: 'done';
      summary: ExtractionSummary;
    }
  | {
      /** A fatal error that aborts the whole extraction. */
      type: 'error';
      message: string;
    };

/** Standard error envelope returned by the API on failures. */
export interface ApiError {
  error: {
    message: string;
    code: string;
  };
}
