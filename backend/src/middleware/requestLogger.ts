import type { RequestHandler } from 'express';
import { logger } from '../lib/logger';

/** Logs one line per request. Bodies and headers are never logged, so credentials cannot leak (NFR-06). */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  // Captured now: inside routers req.path becomes router-relative. The query string is dropped.
  const path = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.http(`${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });
  next();
};
