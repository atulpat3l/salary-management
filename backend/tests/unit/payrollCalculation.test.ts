import {
  draftPayslip,
  summariseByCountry,
  type EmployeeForPayroll,
  type PayslipTotals,
} from '../../src/modules/payroll/payroll.calculation';
import { usStandard } from '../fixtures/structures';

const employee = (overrides: Partial<EmployeeForPayroll> = {}): EmployeeForPayroll => ({
  id: 7,
  employeeCode: 'EMP00007',
  fullName: 'Asha Rao',
  jobTitle: 'Engineer',
  annualBaseSalary: '60000',
  country: { code: 'US', name: 'United States', currencyCode: 'USD' },
  structure: { name: 'US Standard', rules: usStandard },
  input: null,
  ...overrides,
});

describe('draftPayslip — FR-PAY-02', () => {
  it('calculates worked example 1 from the employee’s own inputs (net USD 6,905.00)', () => {
    const { payslip, lines } = draftPayslip(
      employee({ input: { overtimeHours: '10', bonus: '1000', achievementPct: '80' } }),
    );

    expect(payslip).toMatchObject({
      gross: '9068.75',
      totalDeductions: '2163.75',
      net: '6905.00',
      flagged: false,
      overtimeHours: '10',
      bonus: '1000.00',
      achievementPct: '80',
    });
    expect(lines.map((l) => [l.sortOrder, l.label, l.amount])).toEqual([
      [1, 'Monthly base', '5000.00'],
      [2, 'Housing allowance', '2000.00'],
      [3, 'Transport allowance', '200.00'],
      [4, 'Variable pay', '400.00'],
      [5, 'Overtime', '468.75'],
      [6, 'Bonus', '1000.00'],
      [7, 'Income tax', '1813.75'],
      [8, 'Retirement', '250.00'],
      [9, 'Health insurance', '100.00'],
    ]);
  });

  it('uses the defaults when no inputs were entered, giving the standard monthly salary', () => {
    const { payslip } = draftPayslip(employee({ input: null }));
    expect(payslip).toMatchObject({
      net: '5810.00',
      overtimeHours: '0',
      bonus: '0.00',
      achievementPct: '100',
    });
  });

  it('FR-PAY-05: copies everything the payslip shows, including the currency', () => {
    const { payslip } = draftPayslip(employee());
    expect(payslip).toMatchObject({
      employeeId: 7,
      employeeCode: 'EMP00007',
      fullName: 'Asha Rao',
      jobTitle: 'Engineer',
      countryCode: 'US',
      countryName: 'United States',
      currency: 'USD',
      structureName: 'US Standard',
      annualBaseSalary: '60000.00',
    });
  });

  it('flags a negative net pay', () => {
    const { payslip } = draftPayslip(
      employee({
        structure: {
          name: 'Heavy',
          rules: {
            ...usStandard,
            components: [
              { kind: 'DEDUCTION', name: 'Loan', basis: 'FIXED', value: '99999', sortOrder: 1 },
            ],
          },
        },
      }),
    );
    expect(payslip.flagged).toBe(true);
    expect(Number(payslip.net)).toBeLessThan(0);
  });
});

describe('summariseByCountry — FR-PAY-03 / NFR-04', () => {
  const payslip = (
    countryCode: string,
    net: string,
    extra: Partial<PayslipTotals> = {},
  ): PayslipTotals => {
    const meta: Record<string, [string, string]> = {
      US: ['United States', 'USD'],
      IN: ['India', 'INR'],
      DE: ['Germany', 'EUR'],
    };
    return {
      countryCode,
      countryName: meta[countryCode][0],
      currency: meta[countryCode][1],
      gross: net,
      totalDeductions: '0',
      net,
      flagged: false,
      ...extra,
    };
  };

  it('totals each country separately, in its own currency, sorted by country name', () => {
    const summary = summariseByCountry([
      payslip('US', '1000.10'),
      payslip('IN', '50000'),
      payslip('US', '2000.20'),
      payslip('DE', '3000'),
    ]);

    expect(summary.headcount).toBe(4);
    expect(summary.byCountry).toEqual([
      expect.objectContaining({ countryName: 'Germany', currency: 'EUR', headcount: 1 }),
      expect.objectContaining({
        countryName: 'India',
        currency: 'INR',
        headcount: 1,
        net: { amount: '50000.00', currency: 'INR' },
      }),
      expect.objectContaining({
        countryName: 'United States',
        currency: 'USD',
        headcount: 2,
        net: { amount: '3000.30', currency: 'USD' },
      }),
    ]);
  });

  it('adds amounts exactly (no floating-point drift)', () => {
    const many = Array.from({ length: 10 }, () => payslip('US', '0.10'));
    expect(summariseByCountry(many).byCountry[0].net.amount).toBe('1.00');
  });

  it('counts flagged employees overall and per country', () => {
    const summary = summariseByCountry([
      payslip('US', '-5', { flagged: true }),
      payslip('US', '10'),
      payslip('IN', '-1', { flagged: true }),
    ]);
    expect(summary.flaggedCount).toBe(2);
    expect(summary.byCountry.map((c) => [c.countryCode, c.flaggedCount])).toEqual([
      ['IN', 1],
      ['US', 1],
    ]);
  });

  it('never produces a total that mixes currencies', () => {
    const summary = summariseByCountry([payslip('US', '1'), payslip('IN', '1')]);
    expect(Object.keys(summary).sort()).toEqual(['byCountry', 'flaggedCount', 'headcount']);
  });

  it('refuses payslips of one country in two currencies', () => {
    expect(() =>
      summariseByCountry([payslip('US', '1'), payslip('US', '1', { currency: 'EUR' })]),
    ).toThrow(/more than one currency/);
  });

  it('summarises an empty run', () => {
    expect(summariseByCountry([])).toEqual({ headcount: 0, flaggedCount: 0, byCountry: [] });
  });
});
