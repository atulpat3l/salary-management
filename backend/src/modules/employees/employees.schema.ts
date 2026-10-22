import { z } from 'zod';
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
