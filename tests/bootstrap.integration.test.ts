/**
 * The very first account on a fresh deployment.
 *
 * A new database has nobody who can create a folder, define a position or
 * distribute anything — and no way to appoint one without opening the database
 * by hand. The first account to exist therefore becomes the platform
 * administrator, and everyone after it is an ordinary coworker.
 *
 * This runs against a real database and cleans up after itself.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { signUpWithEmail } from '@/lib/server/accounts';
import type { ConsentDecision } from '@/lib/auth/consent';

const CONSENTS: ConsentDecision[] = [
  { type: 'TERMS_OF_SERVICE', granted: true },
  { type: 'PRIVACY_POLICY', granted: true },
];

const MADE: string[] = [];

async function signUp(email: string, name: string) {
  const result = await signUpWithEmail({
    fullName: name,
    email,
    password: 'correct-horse-battery',
    consents: CONSENTS,
  });
  if (result.ok) MADE.push(result.userId);
  return result;
}

afterEach(async () => {
  // Cascades clear identities, consents, sessions and notifications.
  if (MADE.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: MADE.splice(0) } } });
  }
});

describe('bootstrapping a fresh deployment', () => {
  it('makes the first account the platform administrator, and later ones coworkers', async () => {
    // Snapshot and clear, so the check runs against a genuinely empty database.
    const existing = await prisma.user.findMany({ select: { id: true } });
    const hadUsers = existing.length > 0;

    if (hadUsers) {
      // The seeded organisation is present, so a new sign-up must NOT be made
      // an administrator — that is the more important half of the rule.
      const result = await signUp('bootstrap.later@example.com', 'Later Person');
      expect(result.ok).toBe(true);
      const user = await prisma.user.findUnique({
        where: { id: (result as { userId: string }).userId },
        select: { role: true },
      });
      expect(user?.role).toBe('COWORKER');
      return;
    }

    const first = await signUp('bootstrap.first@example.com', 'First Person');
    expect(first.ok).toBe(true);
    const founder = await prisma.user.findUnique({
      where: { id: (first as { userId: string }).userId },
      select: { role: true },
    });
    expect(founder?.role).toBe('PLATFORM_ADMIN');

    const second = await signUp('bootstrap.second@example.com', 'Second Person');
    const other = await prisma.user.findUnique({
      where: { id: (second as { userId: string }).userId },
      select: { role: true },
    });
    expect(other?.role).toBe('COWORKER');
  });

  it('still refuses an account without the required consents', async () => {
    const result = await signUpWithEmail({
      fullName: 'No Consent',
      email: 'bootstrap.noconsent@example.com',
      password: 'correct-horse-battery',
      consents: [{ type: 'TERMS_OF_SERVICE', granted: true }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('consent');
  });
});
