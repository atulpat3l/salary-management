import DecimalJs from 'decimal.js';

/**
 * Decimal arithmetic for money. Never use JS numbers for amounts: 1.005 rounds to 1.00 with floats.
 * Precision is generous so intermediate results (e.g. base ÷ hours) lose nothing before rounding.
 */
export const Decimal = DecimalJs.clone({ precision: 34, rounding: DecimalJs.ROUND_HALF_UP });
export type Decimal = DecimalJs;

/** Anything we accept as a number: string, number, Decimal, or a Prisma Decimal (via toString). */
export type DecimalLike = string | number | DecimalJs | { toString(): string };

export function toDecimal(value: DecimalLike): Decimal {
  if (typeof value === 'string' || typeof value === 'number') return new Decimal(value);
  return new Decimal(value.toString());
}

/** Rounds to 2 decimal places, half up (PRD §5.7). */
export function round2(value: DecimalLike): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** An amount always paired with its currency (FR-CUR-01, NFR-04). This is the API's money shape. */
export interface Money {
  amount: string; // exactly two decimals, e.g. "5000.00"
  currency: string; // ISO 4217, e.g. "USD"
}

export function toMoney(value: DecimalLike, currency: string): Money {
  return { amount: round2(value).toFixed(2), currency };
}

/** Adds amounts of one currency. Throws if any amount is in another currency (NFR-04). */
export function sumMoney(currency: string, values: Money[]): Money {
  let total = new Decimal(0);
  for (const value of values) {
    if (value.currency !== currency) {
      throw new Error(`Cannot combine ${value.currency} with ${currency}`);
    }
    total = total.plus(value.amount);
  }
  return toMoney(total, currency);
}
