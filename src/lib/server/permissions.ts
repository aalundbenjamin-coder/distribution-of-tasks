/**
 * Who may do what.
 *
 * Three roles, and the split follows the product: a head of distribution runs
 * the folders and hands out work; a coworker sees their own work and their own
 * profile; a platform administrator can do both plus manage accounts.
 *
 * Every guard throws rather than returning false, so a page or action that
 * forgets to check fails closed instead of quietly rendering someone else's
 * data.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, type SessionUser } from '@/lib/auth/session';
import type { UserRole } from '@/lib/domain/enums';

export class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessError';
  }
}

export function canDistribute(role: UserRole): boolean {
  return role === 'HEAD_OF_DISTRIBUTION' || role === 'PLATFORM_ADMIN';
}

export function canManageCatalogue(role: UserRole): boolean {
  return role === 'HEAD_OF_DISTRIBUTION' || role === 'PLATFORM_ADMIN';
}

export function canManageAccounts(role: UserRole): boolean {
  return role === 'PLATFORM_ADMIN';
}

export function canVerifySkills(role: UserRole): boolean {
  return role === 'HEAD_OF_DISTRIBUTION' || role === 'PLATFORM_ADMIN';
}

/** For pages: send an anonymous visitor to sign in, remembering where. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login');
  }
  return user;
}

export async function requireDistributor(returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!canDistribute(user.role)) redirect('/dashboard?denied=distribution');
  return user;
}

export async function requireAdmin(returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!canManageAccounts(user.role)) redirect('/dashboard?denied=admin');
  return user;
}

/** For server actions: throw instead of redirecting, so the form shows an error. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AccessError('You need to sign in again.');
  return user;
}

export async function assertDistributor(): Promise<SessionUser> {
  const user = await assertUser();
  if (!canDistribute(user.role)) {
    throw new AccessError('Only a head of distribution can do that.');
  }
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (!canManageAccounts(user.role)) {
    throw new AccessError('Only a platform administrator can do that.');
  }
  return user;
}
