import type { Payslip, PayslipLine, PayrollRun } from '../../generated/prisma/client';
import { toMoney } from '../../lib/money';

/** What an issued payslip says about payment: not yet issued, awaiting payment, or paid. */
export type PaymentStatus = 'DRAFT' | 'PENDING' | 'PAID';

export function paymentStatusOf(run: Pick<PayrollRun, 'status'>): PaymentStatus {
  if (run.status === 'DISBURSED') return 'PAID';
  if (run.status === 'FINALISED') return 'PENDING';
  return 'DRAFT';
}

const isoDate = (date: Date | null) => date && date.toISOString().slice(0, 10);

/** One row in a list of payslips: who, and the three totals with currency. */
export function toPayslipSummary(payslip: Payslip) {
  const money = (value: Payslip['gross']) => toMoney(value, payslip.currency);
  return {
    id: payslip.id,
    employeeId: payslip.employeeId,
    employeeCode: payslip.employeeCode,
    fullName: payslip.fullName,
    jobTitle: payslip.jobTitle,
    country: { code: payslip.countryCode, name: payslip.countryName },
    currency: payslip.currency,
    gross: money(payslip.gross),
    totalDeductions: money(payslip.totalDeductions),
    net: money(payslip.net),
    flagged: payslip.flagged,
  };
}

/**
 * The full payslip (FR-PAY-03, FR-ESS-02). Built only from the payslip's own stored copy, so it
 * always shows exactly what was issued, in the original currency (FR-PAY-05).
 */
export function toPayslipDetail(payslip: Payslip & { lines: PayslipLine[]; run: PayrollRun }) {
  const money = (value: Payslip['gross']) => toMoney(value, payslip.currency);
  const lines = [...payslip.lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const toLine = (line: PayslipLine) => ({
    kind: line.kind,
    label: line.label,
    calculation: line.calculation,
    amount: money(line.amount),
  });

  return {
    ...toPayslipSummary(payslip),
    month: payslip.run.month,
    run: { id: payslip.run.id, month: payslip.run.month, status: payslip.run.status },
    structureName: payslip.structureName,
    annualBaseSalary: money(payslip.annualBaseSalary),
    inputs: {
      overtimeHours: payslip.overtimeHours.toString(),
      bonus: money(payslip.bonus),
      achievementPct: payslip.achievementPct.toString(),
    },
    earnings: lines.filter((l) => l.kind !== 'DEDUCTION').map(toLine),
    deductions: lines.filter((l) => l.kind === 'DEDUCTION').map(toLine),
    paymentStatus: paymentStatusOf(payslip.run),
    paymentDate: isoDate(payslip.run.paymentDate),
  };
}
