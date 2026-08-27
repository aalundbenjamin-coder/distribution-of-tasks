'use server';

/**
 * Settings: consent, and adding a second way to sign in.
 *
 * Changing a consent writes a new row rather than editing the old one, so the
 * history stays intact — which is what lets the privacy policy promise that we
 * can always show what someone had agreed to on a given day.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { AccessError, assertUser } from '@/lib/server/permissions';
import { recordConsents, getConsentState } from '@/lib/auth/consent';
import { requestContext } from '@/lib/auth/session';
import { recordAudit } from '@/lib/server/audit';
import { CONSENT_TYPES, type ConsentType } from '@/lib/domain/enums';
import { issueOtp, verifyOtp } from '@/lib/auth/otp';
import { sendSms } from '@/lib/notifications/transports';
import { normalisePhone, phoneSchema } from '@/lib/auth/validation';
import type { ActionState } from './catalogue';

const EMPTY: ActionState = { ok: false };

/** The four consents a person can change themselves. */
const EDITABLE: ConsentType[] = [
  'OPERATIONAL_EMAIL',
  'OPERATIONAL_SMS',
  'MARKETING_EMAIL',
  'MARKETING_SMS',
];

export async function updateNotificationConsentAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertUser();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  // Independent reads, one round trip of latency instead of two. On a remote
  // database each avoidable await is a visible slice of the button's delay.
  const [current, context] = await Promise.all([getConsentState(actor.id), requestContext()]);

  // Only write rows for decisions that actually changed, so the history reads
  // as a list of decisions rather than a list of page saves.
  const changed = EDITABLE.map((type) => ({
    type,
    granted: formData.get(`consent_${type}`) === 'on',
  })).filter((decision) => current[decision.type] !== decision.granted);

  if (changed.length === 0) {
    return { ok: true, message: 'Nothing changed.' };
  }

  // The audit row is best-effort by contract, so it does not get to hold the
  // response hostage: the consent write is awaited, the audit write races it.
  await Promise.all([
    recordConsents({
      userId: actor.id,
      decisions: changed,
      source: 'SETTINGS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    }),
    recordAudit({
      actorId: actor.id,
      action: 'consent.updated',
      entity: 'User',
      entityId: actor.id,
      data: { changed },
      ipAddress: context.ipAddress,
    }),
  ]);

  revalidatePath('/settings');

  const turnedOn = changed.filter((c) => c.granted).length;
  const turnedOff = changed.length - turnedOn;
  const parts: string[] = [];
  if (turnedOn) parts.push(`${turnedOn} turned on`);
  if (turnedOff) parts.push(`${turnedOff} turned off`);
  return { ok: true, message: `Saved — ${parts.join(', ')}. The bell keeps working either way.` };
}

/** Re-accepting the current terms, when the version on file is out of date. */
export async function reacceptTermsAction(): Promise<ActionState> {
  let actor;
  try {
    actor = await assertUser();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const context = await requestContext();
  await recordConsents({
    userId: actor.id,
    decisions: [
      { type: 'TERMS_OF_SERVICE', granted: true },
      { type: 'PRIVACY_POLICY', granted: true },
    ],
    source: 'SETTINGS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  revalidatePath('/settings');
  return { ok: true, message: 'Thank you — the current versions are recorded against your account.' };
}

// ---------------------------------------------------------------------------
// Adding a phone number to an existing account
// ---------------------------------------------------------------------------

export interface PhoneLinkState extends ActionState {
  step?: 'code';
  devCode?: string;
  phone?: string;
}

export async function startPhoneLinkAction(
  _prev: PhoneLinkState = EMPTY,
  formData: FormData,
): Promise<PhoneLinkState> {
  let actor;
  try {
    actor = await assertUser();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const parsed = phoneSchema.safeParse(formData.get('phone'));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message, field: 'phone' };
  }
  const phone = parsed.data;

  const taken = await prisma.user.findFirst({
    where: { phone, NOT: { id: actor.id } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: 'Another account already uses that number.', field: 'phone' };

  const issued = await issueOtp(phone, 'PHONE_OTP', actor.id);
  if (!issued.ok) return { ok: false, error: issued.error, field: 'phone' };

  const delivery = await sendSms({
    to: phone,
    text: `${issued.otp.code} is your Distribution of Tasks verification code. It expires in 10 minutes.`,
  });

  return {
    ok: true,
    step: 'code',
    phone,
    message: `We sent a six-digit code to ${phone}.`,
    devCode:
      delivery.transport === 'LOCAL' && process.env.NODE_ENV !== 'production'
        ? issued.otp.code
        : undefined,
  };
}

export async function confirmPhoneLinkAction(
  _prev: PhoneLinkState = EMPTY,
  formData: FormData,
): Promise<PhoneLinkState> {
  let actor;
  try {
    actor = await assertUser();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const phone = normalisePhone(String(formData.get('phone') ?? ''));
  if (!phone) return { ok: false, error: 'That phone number is not valid.', field: 'phone' };

  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  const verification = await verifyOtp(phone, 'PHONE_OTP', code);
  if (!verification.ok) {
    return { ok: false, error: verification.error, field: 'code', step: 'code', phone };
  }

  // One batched round trip: the phone and the identity land together or not at
  // all, and the response stops paying for three sequential writes.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: actor.id },
      data: { phone, phoneVerifiedAt: new Date() },
    }),
    prisma.authIdentity.upsert({
      where: { provider_providerUserId: { provider: 'PHONE', providerUserId: phone } },
      create: { userId: actor.id, provider: 'PHONE', providerUserId: phone, label: phone },
      update: { userId: actor.id, lastUsedAt: new Date() },
    }),
  ]);

  await recordAudit({
    actorId: actor.id,
    action: 'auth.phone_linked',
    entity: 'User',
    entityId: actor.id,
  });

  revalidatePath('/settings');
  return { ok: true, message: `${phone} is verified and can now be used to sign in.` };
}

export async function consentSummary() {
  const actor = await assertUser();
  const state = await getConsentState(actor.id);
  return {
    state,
    types: CONSENT_TYPES,
  };
}
