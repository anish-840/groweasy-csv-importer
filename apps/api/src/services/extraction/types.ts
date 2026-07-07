import type { AiCrmRecord, ExtractionSource } from '@groweasy/shared';

/** A contiguous slice of parsed rows handed to a provider as one request. */
export interface Batch {
  /** Global index (into the full row list) of this batch's first row. */
  startIndex: number;
  rows: Array<Record<string, string>>;
}

/** A record as returned by a provider, including the echoed source row index. */
export type ProviderRecord = AiCrmRecord & { _row?: number };

/**
 * A pluggable extraction engine. Both the Gemini engine and the deterministic
 * heuristic engine implement this so the orchestrator can treat them uniformly.
 */
export interface ExtractionProvider {
  readonly name: ExtractionSource;
  readonly model: string | null;
  /** Map one batch of raw rows into (loosely-typed) CRM records. */
  extractBatch(batch: Batch, headers: string[]): Promise<ProviderRecord[]>;
}
