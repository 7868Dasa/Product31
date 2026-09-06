/**
 * Global JSON error handler (spec §5 "Global JSON error handler", §8 "return
 * generic error messages to clients; keep stack traces server-side").
 */
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Postgres unique-violation -> 409 without leaking the constraint internals.
  if (err && err.code === '23505') {
    logger.warn({ constraint: err.constraint }, 'unique violation surfaced to handler');
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'That resource already exists' },
    });
  }

  logger.error({ err, path: req.originalUrl, method: req.method }, 'unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
  });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
