import type { Request } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { BadRequestError } from '../errors.js';

/**
 * Multipart upload handler for a single `file` field, buffered in memory.
 * Accepts `.csv` / text-ish content types; rejects anything obviously not CSV.
 */
export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSizeBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const okType =
      /csv|text\/plain|application\/vnd\.ms-excel|octet-stream/i.test(file.mimetype) ||
      /\.csv$/i.test(file.originalname);
    if (okType) cb(null, true);
    else cb(new BadRequestError('Only CSV files are supported.', 'UNSUPPORTED_FILE_TYPE'));
  },
}).single('file');

/**
 * Resolves the CSV text from a request, supporting either a multipart file upload
 * (`file` field) or a JSON body (`{ "csv": "..." }`).
 */
export function getCsvFromRequest(req: Request): string {
  if (req.file?.buffer) {
    return req.file.buffer.toString('utf8');
  }
  const body = req.body as { csv?: unknown } | undefined;
  if (body && typeof body.csv === 'string' && body.csv.trim() !== '') {
    return body.csv;
  }
  throw new BadRequestError(
    'No CSV provided. Upload a file in the "file" field or send { "csv": "..." }.',
    'NO_CSV',
  );
}
