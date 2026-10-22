import { disburseSchema } from '../../src/modules/payroll/payroll.schema';

const messageFor = (paymentDate: unknown) => {
  const result = disburseSchema.safeParse({ paymentDate });
  return result.success ? null : result.error.issues[0].message;
};

describe('FR-PAY-06: payment date', () => {
  it.each(['2026-01-31', '2024-02-29', ' 2026-10-01 '])('accepts %j', (date) => {
    expect(messageFor(date)).toBeNull();
  });

  it('accepts today', () => {
    expect(messageFor(new Date().toISOString().slice(0, 10))).toBeNull();
  });

  it.each([
    ['2026-02-30', 'Payment date is not a real date'],
    ['2025-02-29', 'Payment date is not a real date'],
    ['2026-13-01', 'Payment date is not a real date'],
    ['31/01/2026', 'Payment date must be in YYYY-MM-DD format'],
    ['2026-1-5', 'Payment date must be in YYYY-MM-DD format'],
    ['2999-01-01', 'Payment date cannot be in the future'],
    [undefined, 'Payment date is required'],
  ])('rejects %j: %s', (date, message) => {
    expect(messageFor(date)).toBe(message);
  });
});
