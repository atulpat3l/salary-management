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

/** Reads `Authorization: Bearer <token>`, checks the session and attaches the user to `req.auth`. */
async function authenticateRequest(req: Request): Promise<AuthContext> {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const sessionId = token ? verifyToken(token) : null;
  if (!sessionId) throw AppError.unauthorized();

  req.auth = await resolveSession(sessionId);
  return req.auth;
}

/**
 * FR-AUTH-02: rejects any request without a valid token and live session.
 * FR-AUTH-04: also rejects users who must still replace their temporary password.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const auth = await authenticateRequest(req);
  if (auth.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'You must change your temporary password before continuing',
    );
  }
  next();
};

/** Like `authenticate`, but lets through users with a pending password change.
 *  Only for the routes they need to complete it: me, logout and change-password. */
export const authenticateAllowingPasswordChange: RequestHandler = async (req, _res, next) => {
  await authenticateRequest(req);
  next();
};

/** The authenticated user. Only call this in handlers mounted behind an authenticate middleware. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new Error('getAuth() called on a route without the authenticate middleware');
  return req.auth;
}
