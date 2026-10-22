import type { Request, RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { resolveSession, type AuthContext } from '../modules/auth/auth.service';
import { verifyToken } from '../modules/auth/token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** FR-AUTH-02: rejects any request without a valid `Authorization: Bearer <token>` and live session. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const sessionId = token ? verifyToken(token) : null;
  if (!sessionId) throw AppError.unauthorized();

  req.auth = await resolveSession(sessionId);
  next();
};

/** The authenticated user. Only call this in handlers mounted behind `authenticate`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new Error('getAuth() called on a route without the authenticate middleware');
  return req.auth;
}
