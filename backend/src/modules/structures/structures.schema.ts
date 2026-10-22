import { z } from 'zod';
import { countryCodeSchema } from '../../lib/schemas';

export const listStructuresQuerySchema = z.object({
  country: countryCodeSchema.optional(),
});
