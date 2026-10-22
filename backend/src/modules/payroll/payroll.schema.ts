import { z } from 'zod';
import { MAX_ACHIEVEMENT_PCT } from '../../domain/payCalculator';
import { countryCodeSchema, idParamSchema, nonNegativeDecimalSchema } from '../../lib/schemas';

/** A reasonable monthly ceiling that catches typos (PRD Q5; to be confirmed with HR). */
export const MAX_OVERTIME_HOURS = 100;
/** Enough for every employee in one request (A5: ~10,000). */
export const MAX_INPUTS_PER_REQUEST = 10_000;

export const createRunSchema = z.object({
  month: z
    .string({ error: 'Month is required' })
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format, e.g. 2026-10'),
});

/** FR-PAY-01: one employee's inputs. A field that is left out takes its default. */
export const monthlyInputSchema = z.object({
  employeeId: z.coerce
    .number({ error: 'Employee is required' })
    .int('Employee is required')
    .positive('Employee is required'),
  overtimeHours: nonNegativeDecimalSchema('Overtime hours', MAX_OVERTIME_HOURS).optional(),
  bonus: nonNegativeDecimalSchema('Bonus').optional(),
  achievementPct: nonNegativeDecimalSchema('Achievement %', MAX_ACHIEVEMENT_PCT).optional(),
});

export const saveInputsSchema = z
  .object({
    inputs: z
      .array(monthlyInputSchema, { error: 'Inputs must be a list' })
      .min(1, 'Provide inputs for at least one employee')
      .max(MAX_INPUTS_PER_REQUEST, `At most ${MAX_INPUTS_PER_REQUEST} employees per request`),
  })
  .superRefine(({ inputs }, ctx) => {
    const seen = new Set<number>();
    inputs.forEach((input, index) => {
      if (seen.has(input.employeeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['inputs', index, 'employeeId'],
          message: 'This employee appears more than once',
        });
      }
      seen.add(input.employeeId);
    });
  });

export type MonthlyInput = z.infer<typeof monthlyInputSchema>;

/** FR-PAY-06: a real calendar date in YYYY-MM-DD form, not in the future. */
export const disburseSchema = z.object({
  paymentDate: z
    .string({ error: 'Payment date is required' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format')
    .refine((value) => {
      // Rejects impossible dates like 2026-02-30, which Date would silently roll over.
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Payment date is not a real date')
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Payment date cannot be in the future',
    ),
});

export const runPayslipParamsSchema = z.object({
  id: idParamSchema.shape.id,
  payslipId: idParamSchema.shape.id,
});

/** FR-PAY-02/03: review a run's payslips, e.g. only the flagged ones, or one country. */
export const listRunPayslipsQuerySchema = z.object({
  flagged: z
    .enum(['true', 'false'], { error: 'Must be true or false' })
    .transform((value) => value === 'true')
    .optional(),
  country: countryCodeSchema.optional(),
  page: z.coerce.number().int().min(1, 'Must be 1 or more').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Must be 1 or more')
    .max(100, 'Must be at most 100')
    .default(25),
});

export type ListRunPayslipsQuery = z.infer<typeof listRunPayslipsQuerySchema>;
