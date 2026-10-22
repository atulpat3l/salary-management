import winston from 'winston';
import { env } from '../config/env';

const SENSITIVE_KEY = /password|token|authorization|secret/i;
const REDACTED = '[REDACTED]';

/** Returns a copy of `value` with every sensitive key (password, token, ...) masked, at any depth. NFR-06 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object' || value instanceof Error) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(inner),
    ]),
  );
}

const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    info[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(info[key]);
  }
  return info;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL === 'silent' ? 'error' : env.LOG_LEVEL,
  silent: env.LOG_LEVEL === 'silent',
  format: winston.format.combine(
    redactFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  transports: [new winston.transports.Console()],
});
