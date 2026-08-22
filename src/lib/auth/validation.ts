/**
 * Normalisation and validation of the three things a person can sign up with.
 *
 * Normalisation matters as much as validation: "Anna@Example.com " and
 * "anna@example.com" must resolve to the same account, and "20 12 34 56" typed
 * in Denmark must resolve to "+4520123456", or the uniqueness constraints in
 * the database do not mean what they look like they mean.
 */

import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const email = normaliseEmail(input);
  return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * Normalise a phone number to E.164.
 *
 * `defaultCountryCode` is applied when the user types a local number without a
 * country prefix. It defaults to Denmark because that is where the first
 * deployment sits; set NEXT_PUBLIC_DEFAULT_COUNTRY_CODE to change it.
 */
export function normalisePhone(input: string, defaultCountryCode = '+45'): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Keep a leading +, drop every other non-digit (spaces, dashes, brackets).
  const hasPlus = raw.startsWith('+') || raw.startsWith('00');
  const digits = raw.replace(/^00/, '').replace(/[^\d]/g, '');
  if (digits.length < 6 || digits.length > 15) return null;

  if (hasPlus) return `+${digits}`;

  const cc = defaultCountryCode.replace(/[^\d]/g, '');
  // A local number that already starts with the country code is left alone.
  if (digits.startsWith(cc) && digits.length > cc.length + 4) return `+${digits}`;
  return `+${cc}${digits}`;
}

export function isValidPhone(input: string, defaultCountryCode = '+45'): boolean {
  return normalisePhone(input, defaultCountryCode) !== null;
}

/**
 * Password rules.
 *
 * Length does more for real-world safety than character-class rules, so the
 * floor is 10 characters and the only other check is against a small list of
 * passwords that appear in every breach corpus.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  'qwertyuiop',
  'letmein123',
  'iloveyou1',
  'administrator',
  'welcome123',
  'abc123456',
]);

export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > 200) problems.push('Use at most 200 characters.');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push('That password appears in public breach lists. Choose another.');
  }
  if (/^(.)\1+$/.test(password)) problems.push('Do not use a single repeated character.');
  return problems;
}

export const passwordSchema = z
  .string()
  .superRefine((value, ctx) => {
    for (const message of passwordProblems(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export const emailSchema = z
  .string()
  .transform(normaliseEmail)
  .refine(isValidEmail, 'Enter a valid e-mail address.');

export const phoneSchema = z
  .string()
  .refine((v) => isValidPhone(v), 'Enter a valid phone number, for example +45 20 12 34 56.')
  .transform((v) => normalisePhone(v) as string);

export const fullNameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, ' '))
  .refine((v) => v.length >= 2, 'Enter your full name.')
  .refine((v) => v.length <= 120, 'That name is too long.');
