/**
 * One-time codes for phone sign-up/sign-in and e-mail verification.
 *
 * Guards, because an OTP endpoint is the softest target in an auth system:
 *  * codes expire after ten minutes;
 *  * a code can be attempted five times, then it is burned;
 *  * issuing a new code for a destination invalidates the previous one, so an
 *    attacker cannot widen the guessing surface by requesting many codes;
 *  * there is a cooldown between sends for the same destination;
 *  * only the SHA-256 digest of the code is stored.
 */

import { prisma } from '@/lib/db';
import { generateOtp, sha256 } from './crypto';
import type { VerificationPurpose } from '@/lib/domain/enums';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
/** Codes that may be issued to one destination inside the window below. */
export const OTP_MAX_PER_HOUR = 6;

export interface IssuedOtp {
  code: string;
  expiresAt: Date;
  tokenId: string;
}

export type IssueResult =
  | { ok: true; otp: IssuedOtp }
  | { ok: false; error: string; retryAfterSeconds?: number };

export async function issueOtp(
  destination: string,
  purpose: VerificationPurpose,
  userId?: string | null,
): Promise<IssueResult> {
  const now = new Date();

  const recent = await prisma.verificationToken.findFirst({
    where: { destination, purpose },
    orderBy: { createdAt: 'desc' },
  });

  if (recent) {
    const elapsed = (now.getTime() - recent.createdAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        error: 'A code was just sent. Wait a moment before asking for another.',
        retryAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }

  const lastHour = new Date(now.getTime() - 3_600_000);
  const issuedThisHour = await prisma.verificationToken.count({
    where: { destination, purpose, createdAt: { gte: lastHour } },
  });
  if (issuedThisHour >= OTP_MAX_PER_HOUR) {
    return {
      ok: false,
      error: 'Too many codes requested for this number. Try again in an hour.',
      retryAfterSeconds: 3600,
    };
  }

  // Burn any code still outstanding for this destination.
  await prisma.verificationToken.updateMany({
    where: { destination, purpose, consumedAt: null },
    data: { consumedAt: now },
  });

  const code = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
  const token = await prisma.verificationToken.create({
    data: {
      userId: userId ?? null,
      purpose,
      destination,
      codeHash: sha256(code),
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
    },
  });

  return { ok: true, otp: { code, expiresAt, tokenId: token.id } };
}

export type VerifyResult =
  | { ok: true; userId: string | null }
  | { ok: false; error: string; attemptsLeft?: number };

export async function verifyOtp(
  destination: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<VerifyResult> {
  const now = new Date();
  const token = await prisma.verificationToken.findFirst({
    where: { destination, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) return { ok: false, error: 'No code is waiting for that destination. Request a new one.' };

  if (token.expiresAt < now) {
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { consumedAt: now },
    });
    return { ok: false, error: 'That code has expired. Request a new one.' };
  }

  if (token.attempts >= token.maxAttempts) {
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { consumedAt: now },
    });
    return { ok: false, error: 'Too many wrong attempts. Request a new code.' };
  }

  const submitted = code.replace(/\D/g, '');
  if (sha256(submitted) !== token.codeHash) {
    const updated = await prisma.verificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    const attemptsLeft = Math.max(0, updated.maxAttempts - updated.attempts);
    return {
      ok: false,
      error: attemptsLeft > 0 ? `That code is not right. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.',
      attemptsLeft,
    };
  }

  await prisma.verificationToken.update({
    where: { id: token.id },
    data: { consumedAt: now },
  });

  return { ok: true, userId: token.userId };
}

/** Housekeeping: drop tokens that are long dead. Safe to call at any time. */
export async function pruneVerificationTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3_600_000);
  const { count } = await prisma.verificationToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return count;
}
