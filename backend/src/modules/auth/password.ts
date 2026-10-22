import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { env } from '../../config/env';

// Look-alike characters (0/O, 1/l/I) are left out, because HR reads the password out to the employee.
const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

/**
 * FR-AUTH-04: a random one-time password that meets the password rules (letters and numbers).
 * Uses a cryptographically secure random source.
 */
export function generateTemporaryPassword(length = 12): string {
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(LETTERS + DIGITS));
  // Shuffle so the guaranteed letter and digit are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Passwords are only ever stored as bcrypt hashes (NFR-06). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: string | undefined;

/**
 * A hash to compare against when the login ID does not exist, so an unknown ID takes as long
 * as a wrong password and response times do not reveal which IDs exist.
 */
export function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync('no-such-account', env.BCRYPT_ROUNDS);
  return dummyHash;
}
