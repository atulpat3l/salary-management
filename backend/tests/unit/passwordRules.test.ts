import { changePasswordSchema, newPasswordSchema } from '../../src/modules/auth/auth.schema';

const messagesFor = (password: unknown) => {
  const result = newPasswordSchema.safeParse(password);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('FR-AUTH-05: password rules', () => {
  it.each(['Passw0rd', 'abcdefg1', '12345678a', 'long passphrase 2026'])('accepts %j', (pw) => {
    expect(messagesFor(pw)).toEqual([]);
  });

  it('requires at least 8 characters', () => {
    expect(messagesFor('Pass1')).toContain('Password must be at least 8 characters');
    expect(messagesFor('Passwo1')).toContain('Password must be at least 8 characters');
  });

  it('requires a letter', () => {
    expect(messagesFor('12345678')).toEqual(['Password must contain at least one letter']);
  });

  it('requires a number', () => {
    expect(messagesFor('Password')).toEqual(['Password must contain at least one number']);
  });

  it('refuses passwords longer than bcrypt can use (72)', () => {
    expect(messagesFor(`a1${'x'.repeat(70)}`)).toEqual([]);
    expect(messagesFor(`a1${'x'.repeat(71)}`)).toEqual(['Password must be at most 72 characters']);
  });

  it('refuses a missing password', () => {
    expect(messagesFor(undefined)).toEqual(['New password is required']);
  });
});

describe('FR-AUTH-05: change password input', () => {
  it('accepts a valid change', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd' })
        .success,
    ).toBe(true);
  });

  it('requires the new password to differ from the current one', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Passw0rd1',
      newPassword: 'Passw0rd1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: ['newPassword'],
          message: 'New password must be different from the current password',
        }),
      ]);
    }
  });

  it('requires the current password', () => {
    const result = changePasswordSchema.safeParse({ newPassword: 'NewPassw0rd' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['currentPassword'],
        message: 'Current password is required',
      });
    }
  });
});
