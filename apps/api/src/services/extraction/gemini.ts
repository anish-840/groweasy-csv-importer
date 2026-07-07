import { GoogleGenAI } from '@google/genai';
import { CRM_FIELDS, aiCrmRecordSchema } from '@groweasy/shared';
import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import { SYSTEM_PROMPT, buildBatchContent } from './prompt.js';
import type { Batch, ExtractionProvider, ProviderRecord } from './types.js';

/**
 * Gemini structured-output schema. Every CRM field is a string ("" when unknown)
 * and each record echoes back `_row` so we can re-align results to inputs even if
 * the model reorders or drops items. Controlled vocabularies are intentionally NOT
 * constrained here (so "" stays valid) — they are enforced in post-processing.
 */
const responseSchema = {
  type: 'object',
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _row: { type: 'integer' },
          ...Object.fromEntries(CRM_FIELDS.map((f) => [f, { type: 'string' }])),
        },
        required: ['_row', ...CRM_FIELDS],
        propertyOrdering: ['_row', ...CRM_FIELDS],
      },
    },
  },
  required: ['records'],
} as const;

/** Creates a Gemini-backed extraction provider. Requires `config.gemini.apiKey`. */
export function createGeminiProvider(): ExtractionProvider {
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const model = config.gemini.model;

  return {
    name: 'gemini',
    model,
    async extractBatch(batch: Batch, headers: string[]): Promise<ProviderRecord[]> {
      const response = await ai.models.generateContent({
        model,
        contents: buildBatchContent(batch, headers),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0,
          responseMimeType: 'application/json',
          // `responseSchema` typings are loose across SDK versions; the runtime
          // accepts this OpenAPI-subset object.
          responseSchema: responseSchema as unknown as Record<string, unknown>,
        },
      });

      const text = response.text;
      if (!text) {
        throw new AppError('Gemini returned an empty response.', 502, 'AI_EMPTY_RESPONSE');
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AppError('Gemini returned invalid JSON.', 502, 'AI_INVALID_JSON');
      }

      const rawRecords = (json as { records?: unknown }).records;
      if (!Array.isArray(rawRecords)) {
        throw new AppError('Gemini response missing "records" array.', 502, 'AI_BAD_SHAPE');
      }

      return rawRecords.map((entry) => {
        const parsed = aiCrmRecordSchema.parse(entry);
        const rowValue = (entry as { _row?: unknown })._row;
        const rowIndex = typeof rowValue === 'number' ? rowValue : Number(rowValue);
        return { ...parsed, _row: Number.isFinite(rowIndex) ? rowIndex : undefined };
      });
    },
  };
}
