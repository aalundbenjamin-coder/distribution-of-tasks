/**
 * Google ("Gmail") sign-in.
 *
 * The standard authorisation-code flow with a signed state parameter and PKCE.
 *
 * If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured, the button
 * still works: the app falls back to a clearly-labelled local simulation so the
 * whole sign-up journey — including consent capture and account linking — can
 * be walked through without Google credentials. The simulation is refused when
 * NODE_ENV is production, so it can never be an accidental hole in a live
 * deployment.
 */

import { createHash } from 'node:crypto';
import { randomToken } from './crypto';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export function googleClientId(): string | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  return id ? id : null;
}

export function isGoogleConfigured(): boolean {
  return Boolean(googleClientId() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/**
 * True when the local simulation may stand in for Google. Never in production.
 */
export function isGoogleSimulationAllowed(): boolean {
  return !isGoogleConfigured() && process.env.NODE_ENV !== 'production';
}

/**
 * The public origin of this deployment.
 *
 * Google matches `redirect_uri` character for character against what is
 * registered, so this has to be the address the browser actually used. Behind a
 * proxy — which is what a Vercel deployment is — `request.url` can carry the
 * internal host instead, which produces a redirect_uri_mismatch that is
 * miserable to diagnose. The forwarded headers carry the real one.
 *
 * APP_ORIGIN still wins when set, so a deployment on a custom domain can state
 * its address outright.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${forwardedHost.split(',')[0]!.trim()}`;
  }

  return new URL(request.url).origin;
}

/**
 * Must be byte-identical in the authorisation request and the token exchange,
 * which is why both go through this one function.
 */
export function redirectUri(request: Request): string {
  return `${appOrigin(request)}/api/auth/google/callback`;
}

/**
 * The canonical origin, when this request arrived on some other host.
 *
 * `APP_ORIGIN` pins the address Google returns to. A flow begun on a different
 * host — a per-deployment Vercel URL, say — would write its state cookie on a
 * host the callback never sees, because cookies do not cross hostnames. That
 * has to be caught before any cookie is set, rather than surfacing afterwards
 * as a failed state check on a request nobody forged.
 */
export function offCanonicalHost(request: Request): string | null {
  const configured = process.env.APP_ORIGIN?.trim().replace(/\/+$/, '');
  if (!configured) return null;

  let canonical: URL;
  try {
    canonical = new URL(configured);
  } catch {
    return null;
  }
  if (!canonical.host) return null;

  const forwarded = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const host = (forwarded ?? new URL(request.url).host).split(',')[0]!.trim().toLowerCase();
  if (!host || host === canonical.host.toLowerCase()) return null;
  return canonical.origin;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = randomToken(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizationUrl(params: {
  request: Request;
  state: string;
  codeChallenge: string;
}): string {
  const clientId = googleClientId();
  if (!clientId) throw new Error('Google sign-in is not configured.');
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(params.request));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export async function exchangeCodeForProfile(params: {
  code: string;
  codeVerifier: string;
  request: Request;
}): Promise<GoogleProfile> {
  const clientId = googleClientId();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured.');

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(params.request),
      grant_type: 'authorization_code',
      code_verifier: params.codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => '');
    throw new Error(
      `Google rejected the authorisation code (${tokenResponse.status}). ${detail.slice(0, 300)}`,
    );
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error('Google returned no access token.');

  const userinfoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userinfoResponse.ok) {
    throw new Error(`Could not read the Google profile (${userinfoResponse.status}).`);
  }

  const profile = (await userinfoResponse.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email) throw new Error('That Google account has no e-mail address attached.');

  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified ?? false,
    name: profile.name?.trim() || profile.email.split('@')[0]!,
    picture: profile.picture,
  };
}
