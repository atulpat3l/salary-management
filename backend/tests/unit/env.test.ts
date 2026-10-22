import { parseEnv } from '../../src/config/env';

describe('parseEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'file:./dev.db',
      CORS_ORIGIN: ['http://localhost:5173'],
    });
  });

  it('rejects a DATABASE_URL that is not a SQLite file URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgres://localhost/db' })).toThrow(/DATABASE_URL/);
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
});
