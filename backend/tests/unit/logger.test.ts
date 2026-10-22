import { redact } from '../../src/lib/logger';

describe('NFR-06: redact', () => {
  it('masks sensitive keys regardless of case', () => {
    expect(
      redact({
        loginId: 'EMP00001',
        password: 'secret1',
        newPassword: 'x',
        Authorization: 'Bearer t',
      }),
    ).toEqual({
      loginId: 'EMP00001',
      password: '[REDACTED]',
      newPassword: '[REDACTED]',
      Authorization: '[REDACTED]',
    });
  });

  it('masks sensitive keys in nested objects and arrays', () => {
    expect(
      redact({ user: { temporaryPassword: 'abc', name: 'A' }, list: [{ token: 't' }] }),
    ).toEqual({
      user: { temporaryPassword: '[REDACTED]', name: 'A' },
      list: [{ token: '[REDACTED]' }],
    });
  });

  it('leaves primitives, null and errors untouched', () => {
    const error = new Error('boom');
    expect(redact('text')).toBe('text');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(error)).toBe(error);
  });

  it('does not mutate the original object', () => {
    const original = { password: 'secret1' };
    redact(original);
    expect(original.password).toBe('secret1');
  });
});
