import type { StreamEvent } from '@groweasy/shared';

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'
).replace(/\/$/, '');

export interface HealthInfo {
  status: string;
  aiEnabled: boolean;
  model: string | null;
  mode: 'gemini' | 'heuristic';
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE_URL}/api/health`, { signal });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return (await res.json()) as HealthInfo;
}

export interface StreamHandlers {
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

/**
 * Uploads a CSV file to the streaming endpoint and dispatches each NDJSON
 * `StreamEvent` as it arrives, driving live progress + partial results.
 * Resolves when the stream completes; rejects on transport/HTTP errors or abort.
 */
export async function streamExtract(file: File, handlers: StreamHandlers): Promise<void> {
  const form = new FormData();
  form.append('file', file, file.name || 'upload.csv');

  const res = await fetch(`${API_BASE_URL}/api/extract/stream`, {
    method: 'POST',
    body: form,
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      handlers.onEvent(JSON.parse(trimmed) as StreamEvent);
    } catch {
      /* ignore partial/non-JSON lines */
    }
  };

  // Read the NDJSON stream line-by-line.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      flushLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
    }
  }
  flushLine(buffer);
}
