import 'dotenv/config';

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const geminiApiKey = str('GEMINI_API_KEY', '').trim();
const forceFallback = bool('FORCE_FALLBACK', false);

export const config = {
  port: int('PORT', 8080),
  corsOrigin: str('CORS_ORIGIN', '*'),
  nodeEnv: str('NODE_ENV', 'development'),

  gemini: {
    apiKey: geminiApiKey,
    model: str('GEMINI_MODEL', 'gemini-2.5-flash'),
  },

  extraction: {
    batchSize: Math.max(1, int('BATCH_SIZE', 20)),
    batchConcurrency: Math.max(1, int('BATCH_CONCURRENCY', 3)),
    maxRetries: Math.max(0, int('MAX_RETRIES', 3)),
    maxRows: Math.max(1, int('MAX_ROWS', 10_000)),
  },

  upload: {
    maxFileSizeBytes: Math.max(1, int('MAX_FILE_SIZE_MB', 15)) * 1024 * 1024,
  },

  forceFallback,

  /** True when real AI extraction should be used. */
  get aiEnabled(): boolean {
    return this.gemini.apiKey.length > 0 && !this.forceFallback;
  },
} as const;

export type AppConfig = typeof config;
