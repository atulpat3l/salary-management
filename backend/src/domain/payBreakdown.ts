import { toMoney } from '../lib/money';
import type { PayLine, PayResult } from './payCalculator';

/**
 * How a calculated salary is returned by the API: every amount paired with the employee's
 * currency (FR-CUR-01), every line with how it was worked out (PRD §5.7).
 */
export function toPayBreakdown(result: PayResult, currency: string) {
  const line = (payLine: PayLine) => ({
    kind: payLine.kind,
    label: payLine.label,
    calculation: payLine.calculation,
    amount: toMoney(payLine.amount, currency),
  });

  return {
    earnings: result.earnings.map(line),
    deductions: result.deductions.map(line),
    gross: toMoney(result.gross, currency),
    totalDeductions: toMoney(result.totalDeductions, currency),
    net: toMoney(result.net, currency),
    flagged: result.flagged,
  };
}

export type PayBreakdown = ReturnType<typeof toPayBreakdown>;
