import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomToken } from '@/lib/auth/crypto';
import {
  buildAuthorizationUrl,
  createPkcePair,
  isGoogleConfigured,
  isGoogleSimulationAllowed,
} from '@/lib/auth/google';
import { stashGoogleConsent } from '@/app/actions/auth';
import type { ConsentDecision } from '@/lib/auth/consent';
import type { ConsentType } from '@/lib/domain/enums';

/**
 * Start Google sign-in.
 *
 * The consent checkboxes are read here, before the redirect, and stored against
 * a nonce carried in `state`. Google never sees them; the callback picks them
 * back up and writes them against the account it creates.
 *
 * State and PKCE verifier live in short-lived, httpOnly cookies, so a forged
 * callback cannot complete a sign-in.
 */
export async function POST(request: Request) {
  const formData = await request.formData();

  const optional: ConsentType[] = [
    'MARKETING_EMAIL',
    'MARKETING_SMS',
    'OPERATIONAL_EMAIL',
    'OPERATIONAL_SMS',
  ];
  // One box on the form, two consents on the record — see actions/auth.ts.
  const acceptedDocuments =
    formData.get('accept_documents') === 'on' ||
    (formData.get('accept_terms') === 'on' && formData.get('accept_privacy') === 'on');

  const decisions: ConsentDecision[] = [
    { type: 'TERMS_OF_SERVICE', granted: acceptedDocuments },
    { type: 'PRIVACY_POLICY', granted: acceptedDocuments },
    ...optional.map((type) => ({ type, granted: formData.get(`consent_${type}`) === 'on' })),
  ];

  const mode = formData.get('mode') === 'signup' ? 'signup' : 'login';

  // Signing up requires the two mandatory consents up front; signing in to an
  // account that already exists does not re-ask.
  if (mode === 'signup') {
    const termsOk = decisions.find((d) => d.type === 'TERMS_OF_SERVICE')?.granted;
    const privacyOk = decisions.find((d) => d.type === 'PRIVACY_POLICY')?.granted;
    if (!termsOk || !privacyOk) {
      return NextResponse.redirect(
        new URL('/signup?method=google&error=consent', request.url),
        { status: 303 },
      );
    }
  }

  const state = randomToken(24);
  const nonce = randomToken(16);
  const { verifier, challenge } = createPkcePair();

  await stashGoogleConsent(nonce, decisions);

  const jar = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 900,
  };
  jar.set('g_state', state, cookieOptions);
  jar.set('g_verifier', verifier, cookieOptions);
  jar.set('g_nonce', nonce, cookieOptions);

  const nextRaw = String(formData.get('next') ?? '');
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';
  jar.set('g_next', next, cookieOptions);

  if (isGoogleConfigured()) {
    const url = buildAuthorizationUrl({ request, state, codeChallenge: challenge });
    return NextResponse.redirect(url, { status: 303 });
  }

  if (isGoogleSimulationAllowed()) {
    return NextResponse.redirect(
      new URL(`/auth/google-preview?state=${encodeURIComponent(state)}`, request.url),
      { status: 303 },
    );
  }

  return NextResponse.redirect(
    new URL('/login?error=google_unconfigured', request.url),
    { status: 303 },
  );
}
