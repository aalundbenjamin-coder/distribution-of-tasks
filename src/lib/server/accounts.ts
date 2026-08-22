/**
 * Creating and signing in to accounts.
 *
 * Three doors lead to the same place — e-mail and password, Google, or a phone
 * number and a one-time code — and all three converge on one User row. Someone
 * who signs up with Google and later adds a phone number keeps one identity,
 * one set of consents and one bell.
 *
 * The terms of service and the privacy policy are refused-by-default: an
 * account cannot be created without an explicit yes to both, recorded with the
 * document version that was on screen at the time. Marketing permission is
 * separate, optional, and defaults to off.
 */

import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { normaliseEmail, normalisePhone } from '@/lib/auth/validation';
import { TERMS_VERSION, recordConsents, type ConsentDecision } from '@/lib/auth/consent';
import { REQUIRED_CONSENTS, type ConsentType } from '@/lib/domain/enums';
import { notify } from '@/lib/notifications/dispatch';
import { recordAudit } from './audit';

const AVATAR_COLOURS = [
  '#2563eb',
  '#7c3aed',
  '#0d9488',
  '#ea580c',
  '#be123c',
  '#4d7c0f',
  '#0369a1',
  '#a16207',
];

/** Deterministic colour so the same person always gets the same avatar. */
function avatarColourFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length]!;
}

export type AccountResult =
  | { ok: true; userId: string; isNew: boolean }
  | { ok: false; error: string; field?: string };

function missingRequiredConsent(decisions: ConsentDecision[]): ConsentType | null {
  for (const type of REQUIRED_CONSENTS) {
    const decision = decisions.find((d) => d.type === type);
    if (!decision?.granted) return type;
  }
  return null;
}

export interface SignUpContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// E-mail and password
// ---------------------------------------------------------------------------

export async function signUpWithEmail(params: {
  fullName: string;
  email: string;
  password: string;
  consents: ConsentDecision[];
  context?: SignUpContext;
}): Promise<AccountResult> {
  const email = normaliseEmail(params.email);

  const missing = missingRequiredConsent(params.consents);
  if (missing) {
    return {
      ok: false,
      field: 'consent',
      error: 'You must accept the terms of service and the privacy policy to create an account.',
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, field: 'email', error: 'An account already exists for that e-mail address.' };
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName: params.fullName,
      passwordHash: await hashPassword(params.password),
      avatarColor: avatarColourFor(email),
      identities: {
        create: { provider: 'EMAIL_PASSWORD', providerUserId: email, label: email },
      },
    },
  });

  await recordConsents({
    userId: user.id,
    decisions: params.consents,
    source: 'SIGNUP',
    ipAddress: params.context?.ipAddress,
    userAgent: params.context?.userAgent,
  });

  await afterSignUp(user.id, 'EMAIL_PASSWORD', params.context);
  return { ok: true, userId: user.id, isNew: true };
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<AccountResult> {
  const email = normaliseEmail(params.email);
  const user = await prisma.user.findUnique({ where: { email } });

  // The same message either way, so the form cannot be used to discover which
  // e-mail addresses have accounts.
  const rejection: AccountResult = {
    ok: false,
    field: 'password',
    error: 'That e-mail address and password do not match an account.',
  };

  if (!user) {
    // Still spend the time hashing, so a missing account is not detectably
    // faster than a wrong password.
    await verifyPassword(params.password, 'scrypt$00$00');
    return rejection;
  }

  if (!(await verifyPassword(params.password, user.passwordHash))) return rejection;

  if (user.status !== 'ACTIVE') {
    return { ok: false, error: 'That account has been suspended. Talk to your administrator.' };
  }

  await prisma.authIdentity.updateMany({
    where: { userId: user.id, provider: 'EMAIL_PASSWORD' },
    data: { lastUsedAt: new Date() },
  });

  return { ok: true, userId: user.id, isNew: false };
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export async function upsertGoogleAccount(params: {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  consents: ConsentDecision[];
  context?: SignUpContext;
}): Promise<AccountResult> {
  const email = normaliseEmail(params.email);

  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: { provider: 'GOOGLE', providerUserId: params.sub } },
    include: { user: true },
  });

  if (identity) {
    if (identity.user.status !== 'ACTIVE') {
      return { ok: false, error: 'That account has been suspended. Talk to your administrator.' };
    }
    await prisma.authIdentity.update({
      where: { id: identity.id },
      data: { lastUsedAt: new Date(), label: email },
    });
    return { ok: true, userId: identity.userId, isNew: false };
  }

  // Same e-mail, different door: link Google to the account that already exists
  // rather than creating a second one.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.status !== 'ACTIVE') {
      return { ok: false, error: 'That account has been suspended. Talk to your administrator.' };
    }
    await prisma.authIdentity.create({
      data: { userId: byEmail.id, provider: 'GOOGLE', providerUserId: params.sub, label: email },
    });
    if (params.emailVerified && !byEmail.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    await recordAudit({
      actorId: byEmail.id,
      action: 'auth.identity_linked',
      entity: 'User',
      entityId: byEmail.id,
      data: { provider: 'GOOGLE' },
    });
    return { ok: true, userId: byEmail.id, isNew: false };
  }

  const missing = missingRequiredConsent(params.consents);
  if (missing) {
    return {
      ok: false,
      field: 'consent',
      error: 'You must accept the terms of service and the privacy policy to create an account.',
    };
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName: params.name,
      emailVerifiedAt: params.emailVerified ? new Date() : null,
      avatarColor: avatarColourFor(email),
      identities: {
        create: { provider: 'GOOGLE', providerUserId: params.sub, label: email },
      },
    },
  });

  await recordConsents({
    userId: user.id,
    decisions: params.consents,
    source: 'SIGNUP',
    ipAddress: params.context?.ipAddress,
    userAgent: params.context?.userAgent,
  });

  await afterSignUp(user.id, 'GOOGLE', params.context);
  return { ok: true, userId: user.id, isNew: true };
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Finish a phone sign-in once the one-time code has been checked.
 *
 * A new number creates an account, which is why the consent decisions have to
 * be collected before the code is sent, not after.
 */
