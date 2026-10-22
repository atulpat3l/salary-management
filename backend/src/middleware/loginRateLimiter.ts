import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors';

export const LOGIN_RATE_WINDOW_MS = 15 * 60_000;

/** Slows down password guessing: at most `max` login attempts per IP per 15 minutes. */
export function createLoginRateLimiter(max: number) {
  return rateLimit({
    windowMs: LOGIN_RATE_WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'TOO_MANY_REQUESTS',
          'Too many login attempts. Please wait a few minutes and try again.',
        ),
      );
    },
  });
}
