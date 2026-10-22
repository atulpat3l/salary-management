import {
  draftPayslip,
  summariseByCountry,
  type EmployeeForPayroll,
  type CountryGroup,
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
  const META: Record<string, [string, string]> = {
    US: ['United States', 'USD'],
    IN: ['India', 'INR'],
    DE: ['Germany', 'EUR'],
  };
  const group = (
    countryCode: string,
    headcount: number,
    netCents: number | bigint,
    extra: Partial<CountryGroup> = {},
  ): CountryGroup => ({
    countryCode,
    countryName: META[countryCode][0],
    currency: META[countryCode][1],
    headcount,
    flaggedCount: 0,
    grossCents: netCents,
    totalDeductionsCents: 0,
    netCents,
    ...extra,
  });

  it('shows each country in its own currency, sorted by country name', () => {
    const summary = summariseByCountry([
      group('US', 2, 300030),
      group('IN', 1, 5000000),
      group('DE', 1, 300000),
    ]);

    expect(summary.headcount).toBe(4);
    expect(summary.byCountry).toEqual([
      expect.objectContaining({ countryName: 'Germany', currency: 'EUR', headcount: 1 }),
      expect.objectContaining({
        countryName: 'India',
        currency: 'INR',
        net: { amount: '50000.00', currency: 'INR' },
      }),
      expect.objectContaining({
        countryName: 'United States',
        headcount: 2,
        net: { amount: '3000.30', currency: 'USD' },
      }),
    ]);
  });

  it('turns whole cents back into exact amounts, even beyond JavaScript’s safe integers', () => {
    const huge = 123456789012345678n; // cents
    const [us] = summariseByCountry([group('US', 1, huge)]).byCountry;
    expect(us.net.amount).toBe('1234567890123456.78');
  });

  it('keeps negative totals (flagged runs)', () => {
    const [us] = summariseByCountry([group('US', 1, -400000, { flaggedCount: 1 })]).byCountry;
    expect(us.net).toEqual({ amount: '-4000.00', currency: 'USD' });
  });

  it('counts flagged employees overall and per country', () => {
    const summary = summariseByCountry([
      group('US', 3, 1, { flaggedCount: 1 }),
      group('IN', 2, 1, { flaggedCount: 2n }),
    ]);
    expect(summary.flaggedCount).toBe(3);
    expect(summary.byCountry.map((c) => [c.countryCode, c.flaggedCount])).toEqual([
      ['IN', 2],
      ['US', 1],
    ]);
  });

  it('never produces a money total that mixes currencies', () => {
    const summary = summariseByCountry([group('US', 1, 100), group('IN', 1, 100)]);
    expect(Object.keys(summary).sort()).toEqual(['byCountry', 'flaggedCount', 'headcount']);
  });

  it('refuses a country that appears in two currencies', () => {
    expect(() =>
      summariseByCountry([group('US', 1, 100), group('US', 1, 100, { currency: 'EUR' })]),
    ).toThrow(/more than one currency/);
  });

  it('summarises an empty run', () => {
    expect(summariseByCountry([])).toEqual({ headcount: 0, flaggedCount: 0, byCountry: [] });
  });
});
