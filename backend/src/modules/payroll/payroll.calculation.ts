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

/**
 * Payslip totals for one country within a run, as aggregated by the database. Amounts are
 * whole cents (integers), so adding thousands of payslips stays exact (NFR-03).
 */
export interface CountryGroup {
  countryCode: string;
  countryName: string;
  currency: string;
  headcount: number | bigint;
  flaggedCount: number | bigint;
  grossCents: number | bigint;
  totalDeductionsCents: number | bigint;
  netCents: number | bigint;
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

const fromCents = (cents: number | bigint, currency: string) =>
  toMoney(new Decimal(cents.toString()).div(100), currency);

/**
 * FR-PAY-03 / NFR-04: headcount and totals per country, each in that country's currency,
 * sorted by country name. There is deliberately no grand total of money: it would mix
 * currencies. Only counts are added up across countries.
 */
export function summariseByCountry(groups: CountryGroup[]) {
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.countryCode)) {
      throw new Error(`Payslips for ${group.countryCode} use more than one currency`);
    }
    seen.add(group.countryCode);
  }

  const byCountry: CountryTotals[] = groups
    .map((group) => ({
      countryCode: group.countryCode,
      countryName: group.countryName,
      currency: group.currency,
      headcount: Number(group.headcount),
      flaggedCount: Number(group.flaggedCount),
      gross: fromCents(group.grossCents, group.currency),
      totalDeductions: fromCents(group.totalDeductionsCents, group.currency),
      net: fromCents(group.netCents, group.currency),
    }))
    .sort((a, b) => a.countryName.localeCompare(b.countryName));

  return {
    headcount: byCountry.reduce((sum, c) => sum + c.headcount, 0),
    flaggedCount: byCountry.reduce((sum, c) => sum + c.flaggedCount, 0),
    byCountry,
  };
}

export type RunSummary = ReturnType<typeof summariseByCountry>;
