import { newPasswordSchema } from '../../src/modules/auth/auth.schema';
import { generateTemporaryPassword } from '../../src/modules/auth/password';

describe('FR-AUTH-04: temporary passwords', () => {
  const samples = Array.from({ length: 500 }, () => generateTemporaryPassword());

  it('are 12 characters long by default', () => {
    expect(samples.every((p) => p.length === 12)).toBe(true);
    expect(generateTemporaryPassword(16)).toHaveLength(16);
  });

  it('always meet the password rules, so the employee could keep typing it in', () => {
    for (const password of samples)
      expect(newPasswordSchema.safeParse(password).success).toBe(true);
  });

  it('avoid look-alike characters (0, O, 1, l, I), because HR reads them out', () => {
    expect(samples.join('')).not.toMatch(/[0O1lI]/);
  });

  it('are random: no repeats across many samples', () => {
    expect(new Set(samples).size).toBe(samples.length);
  });

  it('do not always start with the guaranteed letter and digit', () => {
    const firstIsDigit = samples.filter((p) => /^\d/.test(p)).length;
    expect(firstIsDigit).toBeGreaterThan(0);
    expect(firstIsDigit).toBeLessThan(samples.length);
  });
});
