import { loginSchema } from '../../src/modules/auth/auth.schema';

describe('FR-AUTH-01: login input', () => {
  it('trims and upper-cases the Employee ID', () => {
    expect(loginSchema.parse({ loginId: '  emp00042 ', password: 'x' })).toEqual({
      loginId: 'EMP00042',
      password: 'x',
    });
  });

  it('does not trim the password (spaces may be part of it)', () => {
    expect(loginSchema.parse({ loginId: 'HR001', password: ' secret ' }).password).toBe(' secret ');
  });

  it.each([
    [{}, ['loginId', 'password']],
    [{ loginId: '   ', password: '' }, ['loginId', 'password']],
    [{ loginId: 42, password: 'x' }, ['loginId']],
  ])('rejects %j', (input, invalidFields) => {
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual(invalidFields);
    }
  });

  it('uses friendly messages', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toEqual([
        'Employee ID is required',
        'Password is required',
      ]);
    }
  });
});
