import { toSalaryStats } from '../../src/modules/insights/insights.stats';

describe('FR-INS-01: salary statistics', () => {
  it('converts min, max and mean from cents into money in the given currency', () => {
    expect(
      toSalaryStats(
        { headcount: 3, minCents: 90000025, maxCents: 120000001, sumCents: 330000026 },
        'INR',
      ),
    ).toEqual({
      headcount: 3,
      minimum: { amount: '900000.25', currency: 'INR' },
      maximum: { amount: '1200000.01', currency: 'INR' },
      // 3,300,000.26 ÷ 3 = 1,100,000.0866… → 1,100,000.09
      average: { amount: '1100000.09', currency: 'INR' },
    });
  });

  it('rounds the mean half up to two decimals', () => {
    // 100,000.00 and 100,000.01 → mean 100,000.005 → 100,000.01
    const stats = toSalaryStats(
      { headcount: 2, minCents: 10000000, maxCents: 10000001, sumCents: 20000001 },
      'USD',
    );
    expect(stats.average).toEqual({ amount: '100000.01', currency: 'USD' });
  });

  it('stays exact for very large totals (BigInt from the database)', () => {
    // 12,345,678,901,234,567 cents is beyond Number's safe-integer range.
    const stats = toSalaryStats(
      {
        headcount: 3n,
        minCents: 100n,
        maxCents: 12_345_678_901_234_467n,
        sumCents: 12_345_678_901_234_567n,
      },
      'INR',
    );
    expect(stats.headcount).toBe(3);
    expect(stats.maximum?.amount).toBe('123456789012344.67');
    // 123,456,789,012,345.67 ÷ 3 = 41,152,263,004,115.2233… → 41,152,263,004,115.22
    expect(stats.average?.amount).toBe('41152263004115.22');
  });

  it('returns nulls, never zeros, when there is nobody in the group', () => {
    expect(
      toSalaryStats({ headcount: 0, minCents: null, maxCents: null, sumCents: null }, 'GBP'),
    ).toEqual({
      headcount: 0,
      minimum: null,
      maximum: null,
      average: null,
    });
  });
});
