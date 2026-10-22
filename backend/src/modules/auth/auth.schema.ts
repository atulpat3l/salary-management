import { z } from 'zod';

export const loginSchema = z.object({
  // Employee IDs are upper case (e.g. EMP00042); accept any case and surrounding spaces.
  loginId: z
    .string({ error: 'Employee ID is required' })
    .trim()
    .min(1, 'Employee ID is required')
    .transform((value) => value.toUpperCase()),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
