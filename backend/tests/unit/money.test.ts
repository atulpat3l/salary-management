import { Decimal, round2, sumMoney, toMoney } from '../../src/lib/money';

describe('money', () => {
  describe('round2 — PRD §5.7 rounding (2 dp, half up)', () => {
    it.each([
      ['1.005', '1.01'], // float arithmetic would give 1.00
      ['0.125', '0.13'],
      ['2.674999', '2.67'],
      ['5000', '5000.00'],
      ['8333.3383333', '8333.34'],
    ])('rounds %s to %s', (input, expected) => {
      expect(round2(input).toFixed(2)).toBe(expected);
    });

    it('accepts numbers, strings and Decimals', () => {
      expect(round2(0.1 + 0.2).toFixed(2)).toBe('0.30');
      expect(round2(new Decimal('7.777')).toFixed(2)).toBe('7.78');
    });

    it('converts a Prisma Decimal (or anything with toString) via its string form', () => {
      const prismaLike = { toString: () => '12345678.915' };
      expect(round2(prismaLike).toFixed(2)).toBe('12345678.92');
    });
  });

  describe('toMoney — FR-CUR-01 / NFR-04 every amount carries its currency', () => {
    it('formats the amount as a string with exactly two decimals', () => {
      expect(toMoney('5000', 'USD')).toEqual({ amount: '5000.00', currency: 'USD' });
      expect(toMoney(new Decimal('468.754'), 'INR')).toEqual({ amount: '468.75', currency: 'INR' });
    });

    it('keeps negative amounts (e.g. a flagged negative net)', () => {
      expect(toMoney('-12.5', 'GBP')).toEqual({ amount: '-12.50', currency: 'GBP' });
    });
  });

  describe('sumMoney — NFR-04 never combine currencies', () => {
    it('adds amounts in the same currency exactly', () => {
      const total = sumMoney('USD', [toMoney('0.10', 'USD'), toMoney('0.20', 'USD')]);
      expect(total).toEqual({ amount: '0.30', currency: 'USD' });
    });

    it('returns zero in the given currency for an empty list', () => {
      expect(sumMoney('EUR', [])).toEqual({ amount: '0.00', currency: 'EUR' });
    });

    it('throws when any amount is in a different currency', () => {
      expect(() => sumMoney('USD', [toMoney('1', 'USD'), toMoney('1', 'INR')])).toThrow(
        /Cannot combine INR with USD/,
      );
    });
  });
});
