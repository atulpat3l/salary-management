import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

/**
 * Absolute lifetime of a token. Inactivity logout (FR-AUTH-03) is enforced separately by the
 * session's lastActivityAt, so this only caps how long one login can last.
 */
export const TOKEN_LIFETIME = '12h';

/**
 * The token carries only the session id. Role, status and password-change state are read from
 * the database on every request, so changes (e.g. deactivation) take effect immediately.
 */
export function signToken(sessionId: string, secret: string = env.JWT_SECRET): string {
  return jwt.sign({ sid: sessionId }, secret, { algorithm: 'HS256', expiresIn: TOKEN_LIFETIME });
}

/** Returns the session id, or null if the token is malformed, tampered with or expired. */
export function verifyToken(token: string, secret: string = env.JWT_SECRET): string | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
}
