'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/locale';

/**
 * Switch the reader's language.
 *
 * A server action rather than a redirecting route handler: setting a cookie
 * inside an action makes Next re-render the page the reader is already on, in
 * place, with the new language. The old route-handler flow was two full
 * navigations — post, then follow a redirect back — which repainted the whole
 * document and read as a flash. Without JavaScript the same form still posts
 * and comes back as a complete page, so nothing is lost for that reader.
 */
export async function switchLocaleAction(formData: FormData): Promise<void> {
  const requested = formData.get('locale');
  if (!isLocale(requested)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, requested, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
}
