import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './locale';

/**
 * The locale for the current request.
 *
 * Server-only: reading cookies pulls in `next/headers`, which cannot appear in
 * anything a client component imports.
 *
 * Not every caller runs inside a request. The distribution service is also
 * reachable from scripts, seeds and background work, where there is no cookie
 * jar to read and `cookies()` throws. That is not an error — it just means
 * nobody has stated a preference — so it falls back to the default language
 * rather than taking the caller down with it.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    const value = jar.get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
