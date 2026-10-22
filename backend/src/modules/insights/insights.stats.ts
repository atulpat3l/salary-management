import { Decimal, round2, toMoney, type Money } from '../../lib/money';

/** Salary figures for one group of active employees, as aggregated by the database in cents. */
export interface SalaryAggregate {
  headcount: number | bigint;
  minCents: number | bigint | null;
  maxCents: number | bigint | null;
  sumCents: number | bigint | null;
}

export interface SalaryStats {
  headcount: number;
  minimum: Money | null;
  maximum: Money | null;
  average: Money | null; // arithmetic mean, rounded half-up to 2 dp (PRD §5.9)
}

const fromCents = (cents: number | bigint, currency: string) =>
  toMoney(new Decimal(cents.toString()).div(100), currency);

/**
 * FR-INS-01/02: min, max and mean annual base salary in one currency. With nobody in the group
 * every figure is null, never zero, so the UI can say so clearly.
 */
export function toSalaryStats(aggregate: SalaryAggregate, currency: string): SalaryStats {
  const headcount = Number(aggregate.headcount);
  if (headcount === 0 || aggregate.sumCents === null) {
    return { headcount: 0, minimum: null, maximum: null, average: null };
  }
  const averageCents = new Decimal(aggregate.sumCents.toString()).div(headcount);
  return {
    headcount,
    minimum: fromCents(aggregate.minCents!, currency),
    maximum: fromCents(aggregate.maxCents!, currency),
    average: toMoney(round2(averageCents.div(100)), currency),
  };
}
