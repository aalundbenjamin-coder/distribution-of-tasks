/**
 * Session handling.
 *
 * The cookie carries a random secret; the database stores only its SHA-256
 * digest. Someone who reads the database therefore cannot mint a working
 * cookie. Sessions have an absolute expiry and can be revoked individually
 * (sign out here) or in bulk (sign out everywhere, password change).
 */

import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { prisma } from '@/lib/db';
import { randomToken, sha256 } from './crypto';
import type { UserRole } from '@/lib/domain/enums';

export const SESSION_COOKIE = 'dot_session';
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: string;
  avatarColor: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  coworkerId: string | null;
}

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
}

/** Issue a session and set the cookie. Called after every successful sign-in. */
export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const hdrs = await headers();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: expiryFromNow(),
      userAgent: hdrs.get('user-agent')?.slice(0, 300) ?? null,
      ipAddress: clientIpFrom(hdrs),
    },
  });

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 86_400,
  });

  return token;
}

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's `cache` so a page that asks several times in one render
 * hits the database once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { coworker: { select: { id: true } } } } },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.user.status !== 'ACTIVE') return null;

  const { user } = session;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role as UserRole,
    status: user.status,
    avatarColor: user.avatarColor,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    coworkerId: user.coworker?.id ?? null,
  };
});

/** Revoke the current session and clear the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session a user holds. Used when a password changes. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function clientIpFrom(hdrs: Headers): string | null {
  const forwarded = hdrs.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 64);
  return hdrs.get('x-real-ip')?.slice(0, 64) ?? null;
}

/** IP and user-agent of the current request, recorded alongside consent. */
export async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const hdrs = await headers();
  return {
    ipAddress: clientIpFrom(hdrs),
    userAgent: hdrs.get('user-agent')?.slice(0, 300) ?? null,
  };
}
