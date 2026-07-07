import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import type { ApiError } from '@groweasy/shared';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

/** 404 handler for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiError = { error: { message: 'Route not found.', code: 'NOT_FOUND' } };
  res.status(404).json(body);
}

/** Central error handler — turns thrown errors into a consistent JSON envelope. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong.';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  } else if (err instanceof MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is too large.' : err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    logger.error('Unhandled error', { message, err: err instanceof Error ? err.stack : err });
  }

  const body: ApiError = { error: { message, code } };
  res.status(statusCode).json(body);
}
