import { Router, type Request, type Response, type NextFunction } from 'express';
import { getCsvFromRequest, uploadCsv } from '../middleware/upload.js';
import { runExtraction } from '../services/extraction/orchestrator.js';
import { logger } from '../logger.js';

export const extractRouter = Router();

/** Wraps multer so its errors flow through the async chain into the error handler. */
function withUpload(handler: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction): void => {
    uploadCsv(req, res, (err) => {
      if (err) return next(err);
      handler(req, res, next);
    });
  };
}

/**
 * POST /api/extract
 * Buffered extraction. Accepts a multipart `file` upload or JSON `{ csv }`.
 * Returns the full `ExtractResponse` once every batch has been processed.
 */
extractRouter.post(
  '/extract',
  withUpload(async (req, res, next) => {
    try {
      const csv = getCsvFromRequest(req);
      const result = await runExtraction(csv);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }),
);

/**
 * POST /api/extract/stream
 * Streaming extraction over NDJSON (one JSON `StreamEvent` per line). The client
 * reads events incrementally to drive live progress and partial results.
 */
extractRouter.post(
  '/extract/stream',
  withUpload(async (req, res, next) => {
    let csv: string;
    try {
      csv = getCsvFromRequest(req);
    } catch (err) {
      return next(err);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx)
    res.flushHeaders?.();

    const write = (event: unknown): void => {
      res.write(`${JSON.stringify(event)}\n`);
    };

    try {
      await runExtraction(csv, write);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed.';
      logger.error('Streaming extraction failed', { message });
      // Headers already sent — surface the failure as a terminal stream event.
      write({ type: 'error', message });
    } finally {
      res.end();
    }
  }),
);
