import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keep every visitor on one hostname.
 *
 * Vercel gives each deployment its own hostname alongside the stable one, so
 * the same site is reachable at several addresses. That is harmless for reading
 * pages and fatal for sign-in: cookies are scoped to the host that set them,
 * but `APP_ORIGIN` pins the Google redirect URI to the canonical host. Start on
 * a deployment hostname and the state cookie is written on one host while
 * Google returns the browser to another, which drops the cookie and fails the
 * state check for a request that was never forged.
 *
 * Redirecting navigations to the canonical origin first means the cookie host
 * and the redirect host are always the same one.
 */
export function middleware(request: NextRequest) {
  const canonical = canonicalOrigin();
  if (!canonical) return NextResponse.next();

  // A redirect turns a POST into a GET and drops its body, so form submissions
  // are left alone. They already carry the host of the page that rendered them.
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();

  const host = requestHost(request);
  if (!host || host === canonical.host.toLowerCase()) return NextResponse.next();

  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonical.origin);

  // The Location header is written directly rather than through
  // NextResponse.redirect, which collapses a target to a relative path when it
  // matches the request's own origin. A relative Location here would send the
  // browser back to the host it came from and loop forever; only an absolute
  // URL actually moves it to the canonical host.
  const response = new NextResponse(null, { status: 307 });
  response.headers.set('location', target.toString());
  return response;
}

/**
 * `APP_ORIGIN` parsed, or null when it is unset or unusable.
 *
 * A malformed value must not be treated as a destination: redirecting every
 * request to an origin that cannot serve them would take the whole site down
 * rather than just sign-in, so anything that is not an absolute http(s) origin
 * is ignored.
 */
function canonicalOrigin(): URL | null {
  const configured = process.env.APP_ORIGIN?.trim().replace(/\/+$/, '');
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.host ? url : null;
  } catch {
    return null;
  }
}

/** The hostname the browser actually asked for, as seen behind Vercel's proxy. */
function requestHost(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!forwarded) return null;
  return forwarded.split(',')[0]!.trim().toLowerCase() || null;
}

export const config = {
  // Static assets are served straight from the CDN and never read cookies.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js|txt|xml|webmanifest)$).*)'],
};
