import {
  STANDARD_INPUTS,
  calculatePay,
  type PayLine,
  type PayResult,
} from '../../src/domain/payCalculator';
import { bareStructure, usStandard } from '../fixtures/structures';

/** Compact view of lines for readable assertions: [label, amount]. */
const rows = (lines: PayLine[]) => lines.map((line) => [line.label, line.amount.toFixed(2)]);

const totals = (result: PayResult) => ({
  gross: result.gross.toFixed(2),
  totalDeductions: result.totalDeductions.toFixed(2),
  net: result.net.toFixed(2),
  flagged: result.flagged,
});

describe('calculatePay — PRD §5.7 monthly salary calculation', () => {
  describe('worked examples (reference cases, NFR-10)', () => {
    it('FR-PAY-02: worked example 1 — payroll month nets USD 6,905.00', () => {
      const result = calculatePay(usStandard, '60000', {
        overtimeHours: '10',
        bonus: '1000',
        achievementPct: '80',
      });

      expect(rows(result.earnings)).toEqual([
        ['Monthly base', '5000.00'],
        ['Housing allowance', '2000.00'],
        ['Transport allowance', '200.00'],
        ['Variable pay', '400.00'],
        ['Overtime', '468.75'],
        ['Bonus', '1000.00'],
      ]);
      expect(rows(result.deductions)).toEqual([
        ['Income tax', '1813.75'],
        ['Retirement', '250.00'],
        ['Health insurance', '100.00'],
      ]);
      expect(totals(result)).toEqual({
        gross: '9068.75',
        totalDeductions: '2163.75',
        net: '6905.00',
        flagged: false,
      });
    });

    it('FR-EMP-06: worked example 2 — standard monthly salary nets USD 5,810.00', () => {
      const result = calculatePay(usStandard, '60000', STANDARD_INPUTS);

      expect(rows(result.earnings)).toEqual([
        ['Monthly base', '5000.00'],
        ['Housing allowance', '2000.00'],
        ['Transport allowance', '200.00'],
        ['Variable pay', '500.00'],
      ]);
      expect(rows(result.deductions)).toEqual([
        ['Income tax', '1540.00'],
        ['Retirement', '250.00'],
        ['Health insurance', '100.00'],
      ]);
      expect(totals(result)).toEqual({
        gross: '7700.00',
        totalDeductions: '1890.00',
        net: '5810.00',
        flagged: false,
      });
    });

    it('explains how every line was calculated, so it can be reproduced by hand', () => {
      const result = calculatePay(usStandard, '60000', {
        overtimeHours: '10',
        bonus: '1000',
        achievementPct: '80',
      });
      const calculations = [...result.earnings, ...result.deductions].map((l) => l.calculation);
      expect(calculations).toEqual([
        '60000.00 ÷ 12',
        '40% × 5000.00',
        'fixed',
        '5000.00 × 10% × 80%',
        '(5000.00 ÷ 160) × 1.5 × 10 h',
        'entered',
        '20% × 9068.75',
        '5% × 5000.00',
        'fixed',
      ]);
    });

    it('tags each line with its kind', () => {
      const result = calculatePay(usStandard, '60000', {
        overtimeHours: '10',
        bonus: '1000',
        achievementPct: '80',
      });
      expect(result.earnings.map((l) => l.kind)).toEqual([
        'BASE',
        'EARNING',
        'EARNING',
        'VARIABLE',
        'OVERTIME',
        'BONUS',
      ]);
      expect(result.deductions.every((l) => l.kind === 'DEDUCTION')).toBe(true);
    });
  });

  describe('standard monthly salary vs payroll', () => {
    it('FR-PAY-02: payroll with default inputs equals the standard monthly salary', () => {
      const standard = calculatePay(usStandard, '60000', STANDARD_INPUTS);
      const payroll = calculatePay(usStandard, '60000', {
        overtimeHours: 0,
        bonus: 0,
        achievementPct: 100,
      });
      expect(rows(payroll.earnings)).toEqual(rows(standard.earnings));
      expect(rows(payroll.deductions)).toEqual(rows(standard.deductions));
      expect(totals(payroll)).toEqual(totals(standard));
    });

    it('defaults to standard inputs when none are given', () => {
      expect(totals(calculatePay(usStandard, '60000'))).toEqual(
        totals(calculatePay(usStandard, '60000', STANDARD_INPUTS)),
      );
    });

    it('omits overtime and bonus lines when they are zero', () => {
      const labels = calculatePay(usStandard, '60000').earnings.map((l) => l.label);
      expect(labels).not.toContain('Overtime');
      expect(labels).not.toContain('Bonus');
    });
  });

  describe('earnings components', () => {
    it('applies a % of monthly base component', () => {
      const structure = bareStructure({
        components: [
          { kind: 'EARNING', name: 'Housing', basis: 'PCT_BASE', value: '12.5', sortOrder: 1 },
        ],
      });
      const result = calculatePay(structure, '120000');
      expect(rows(result.earnings)).toEqual([
        ['Monthly base', '10000.00'],
        ['Housing', '1250.00'],
      ]);
      expect(result.gross.toFixed(2)).toBe('11250.00');
    });

    it('applies a fixed monthly component regardless of base', () => {
      const structure = bareStructure({
        components: [
          { kind: 'EARNING', name: 'Meal card', basis: 'FIXED', value: '150.5', sortOrder: 1 },
        ],
      });
      expect(rows(calculatePay(structure, '1200').earnings)).toEqual([
        ['Monthly base', '100.00'],
        ['Meal card', '150.50'],
      ]);
    });

    it('rejects an earning defined as % of gross (gross depends on earnings)', () => {
      const structure = bareStructure({
        components: [
          { kind: 'EARNING', name: 'Bad', basis: 'PCT_GROSS', value: '10', sortOrder: 1 },
        ],
      });
      expect(() => calculatePay(structure, '60000')).toThrow(/cannot be a % of gross/);
    });

    it('orders components by sortOrder, not by array position', () => {
      const structure = bareStructure({
        components: [
          { kind: 'EARNING', name: 'Second', basis: 'FIXED', value: '2', sortOrder: 2 },
          { kind: 'EARNING', name: 'First', basis: 'FIXED', value: '1', sortOrder: 1 },
        ],
      });
      expect(calculatePay(structure, '1200').earnings.map((l) => l.label)).toEqual([
        'Monthly base',
        'First',
        'Second',
      ]);
    });
  });

  describe('deductions — each basis', () => {
    const withDeduction = (basis: 'PCT_BASE' | 'PCT_GROSS' | 'FIXED', value: string) =>
      bareStructure({
        components: [
          { kind: 'EARNING', name: 'Allowance', basis: 'FIXED', value: '1000', sortOrder: 1 },
          { kind: 'DEDUCTION', name: 'Deduction', basis, value, sortOrder: 2 },
        ],
      });

    it('% of monthly base ignores allowances', () => {
      const result = calculatePay(withDeduction('PCT_BASE', '10'), '60000');
      expect(rows(result.deductions)).toEqual([['Deduction', '500.00']]);
    });

    it('% of gross includes allowances', () => {
      const result = calculatePay(withDeduction('PCT_GROSS', '10'), '60000');
      expect(rows(result.deductions)).toEqual([['Deduction', '600.00']]);
    });

    it('fixed amount is deducted as is', () => {
      const result = calculatePay(withDeduction('FIXED', '75.25'), '60000');
      expect(rows(result.deductions)).toEqual([['Deduction', '75.25']]);
      expect(result.net.toFixed(2)).toBe('5924.75');
    });

    it('a structure with no deductions nets the full gross', () => {
      const result = calculatePay(bareStructure(), '60000');
      expect(result.deductions).toEqual([]);
      expect(totals(result)).toMatchObject({
        gross: '5000.00',
        totalDeductions: '0.00',
        net: '5000.00',
      });
    });
  });

  describe('variable pay', () => {
    const tenPercentTarget = bareStructure({ variableTargetPct: '10' });

    it.each([
      ['0', '0.00'],
      ['100', '500.00'],
      ['150', '750.00'],
      ['200', '1000.00'],
    ])('FR-PAY-01: %s%% achievement pays %s', (achievementPct, expected) => {
      const result = calculatePay(tenPercentTarget, '60000', {
        overtimeHours: 0,
        bonus: 0,
        achievementPct,
      });
      expect(result.earnings.find((l) => l.kind === 'VARIABLE')?.amount.toFixed(2)).toBe(expected);
    });

    it('has no variable pay line when the structure has no variable target', () => {
      const result = calculatePay(bareStructure(), '60000');
      expect(result.earnings.some((l) => l.kind === 'VARIABLE')).toBe(false);
    });
  });

  describe('overtime and bonus', () => {
    it('uses the structure’s standard hours and multiplier', () => {
      const structure = bareStructure({ standardMonthlyHours: 173, overtimeMultiplier: '2' });
      const result = calculatePay(structure, '60000', {
        overtimeHours: '7.5',
        bonus: 0,
        achievementPct: 100,
      });
      // (5000 ÷ 173) × 2 × 7.5 = 433.5260... → 433.53
      expect(result.earnings.find((l) => l.kind === 'OVERTIME')?.amount.toFixed(2)).toBe('433.53');
    });

    it('adds the bonus to gross and it is subject to % of gross deductions', () => {
      const structure = bareStructure({
        components: [
          { kind: 'DEDUCTION', name: 'Tax', basis: 'PCT_GROSS', value: '10', sortOrder: 1 },
        ],
      });
      const result = calculatePay(structure, '60000', {
        overtimeHours: 0,
        bonus: '2500.50',
        achievementPct: 100,
      });
      expect(totals(result)).toMatchObject({
        gross: '7500.50',
        totalDeductions: '750.05',
        net: '6750.45',
      });
    });
  });

  describe('rounding — each line is rounded half-up before totals', () => {
    it('lines always add up exactly to the totals', () => {
      // 100,000.06 ÷ 12 = 8,333.338333… → 8,333.34, and each 33.333% line rounds on its own.
      const structure = bareStructure({
        components: [
          { kind: 'EARNING', name: 'A', basis: 'PCT_BASE', value: '33.333', sortOrder: 1 },
          { kind: 'EARNING', name: 'B', basis: 'PCT_BASE', value: '33.333', sortOrder: 2 },
          { kind: 'DEDUCTION', name: 'C', basis: 'PCT_GROSS', value: '17.777', sortOrder: 3 },
          { kind: 'DEDUCTION', name: 'D', basis: 'PCT_GROSS', value: '3.333', sortOrder: 4 },
        ],
      });
      const result = calculatePay(structure, '100000.06');

      expect(rows(result.earnings)).toEqual([
        ['Monthly base', '8333.34'],
        ['A', '2777.75'],
        ['B', '2777.75'],
      ]);
      const sum = (lines: PayLine[]) =>
        lines.reduce((total, line) => total.plus(line.amount), result.gross.mul(0));
      expect(sum(result.earnings).toFixed(2)).toBe(result.gross.toFixed(2));
      expect(sum(result.deductions).toFixed(2)).toBe(result.totalDeductions.toFixed(2));
      expect(result.gross.minus(result.totalDeductions).toFixed(2)).toBe(result.net.toFixed(2));
    });

    it('rounds a half cent up', () => {
      // 12 × 1,000.005 = 12,000.06 → monthly base 1,000.005 → 1,000.01
      const result = calculatePay(bareStructure(), '12000.06');
      expect(result.earnings[0].amount.toFixed(2)).toBe('1000.01');
    });

    it('returns amounts already rounded to 2 dp', () => {
      const result = calculatePay(usStandard, '77777.77', {
        overtimeHours: '3.3',
        bonus: 0,
        achievementPct: '33.3',
      });
      for (const line of [...result.earnings, ...result.deductions]) {
        expect(line.amount.decimalPlaces()).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('negative net pay', () => {
    it('FR-PAY-02: flags an employee whose deductions exceed gross pay', () => {
      const structure = bareStructure({
        components: [
          { kind: 'DEDUCTION', name: 'Loan', basis: 'FIXED', value: '6000', sortOrder: 1 },
        ],
      });
      const result = calculatePay(structure, '60000');
      expect(totals(result)).toEqual({
        gross: '5000.00',
        totalDeductions: '6000.00',
        net: '-1000.00',
        flagged: true,
      });
    });

    it('does not flag a net of exactly zero', () => {
      const structure = bareStructure({
        components: [
          { kind: 'DEDUCTION', name: 'All', basis: 'FIXED', value: '5000', sortOrder: 1 },
        ],
      });
      expect(calculatePay(structure, '60000').flagged).toBe(false);
    });
  });

  describe('input guards', () => {
    const inputs = { overtimeHours: 0, bonus: 0, achievementPct: 100 };

    it.each([
      ['negative overtime', { ...inputs, overtimeHours: -1 }],
      ['negative bonus', { ...inputs, bonus: '-0.01' }],
      ['achievement below 0%', { ...inputs, achievementPct: -1 }],
      ['achievement above 200%', { ...inputs, achievementPct: '200.01' }],
    ])('rejects %s', (_label, bad) => {
      expect(() => calculatePay(usStandard, '60000', bad)).toThrow(RangeError);
    });

    it('rejects a non-positive annual base salary', () => {
      expect(() => calculatePay(usStandard, '0')).toThrow(RangeError);
    });

    it('rejects a structure with zero standard monthly hours', () => {
      expect(() => calculatePay(bareStructure({ standardMonthlyHours: 0 }), '60000')).toThrow(
        RangeError,
      );
    });
  });
});
