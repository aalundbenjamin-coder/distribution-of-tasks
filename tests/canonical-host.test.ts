import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { offCanonicalHost, redirectUri } from '@/lib/auth/google';
import { middleware } from '@/middleware';

const CANONICAL = 'https://distribution-of-tasks.vercel.app';
const DEPLOYMENT = 'distribution-of-tasks-b1ghr8o3j-newproject-9e53747e.vercel.app';

/** A request as it arrives behind Vercel's proxy, which rewrites the host header. */
function proxied(host: string, path = '/api/auth/google/start') {
  return new Request(`https://internal.invalid${path}`, {
    headers: { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' },
  });
}

afterEach(() => {
  delete process.env.APP_ORIGIN;
});

describe('off-canonical detection', () => {
  it('is inert when no canonical origin is configured', () => {
    expect(offCanonicalHost(proxied(DEPLOYMENT))).toBeNull();
  });

  it('passes a request that already arrived on the canonical host', () => {
    process.env.APP_ORIGIN = CANONICAL;
    expect(offCanonicalHost(proxied('distribution-of-tasks.vercel.app'))).toBeNull();
  });

  it('catches a request that arrived on a per-deployment host', () => {
    process.env.APP_ORIGIN = CANONICAL;
    expect(offCanonicalHost(proxied(DEPLOYMENT))).toBe(CANONICAL);
  });

  it('ignores a trailing slash and the case of the host', () => {
    process.env.APP_ORIGIN = `${CANONICAL}/`;
    expect(offCanonicalHost(proxied('Distribution-Of-Tasks.vercel.app'))).toBeNull();
  });

  it('reads only the first entry of a chained x-forwarded-host', () => {
    process.env.APP_ORIGIN = CANONICAL;
    expect(offCanonicalHost(proxied(`distribution-of-tasks.vercel.app, ${DEPLOYMENT}`))).toBeNull();
  });

  it('stays inert when APP_ORIGIN is not a usable absolute origin', () => {
    for (const bad of ['distribution-of-tasks.vercel.app', 'not a url', '/signup']) {
      process.env.APP_ORIGIN = bad;
      expect(offCanonicalHost(proxied(DEPLOYMENT))).toBeNull();
    }
  });
});

describe('the invariant sign-in depends on', () => {
  // The state cookie is written on the host the request arrived at, and Google
  // returns the browser to `redirectUri`. Cookies do not cross hostnames, so
  // whenever the flow is allowed to start those two hosts must be the same one.
  it('never lets a flow start where the cookie host and the return host differ', () => {
    for (const configured of [undefined, CANONICAL, `${CANONICAL}/`]) {
      if (configured) process.env.APP_ORIGIN = configured;
      else delete process.env.APP_ORIGIN;

      for (const host of ['distribution-of-tasks.vercel.app', DEPLOYMENT]) {
        const request = proxied(host);
        if (offCanonicalHost(request)) continue; // refused before any cookie is set
        expect(new URL(redirectUri(request)).host).toBe(host);
      }
    }
  });
});

describe('canonical-host middleware', () => {
  const nav = (host: string, path = '/signup', method = 'GET') =>
    new NextRequest(`https://${host}${path}`, { method, headers: { 'x-forwarded-host': host } });

  it('sends a navigation on a deployment host to the canonical one, keeping path and query', () => {
    process.env.APP_ORIGIN = CANONICAL;
    const res = middleware(nav(DEPLOYMENT, '/signup?method=google&next=%2Fdashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      `${CANONICAL}/signup?method=google&next=%2Fdashboard`,
    );
  });

  it('leaves a navigation already on the canonical host alone', () => {
    process.env.APP_ORIGIN = CANONICAL;
    const res = middleware(nav('distribution-of-tasks.vercel.app'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('never redirects a POST, which would drop the form body', () => {
    process.env.APP_ORIGIN = CANONICAL;
    const res = middleware(nav(DEPLOYMENT, '/api/auth/google/start', 'POST'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('does nothing at all when no canonical origin is configured', () => {
    const res = middleware(nav(DEPLOYMENT));
    expect(res.headers.get('location')).toBeNull();
  });

  it('refuses to redirect anywhere when APP_ORIGIN is malformed', () => {
    // A bad value must degrade to leaving the site reachable, not send every
    // request to an origin that cannot serve it.
    process.env.APP_ORIGIN = 'distribution-of-tasks.vercel.app';
    const res = middleware(nav(DEPLOYMENT));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('the redirect the browser actually receives', () => {
  it('is absolute, so it cannot bounce back to the host it came from', () => {
    // NextResponse.redirect collapses a same-origin target to a relative path.
    // Were that to happen here the browser would re-request the same URL on the
    // same host, get the same redirect, and loop until it gave up.
    process.env.APP_ORIGIN = CANONICAL;
    const request = new NextRequest(`https://${DEPLOYMENT}/signup`, {
      headers: { 'x-forwarded-host': DEPLOYMENT },
    });
    const location = middleware(request).headers.get('location');
    expect(location).toBe(`${CANONICAL}/signup`);
    expect(new URL(location!).host).not.toBe(DEPLOYMENT);
  });
});
