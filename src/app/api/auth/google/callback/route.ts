import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForProfile, isGoogleConfigured, isGoogleSimulationAllowed } from '@/lib/auth/google';
import { upsertGoogleAccount } from '@/lib/server/accounts';
import { createSession, requestContext } from '@/lib/auth/session';
import { readGoogleConsent } from '@/app/actions/auth';
import { safeEqual } from '@/lib/auth/crypto';
import { normaliseEmail, isValidEmail } from '@/lib/auth/validation';

/**
 * Finish Google sign-in.
 *
 * `state` is compared in constant time against the cookie set at the start of
 * the flow. A mismatch means the request did not originate here, and is
 * refused before anything is looked up.
 */
export async function GET(request: Request) {
  return handle(request, new URL(request.url).searchParams);
}

/** The local preview form posts here when no Google credentials are configured. */
export async function POST(request: Request) {
  const formData = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') params.set(key, value);
  }
  return handle(request, params);
}

async function handle(request: Request, params: URLSearchParams) {
  const jar = await cookies();
  const expectedState = jar.get('g_state')?.value;
  const verifier = jar.get('g_verifier')?.value;
  const nonce = jar.get('g_nonce')?.value;
  const next = jar.get('g_next')?.value ?? '/dashboard';

  const clear = () => {
    for (const name of ['g_state', 'g_verifier', 'g_nonce', 'g_next']) jar.delete(name);
  };

  const fail = (reason: string) => {
    clear();
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url), { status: 303 });
  };

  if (params.get('error')) return fail('google_denied');

  const state = params.get('state');
  if (!state || !expectedState || !safeEqual(state, expectedState)) return fail('google_state');

  const consents = nonce ? await readGoogleConsent(nonce) : [];
  const context = await requestContext();

  let profile: { sub: string; email: string; emailVerified: boolean; name: string };

  if (isGoogleConfigured()) {
    const code = params.get('code');
    if (!code || !verifier) return fail('google_code');
    try {
      profile = await exchangeCodeForProfile({ code, codeVerifier: verifier, request });
    } catch (error) {
      // Google's own wording is the only thing that identifies a
      // redirect_uri_mismatch or an expired code, so it goes to the server log
      // rather than being swallowed into a generic failure.
      console.error('[google] token exchange failed:', error);
      return fail('google_exchange');
    }
  } else if (isGoogleSimulationAllowed()) {
    // Local preview: the "Google account" is typed into a form on this site and
    // is clearly labelled as a stand-in. Never reachable in production.
    const email = normaliseEmail(String(params.get('email') ?? ''));
    if (!isValidEmail(email)) return fail('google_email');
    profile = {
      sub: `preview:${email}`,
      email,
      emailVerified: true,
      name: String(params.get('name') ?? '').trim() || email.split('@')[0]!,
    };
  } else {
    return fail('google_unconfigured');
  }

  const result = await upsertGoogleAccount({ ...profile, consents, context });
  if (!result.ok) {
    clear();
    const reason = result.field === 'consent' ? 'consent' : 'google_account';
    return NextResponse.redirect(new URL(`/signup?method=google&error=${reason}`, request.url), {
      status: 303,
    });
  }

  await createSession(result.userId);
  clear();
  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
