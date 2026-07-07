import { config } from '../../config.js';
import { createFallbackProvider } from './fallback.js';
import { createGeminiProvider } from './gemini.js';
import type { ExtractionProvider } from './types.js';

/** Selects the primary extraction provider based on configuration. */
export function createProvider(): ExtractionProvider {
  return config.aiEnabled ? createGeminiProvider() : createFallbackProvider();
}

export { createFallbackProvider, createGeminiProvider };
