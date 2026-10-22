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
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Must be a two-letter country code');
