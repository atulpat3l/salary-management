/**
 * The pure part of running payroll: turning one employee (and their monthly inputs) into a
 * payslip, and summarising payslips per country. No database access, so it is easy to test.
 */
import {
  calculatePay,
  STANDARD_INPUTS,
  type MonthlyInputs,
  type StructureRules,
} from '../../domain/payCalculator';
import { Decimal, toDecimal, toMoney, type DecimalLike, type Money } from '../../lib/money';

export interface EmployeeForPayroll {
  id: number;
  employeeCode: string;
  fullName: string;
  jobTitle: string;
  annualBaseSalary: DecimalLike;
  country: { code: string; name: string; currencyCode: string };
  structure: { name: string; rules: StructureRules };
  input: MonthlyInputs | null; // null → no inputs entered → defaults (FR-PAY-02)
}

export interface PayslipDraft {
  payslip: {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    jobTitle: string;
    countryCode: string;
    countryName: string;
    currency: string;
    structureName: string;
    annualBaseSalary: string;
    overtimeHours: string;
    bonus: string;
    achievementPct: string;
    gross: string;
    totalDeductions: string;
    net: string;
    flagged: boolean;
  };
  lines: { kind: string; label: string; calculation: string; amount: string; sortOrder: number }[];
}

/**
 * FR-PAY-02: one employee's pay for the month, calculated with their own salary, structure,
 * inputs and currency. Everything the payslip shows is copied in, so it never depends on the
 * employee record again (FR-PAY-05).
 */
export function draftPayslip(employee: EmployeeForPayroll): PayslipDraft {
  const inputs = employee.input ?? STANDARD_INPUTS;
  const result = calculatePay(employee.structure.rules, employee.annualBaseSalary, inputs);
  const lines = [...result.earnings, ...result.deductions].map((line, index) => ({
    kind: line.kind,
    label: line.label,
    calculation: line.calculation,
    amount: line.amount.toFixed(2),
    sortOrder: index + 1,
  }));

  return {
    payslip: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle,
      countryCode: employee.country.code,
      countryName: employee.country.name,
      currency: employee.country.currencyCode,
      structureName: employee.structure.name,
      annualBaseSalary: toDecimal(employee.annualBaseSalary).toFixed(2),
      overtimeHours: toDecimal(inputs.overtimeHours).toString(),
      bonus: toDecimal(inputs.bonus).toFixed(2),
      achievementPct: toDecimal(inputs.achievementPct).toString(),
      gross: result.gross.toFixed(2),
      totalDeductions: result.totalDeductions.toFixed(2),
      net: result.net.toFixed(2),
      flagged: result.flagged,
    },
    lines,
  };
}

export interface PayslipTotals {
  countryCode: string;
  countryName: string;
  currency: string;
  gross: DecimalLike;
  totalDeductions: DecimalLike;
  net: DecimalLike;
  flagged: boolean;
}

export interface CountryTotals {
  countryCode: string;
  countryName: string;
  currency: string;
  headcount: number;
  flaggedCount: number;
  gross: Money;
  totalDeductions: Money;
  net: Money;
}

/**
 * FR-PAY-03 / NFR-04: headcount and totals grouped by country, each in that country's
 * currency. There is deliberately no grand total of money: it would mix currencies.
 */
export function summariseByCountry(payslips: PayslipTotals[]) {
  const groups = new Map<
    string,
    {
      first: PayslipTotals;
      headcount: number;
      flagged: number;
      gross: Decimal;
      deductions: Decimal;
      net: Decimal;
    }
  >();

  for (const payslip of payslips) {
    const group = groups.get(payslip.countryCode) ?? {
      first: payslip,
      headcount: 0,
      flagged: 0,
      gross: new Decimal(0),
      deductions: new Decimal(0),
      net: new Decimal(0),
    };
    if (payslip.currency !== group.first.currency) {
      throw new Error(`Payslips for ${payslip.countryCode} use more than one currency`);
    }
    group.headcount += 1;
    if (payslip.flagged) group.flagged += 1;
    group.gross = group.gross.plus(toDecimal(payslip.gross));
    group.deductions = group.deductions.plus(toDecimal(payslip.totalDeductions));
    group.net = group.net.plus(toDecimal(payslip.net));
    groups.set(payslip.countryCode, group);
  }

  const byCountry: CountryTotals[] = [...groups.values()]
    .map(({ first, headcount, flagged, gross, deductions, net }) => ({
      countryCode: first.countryCode,
      countryName: first.countryName,
      currency: first.currency,
      headcount,
      flaggedCount: flagged,
      gross: toMoney(gross, first.currency),
      totalDeductions: toMoney(deductions, first.currency),
      net: toMoney(net, first.currency),
    }))
    .sort((a, b) => a.countryName.localeCompare(b.countryName));

  return {
    headcount: payslips.length,
    flaggedCount: payslips.filter((p) => p.flagged).length,
    byCountry,
  };
}
