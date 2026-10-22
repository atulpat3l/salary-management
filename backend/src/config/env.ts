import 'dotenv/config';
import { z } from 'zod';

/** Used only outside production, so a fresh clone runs without any configuration. */
const DEVELOPMENT_JWT_SECRET = 'development-only-jwt-secret-do-not-use-in-production';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug', 'silent']).default('info'),
    DATABASE_URL: z.string().startsWith('file:').default('file:./dev.db'),
    CORS_ORIGIN: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    JWT_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32, 'must be at least 32 characters').optional(),
    ),
    SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
    LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  })
  .transform((env, ctx) => {
    if (!env.JWT_SECRET && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'is required in production' });
      return z.NEVER;
    }
    return { ...env, JWT_SECRET: env.JWT_SECRET ?? DEVELOPMENT_JWT_SECRET };
  });

export type Env = z.output<typeof envSchema>;

/** Parses raw environment variables; throws a readable error listing every invalid variable. */
export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
