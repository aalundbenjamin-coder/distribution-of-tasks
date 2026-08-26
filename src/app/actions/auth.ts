'use server';

/**
 * Server actions behind the sign-up and sign-in forms.
 *
 * Each returns a `FormState` rather than throwing, so the form can put the
 * message next to the field that caused it. Nothing here trusts the client:
 * consent checkboxes, phone numbers and passwords are all re-validated on the
 * server even though the form validates them too.
 */

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  completePhoneAuth,
  phoneAccountExists,
  signInWithEmail,
  signUpWithEmail,
} from '@/lib/server/accounts';
import { createSession, requestContext } from '@/lib/auth/session';
import { issueOtp, verifyOtp } from '@/lib/auth/otp';
import { sendSms } from '@/lib/notifications/transports';
import {
  emailSchema,
  fullNameSchema,
  normalisePhone,
  passwordSchema,
  phoneSchema,
} from '@/lib/auth/validation';
import type { ConsentDecision } from '@/lib/auth/consent';
import type { ConsentType } from '@/lib/domain/enums';
import { prisma } from '@/lib/db';

export interface FormState {
  ok: boolean;
  error?: string;
  field?: string;
  /** Set by the phone flow to move the form to the code step. */
  step?: 'code';
  /** Development only: the code, so the flow is walkable without an SMS gateway. */
  devCode?: string;
  message?: string;
}

const EMPTY: FormState = { ok: false };

/**
 * Read the consent checkboxes.
 *
 * Anything not ticked is recorded as an explicit "no" rather than left out, so
 * the consent log says what the person actually decided instead of leaving a
 * gap that has to be interpreted later.
 */
function readConsents(formData: FormData): ConsentDecision[] {
  const optional: ConsentType[] = [
    'MARKETING_EMAIL',
    'MARKETING_SMS',
    'OPERATIONAL_EMAIL',
    'OPERATIONAL_SMS',
  ];
  // The form shows one box for both documents, because there is one decision to
  // make. They are still recorded as two consents: the privacy policy and the
  // terms can be revised independently, and the log has to say which version of
  // which document a person agreed to.
  const acceptedDocuments =
    formData.get('accept_documents') === 'on' ||
    (formData.get('accept_terms') === 'on' && formData.get('accept_privacy') === 'on');

  const decisions: ConsentDecision[] = [
    { type: 'TERMS_OF_SERVICE', granted: acceptedDocuments },
    { type: 'PRIVACY_POLICY', granted: acceptedDocuments },
  ];
  for (const type of optional) {
    decisions.push({ type, granted: formData.get(`consent_${type}`) === 'on' });
  }
  return decisions;
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  // Only same-origin paths, so the form cannot be used as an open redirect.
  return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

// ---------------------------------------------------------------------------
// E-mail + password
// ---------------------------------------------------------------------------

const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export async function signUpEmailAction(
  _prev: FormState = EMPTY,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? '') };
  }

  const context = await requestContext();
  const result = await signUpWithEmail({
    ...parsed.data,
    consents: readConsents(formData),
    context,
  });

  if (!result.ok) return { ok: false, error: result.error, field: result.field };

  await createSession(result.userId);
  redirect(safeNext(formData.get('next')));
}

const signInSchema = z.object({
  email: z.string().min(1, 'Enter your e-mail address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function signInEmailAction(
  _prev: FormState = EMPTY,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? '') };
  }

  const result = await signInWithEmail(parsed.data);
  if (!result.ok) return { ok: false, error: result.error, field: result.field };

  await createSession(result.userId);
  redirect(safeNext(formData.get('next')));
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Step one: send a code.
 *
 * For a number that has no account yet this is also the moment consent is
 * captured — the account is created as soon as the code is confirmed, so the
 * decision has to be on record before then.
 */
export async function requestPhoneCodeAction(
  _prev: FormState = EMPTY,
  formData: FormData,
): Promise<FormState> {
  const mode = formData.get('mode') === 'signup' ? 'signup' : 'login';
  const parsed = phoneSchema.safeParse(formData.get('phone'));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message, field: 'phone' };
  }
  const phone = parsed.data;
  const exists = await phoneAccountExists(phone);

  if (mode === 'login' && !exists) {
    return {
      ok: false,
      field: 'phone',
      error: 'No account uses that number. Create one instead.',
    };
  }

  if (mode === 'signup' && !exists) {
    const name = fullNameSchema.safeParse(formData.get('fullName'));
    if (!name.success) return { ok: false, error: name.error.issues[0]!.message, field: 'fullName' };

    const consents = readConsents(formData);
    const termsOk = consents.find((c) => c.type === 'TERMS_OF_SERVICE')?.granted;
    const privacyOk = consents.find((c) => c.type === 'PRIVACY_POLICY')?.granted;
    if (!termsOk || !privacyOk) {
      return {
        ok: false,
        field: 'consent',
        error: 'You must accept the terms of service and the privacy policy to create an account.',
      };
    }
  }

  const issued = await issueOtp(phone, 'PHONE_OTP');
  if (!issued.ok) return { ok: false, error: issued.error, field: 'phone' };

  const delivery = await sendSms({
    to: phone,
    text: `${issued.otp.code} is your Distribution of Tasks code. It expires in 10 minutes. If you did not ask for it, ignore this message.`,
  });

  return {
    ok: true,
    step: 'code',
    message: `We sent a six-digit code to ${phone}.`,
    // Only ever populated by the local transport, and only outside production.
    devCode:
      delivery.transport === 'LOCAL' && process.env.NODE_ENV !== 'production'
        ? issued.otp.code
        : undefined,
  };
}

/** Step two: check the code, then create or resume the account. */
export async function verifyPhoneCodeAction(
  _prev: FormState = EMPTY,
  formData: FormData,
): Promise<FormState> {
  const rawPhone = String(formData.get('phone') ?? '');
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, error: 'That phone number is not valid.', field: 'phone' };

  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length !== 6) {
    return { ok: false, error: 'Enter the six digits from the message.', field: 'code', step: 'code' };
  }

  const verification = await verifyOtp(phone, 'PHONE_OTP', code);
  if (!verification.ok) {
    return { ok: false, error: verification.error, field: 'code', step: 'code' };
  }

  const context = await requestContext();
  const result = await completePhoneAuth({
    phone,
    fullName: String(formData.get('fullName') ?? ''),
    consents: readConsents(formData),
    context,
  });

  if (!result.ok) return { ok: false, error: result.error, field: result.field, step: 'code' };

  await createSession(result.userId);
  redirect(safeNext(formData.get('next')));
}

// ---------------------------------------------------------------------------
// Google: consent has to be captured before we leave for Google
// ---------------------------------------------------------------------------

/**
 * Stash the consent decisions taken on the sign-up form, keyed by a nonce that
 * travels through Google's `state` parameter, so the callback can record them
 * against the new account. Rows expire like any other verification token.
 */
export async function stashGoogleConsent(nonce: string, decisions: ConsentDecision[]) {
  await prisma.verificationToken.create({
    data: {
      purpose: 'EMAIL_VERIFY',
      destination: `google-consent:${nonce}`,
      codeHash: JSON.stringify(decisions),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
}

export async function readGoogleConsent(nonce: string): Promise<ConsentDecision[]> {
  const row = await prisma.verificationToken.findFirst({
    where: { destination: `google-consent:${nonce}`, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row || row.expiresAt < new Date()) return [];
  await prisma.verificationToken.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  try {
    return JSON.parse(row.codeHash) as ConsentDecision[];
  } catch {
    return [];
  }
}
