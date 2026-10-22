import { z } from 'zod';
import { EMPLOYEE_STATUSES } from '../../domain/constants';
import { countryCodeSchema, positiveAmountSchema, requiredTextSchema } from '../../lib/schemas';

export const NAME_MAX_LENGTH = 100;
export const JOB_TITLE_MAX_LENGTH = 100;

/** FR-EMP-05: field rules. Rules that need the database (e.g. structure ↔ country) live in the service. */
export const createEmployeeSchema = z.object({
  fullName: requiredTextSchema('Full name', NAME_MAX_LENGTH),
  jobTitle: requiredTextSchema('Job title', JOB_TITLE_MAX_LENGTH),
  countryCode: countryCodeSchema,
  annualBaseSalary: positiveAmountSchema('Annual base salary'),
  structureId: z.coerce
    .number({ error: 'Salary structure is required' })
    .int('Salary structure is required')
    .positive('Salary structure is required'),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

/**
 * FR-EMP-03: any subset of the editable fields, with the same rules. The Employee ID and status
 * are not editable here (status changes only through deactivation); unknown keys are ignored.
 */
export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Provide at least one field to change',
  });

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/** FR-EMP-06: what the live preview in the add/edit form needs. */
export const salaryPreviewSchema = createEmployeeSchema.pick({
  countryCode: true,
  annualBaseSalary: true,
  structureId: true,
});

export type SalaryPreviewInput = z.infer<typeof salaryPreviewSchema>;

export const EMPLOYEE_SORT_FIELDS = ['employeeCode', 'name', 'salary'] as const;
export const MAX_PAGE_SIZE = 100;

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || undefined);

/** FR-FIND-01..04: paging, search, filters and sorting for the employee list. */
export const listEmployeesQuerySchema = z
  .object({
    // Only characters that appear in names and Employee IDs. This also keeps "%" and "_" out:
    // SQLite LIKE would treat them as wildcards and match everyone.
    q: optionalText(100).refine(
      (value) => value === undefined || /^[\p{L}\p{M}\p{N} .'-]+$/u.test(value),
      {
        message: 'Search can only contain letters, numbers, spaces, apostrophes, hyphens and dots',
      },
    ),
    country: countryCodeSchema.optional(),
    jobTitle: optionalText(JOB_TITLE_MAX_LENGTH),
    status: z
      .string()
      .toUpperCase()
      .pipe(z.enum(EMPLOYEE_STATUSES, { error: 'Must be ACTIVE or INACTIVE' }))
      .optional(),
    sort: z
      .enum(EMPLOYEE_SORT_FIELDS, { error: 'Must be one of: employeeCode, name, salary' })
      .default('employeeCode'),
    order: z.enum(['asc', 'desc'], { error: 'Must be asc or desc' }).default('asc'),
    page: z.coerce.number().int().min(1, 'Must be 1 or more').default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'Must be 1 or more')
      .max(MAX_PAGE_SIZE, `Must be at most ${MAX_PAGE_SIZE}`)
      .default(25),
  })
  .refine((query) => query.sort !== 'salary' || query.country !== undefined, {
    path: ['sort'],
    message:
      'Sorting by salary needs a single country selected, because amounts in different currencies cannot be compared',
  });

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;

export const jobTitlesQuerySchema = z.object({ country: countryCodeSchema.optional() });
