import { parseEnv } from '../../src/config/env';

const PRODUCTION_SECRET = 'a-production-secret-with-more-than-32-characters';

describe('parseEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'file:./dev.db',
      CORS_ORIGIN: ['http://localhost:5173'],
      JWT_SECRET: expect.any(String),
      SESSION_IDLE_MINUTES: 30,
      BCRYPT_ROUNDS: 10,
      LOGIN_RATE_LIMIT: 20,
    });
  });

  it('coerces PORT to a number and splits CORS_ORIGIN into a trimmed list', () => {
    const env = parseEnv({ PORT: '8080', CORS_ORIGIN: 'http://a.test, http://b.test ,' });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGIN).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rejects an invalid PORT with a readable message', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/Invalid environment configuration: PORT/);
  });

  it('rejects an unknown NODE_ENV and LOG_LEVEL, listing both', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging', LOG_LEVEL: 'loud' })).toThrow(
      /NODE_ENV.*LOG_LEVEL/,
    );
  });

  it('rejects a DATABASE_URL that is not a SQLite file URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgres://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  describe('JWT_SECRET', () => {
    it('uses a built-in development secret outside production', () => {
      expect(parseEnv({ NODE_ENV: 'development' }).JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it('treats an empty value (as copied from .env.example) as not set', () => {
      expect(() => parseEnv({ JWT_SECRET: '' })).not.toThrow();
    });

    it('is required in production', () => {
      expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(
        /JWT_SECRET: is required in production/,
      );
      expect(parseEnv({ NODE_ENV: 'production', JWT_SECRET: PRODUCTION_SECRET }).JWT_SECRET).toBe(
        PRODUCTION_SECRET,
      );
    });

    it('must be at least 32 characters', () => {
      expect(() => parseEnv({ JWT_SECRET: 'too-short' })).toThrow(
        /JWT_SECRET: must be at least 32/,
      );
    });
  });

  it('keeps BCRYPT_ROUNDS within a safe range', () => {
    expect(() => parseEnv({ BCRYPT_ROUNDS: '3' })).toThrow(/BCRYPT_ROUNDS/);
    expect(() => parseEnv({ BCRYPT_ROUNDS: '16' })).toThrow(/BCRYPT_ROUNDS/);
  });
});
