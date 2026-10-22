import { toPayBreakdown } from '../../src/domain/payBreakdown';
import { calculatePay } from '../../src/domain/payCalculator';
import { usStandard } from '../fixtures/structures';

describe('FR-CUR-01: pay breakdown view', () => {
  const breakdown = toPayBreakdown(calculatePay(usStandard, '60000'), 'USD');

  it('pairs every amount with the currency (worked example 2)', () => {
    expect(breakdown.gross).toEqual({ amount: '7700.00', currency: 'USD' });
    expect(breakdown.totalDeductions).toEqual({ amount: '1890.00', currency: 'USD' });
    expect(breakdown.net).toEqual({ amount: '5810.00', currency: 'USD' });
    for (const line of [...breakdown.earnings, ...breakdown.deductions]) {
      expect(line.amount.currency).toBe('USD');
      expect(line.amount.amount).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it('keeps each line’s kind, label and calculation', () => {
    expect(breakdown.earnings[1]).toEqual({
      kind: 'EARNING',
      label: 'Housing allowance',
      calculation: '40% × 5000.00',
      amount: { amount: '2000.00', currency: 'USD' },
    });
    expect(breakdown.flagged).toBe(false);
  });

  it('uses whatever currency it is given — it never converts', () => {
    const inr = toPayBreakdown(calculatePay(usStandard, '60000'), 'INR');
    expect(inr.net).toEqual({ amount: '5810.00', currency: 'INR' });
  });
});
