import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/locale';

/**
 * Switch language.
 *
 * A plain form post rather than client-side state, so it works before any
 * JavaScript has loaded and on every page including the public ones. The
 * chosen language is remembered for a year.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const requested = formData.get('locale');
  const next = String(formData.get('next') ?? '/');

  if (isLocale(requested)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, requested, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  // Only same-origin paths, so the switcher cannot be used as an open redirect.
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(new URL(safe, request.url), { status: 303 });
}
