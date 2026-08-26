/**
 * Language selection: constants and formatters.
 *
 * Deliberately free of `next/headers` so client components can import it. The
 * server-side cookie read lives in `server.ts`.
 *
 * Danish is the default: this is a Danish workplace tool, and a first-time
 * visitor should not have to find a switch before the site speaks their
 * language. English is one click away and the choice is remembered in a cookie,
 * so it survives sign-out and applies to every page including the ones served
 * before anyone has an account.
 */

export const LOCALES = ['da', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'da';
export const LOCALE_COOKIE = 'dot_locale';

export const LOCALE_NAMES: Record<Locale, string> = {
  da: 'Dansk',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Formats a date in the reader's language.
 *
 * Danish writes "26. august 2026" — day, full stop, lower-case month. English
 * writes "26 Aug 2026". Doing this through Intl rather than by hand is what
 * keeps the two correct.
 */
export function formatDateIn(locale: Locale, date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', {
    day: 'numeric',
    month: locale === 'da' ? 'long' : 'short',
    year: 'numeric',
  });
}

export function formatDateTimeIn(locale: Locale, date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'da' ? 'da-DK' : 'en-GB', {
    day: 'numeric',
    month: locale === 'da' ? 'long' : 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Decimal comma in Danish, decimal point in English. */
export function formatNumberIn(locale: Locale, value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString(locale === 'da' ? 'da-DK' : 'en-GB', { maximumFractionDigits });
}

/**
 * Fills {placeholders} in a translated string.
 *
 * Word order differs between the two languages, so the sentences are stored
 * whole with named slots rather than being assembled from fragments — that is
 * what lets Danish put the number where Danish wants it.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
