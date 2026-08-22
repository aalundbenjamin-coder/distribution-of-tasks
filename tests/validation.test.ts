import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  normaliseEmail,
  normalisePhone,
  passwordProblems,
} from '@/lib/auth/validation';
import { generateOtp, hashPassword, sha256, verifyPassword } from '@/lib/auth/crypto';

describe('e-mail normalisation', () => {
  it('lower-cases and trims so one person cannot make two accounts', () => {
    expect(normaliseEmail('  Anna@Example.COM ')).toBe('anna@example.com');
  });

  it.each([
    ['anna@example.com', true],
    ['anna.holm+work@example.co.uk', true],
    ['anna@example', false],
    ['anna example.com', false],
    ['@example.com', false],
    ['', false],
  ])('validates %s as %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

describe('phone normalisation to E.164', () => {
  it.each([
    ['+45 20 12 34 56', '+4520123456'],
    ['20123456', '+4520123456'],
    ['20-12-34-56', '+4520123456'],
    ['004520123456', '+4520123456'],
    ['(20) 12 34 56', '+4520123456'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it('keeps an explicit foreign country code', () => {
    expect(normalisePhone('+44 7700 900123')).toBe('+447700900123');
  });

  it('honours a different default country code', () => {
    expect(normalisePhone('7700900123', '+44')).toBe('+447700900123');
  });

  it('rejects nonsense', () => {
    expect(normalisePhone('12345')).toBeNull();
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone('abc')).toBeNull();
  });
});

describe('password rules', () => {
  it('accepts a reasonable password', () => {
    expect(passwordProblems('correct-horse-battery')).toEqual([]);
  });
  it('rejects a short one', () => {
    expect(passwordProblems('short').join(' ')).toContain('at least 10');
  });
  it('rejects a known-breached one', () => {
    expect(passwordProblems('password123').join(' ')).toContain('breach');
  });
  it('rejects a single repeated character', () => {
    expect(passwordProblems('aaaaaaaaaaaa').join(' ')).toContain('repeated');
  });
});

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword('correct-horse-battery', hash)).toBe(true);
    expect(await verifyPassword('correct-horse-batter', hash)).toBe(false);
  });

  it('never stores the password and salts each hash differently', async () => {
    const a = await hashPassword('correct-horse-battery');
    const b = await hashPassword('correct-horse-battery');
    expect(a).not.toContain('correct-horse-battery');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct-horse-battery', b)).toBe(true);
  });

  it('rejects malformed or missing hashes instead of throwing', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$zz$zz')).toBe(false);
  });
});

describe('one-time codes', () => {
  it('produces six digits, keeping leading zeros', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });
  it('is not trivially repetitive', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateOtp()));
    expect(codes.size).toBeGreaterThan(80);
  });
  it('hashes deterministically', () => {
    expect(sha256('418302')).toBe(sha256('418302'));
    expect(sha256('418302')).not.toBe(sha256('418303'));
  });
});