export async function completePhoneAuth(params: {
  phone: string;
  fullName?: string;
  consents: ConsentDecision[];
  context?: SignUpContext;
}): Promise<AccountResult> {
  const phone = normalisePhone(params.phone);
  if (!phone) return { ok: false, field: 'phone', error: 'That phone number is not valid.' };

  const existing = await prisma.user.findUnique({ where: { phone } });

  if (existing) {
    if (existing.status !== 'ACTIVE') {
      return { ok: false, error: 'That account has been suspended. Talk to your administrator.' };
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date() },
    });
    await prisma.authIdentity.updateMany({
      where: { userId: existing.id, provider: 'PHONE' },
      data: { lastUsedAt: new Date() },
    });
    return { ok: true, userId: existing.id, isNew: false };
  }

  const missing = missingRequiredConsent(params.consents);
  if (missing) {
    return {
      ok: false,
      field: 'consent',
      error: 'You must accept the terms of service and the privacy policy to create an account.',
    };
  }

  const fullName = params.fullName?.trim();
  if (!fullName || fullName.length < 2) {
    return { ok: false, field: 'fullName', error: 'Enter your full name.' };
  }

  const user = await prisma.user.create({
    data: {
      phone,
      fullName,
      phoneVerifiedAt: new Date(),
      avatarColor: avatarColourFor(phone),
      identities: { create: { provider: 'PHONE', providerUserId: phone, label: phone } },
    },
  });

  await recordConsents({
    userId: user.id,
    decisions: params.consents,
    source: 'SIGNUP',
    ipAddress: params.context?.ipAddress,
    userAgent: params.context?.userAgent,
  });

  await afterSignUp(user.id, 'PHONE', params.context);
  return { ok: true, userId: user.id, isNew: true };
}

/** Does an account already exist for this number? Drives the sign-up copy. */
export async function phoneAccountExists(phone: string): Promise<boolean> {
  const normalised = normalisePhone(phone);
  if (!normalised) return false;
  return (await prisma.user.count({ where: { phone: normalised } })) > 0;
}

// ---------------------------------------------------------------------------

async function afterSignUp(userId: string, provider: string, context?: SignUpContext) {
  await recordAudit({
    actorId: userId,
    action: 'account.created',
    entity: 'User',
    entityId: userId,
    data: { provider, termsVersion: TERMS_VERSION },
    ipAddress: context?.ipAddress,
  });

  // The first thing in the bell explains the bell.
  await notify({
    userId,
    type: 'WELCOME',
    title: 'Welcome to Distribution of Tasks',
    body:
      'Your account is ready. Anything that needs your attention shows up here in the bell. ' +
      'If you also want it by e-mail or SMS, turn that on under Settings → Notifications — ' +
      'and if you would rather not, everything still arrives here.',
    link: '/settings',
    severity: 'SUCCESS',
    category: 'OPERATIONAL',
  });
}
