import type { RequestHandler } from 'express';
import type { Role } from '../domain/constants';
import { AppError } from '../lib/errors';
import { getAuth } from './authenticate';

/**
 * FR-AUTH-02: lets the request through only for the given roles. Mount after `authenticate`.
 * Enforced on the server, so hiding links in the UI is never the only protection (NFR-06).
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(getAuth(req).role)) throw AppError.forbidden();
    next();
  };
}
