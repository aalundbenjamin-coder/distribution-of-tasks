/**
 * Password hashing, one-time codes and constant-time comparison.
 *
 * Everything here is built on `node:crypto` on purpose: no native modules to
 * compile, and scrypt is a memory-hard KDF that is appropriate for passwords.
 * Nothing reversible is ever written to the database — passwords are salted
 * scrypt hashes, session tokens and OTPs are stored only as SHA-256 digests.
 */

import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

/** Hash a password. Returns `scrypt$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Verify a password against a stored hash, in constant time. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return timingSafeEqual(derived, expected);
}

/** A URL-safe random secret, used for session cookies and state parameters. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256, hex. Used to store session tokens and OTPs without the plaintext. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** A numeric one-time code, e.g. "418302". Uses a CSPRNG, not Math.random. */
export function generateOtp(digits = 6): string {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
}

/** Constant-time string comparison that does not leak length through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
