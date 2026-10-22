import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

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
