export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry with the attempt number (1-based) and the error. */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Return false to stop retrying a particular error. */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Runs `fn`, retrying on failure with exponential backoff + jitter.
 * Resolves with the first successful result; rejects with the last error.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, baseDelayMs = 400, maxDelayMs = 8_000, onRetry, shouldRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || (shouldRetry && !shouldRetry(error))) break;
      onRetry?.(attempt + 1, error);
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = backoff * 0.25 * Math.random();
      await sleep(backoff + jitter);
    }
  }
  throw lastError;
}

/**
 * Maps `items` through async `fn` with bounded concurrency, preserving input order
 * in the returned array. Unlike `Promise.all`, at most `limit` tasks run at once.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const bound = Math.max(1, Math.min(limit, items.length || 1));

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: bound }, () => worker()));
  return results;
}
