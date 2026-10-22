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

/** bcrypt only uses the first 72 bytes of a password, so longer ones are refused. */
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_MIN_LENGTH = 8;

/** FR-AUTH-05 password rules: at least 8 characters, with letters and numbers. */
export const newPasswordSchema = z
  .string({ error: 'New password is required' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: newPasswordSchema,
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
