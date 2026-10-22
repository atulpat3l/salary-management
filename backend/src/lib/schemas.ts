import { z } from 'zod';

/** Route params like `/structures/:id`. A non-numeric id is a 400, not a 404. */
export const idParamSchema = z.object({
  id: z.coerce
    .number({ error: 'Must be a number' })
    .int('Must be a whole number')
    .positive('Must be a positive number'),
});

/** ISO 3166-1 alpha-2 country code, accepted in any case ("us" → "US"). */
export const countryCodeSchema = z
  .string({ error: 'Country is required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Must be a two-letter country code');

/** Required free text: surrounding spaces are ignored and it cannot be blank (FR-EMP-05). */
export function requiredTextSchema(label: string, maxLength: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`);
}

/** Up to 12 digits before the decimal point: far above any real salary, but catches typos. */
const MAX_INTEGER_DIGITS = 12;

/**
 * A money amount in the employee's currency: greater than zero with at most two decimal places
 * (FR-EMP-05). Accepts a number or numeric string and returns a string, so no precision is lost.
 */
export function positiveAmountSchema(label: string) {
  return z
    .union([z.string(), z.number()], { error: `${label} is required` })
    .transform((value) => String(value).trim())
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .regex(/^-?\d+(\.\d+)?$/, `${label} must be a number`)
        .refine((value) => !/\.\d{3,}$/.test(value), {
          message: `${label} can have at most two decimal places`,
        })
        .refine((value) => Number(value) > 0, { message: `${label} must be greater than zero` })
        .refine((value) => value.split('.')[0].length <= MAX_INTEGER_DIGITS, {
          message: `${label} is too large`,
        }),
    );
}
