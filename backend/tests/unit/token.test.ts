import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../../src/modules/auth/token';

const SECRET = 'unit-test-secret-that-is-at-least-32-chars';

describe('FR-AUTH-02: session tokens', () => {
  it('round-trips the session id', () => {
    expect(verifyToken(signToken('session-123', SECRET), SECRET)).toBe('session-123');
  });

  it('contains only the session id and timing claims — no role or personal data', () => {
    const payload = jwt.decode(signToken('session-123', SECRET)) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sid']);
    expect((payload.exp as number) - (payload.iat as number)).toBe(12 * 60 * 60);
  });

  it('rejects a token signed with another secret', () => {
    const forged = signToken('session-123', 'some-other-secret-that-is-32-chars-long');
    expect(verifyToken(forged, SECRET)).toBeNull();
  });

  it('rejects a tampered token', () => {
    const [header, , signature] = signToken('session-123', SECRET).split('.');
    const fakePayload = Buffer.from(JSON.stringify({ sid: 'someone-else' })).toString('base64url');
    expect(verifyToken(`${header}.${fakePayload}.${signature}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { sid: 'session-123', exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );
    expect(verifyToken(expired, SECRET)).toBeNull();
  });

  it('rejects an unsigned ("alg: none") token', () => {
    const unsigned = jwt.sign({ sid: 'session-123' }, '', { algorithm: 'none' });
    expect(verifyToken(unsigned, SECRET)).toBeNull();
  });

  it('rejects a valid token without a session id, and garbage', () => {
    expect(verifyToken(jwt.sign({ user: 1 }, SECRET), SECRET)).toBeNull();
    expect(verifyToken('not-a-jwt', SECRET)).toBeNull();
  });
});
