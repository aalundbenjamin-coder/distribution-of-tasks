import { DICTIONARIES, type Dictionary } from './dictionary';
import { getLocale } from './server';
import type { Locale } from './locale';

export type { Dictionary };
export { getLocale };
export * from './locale';

/** The dictionary for a known locale. */
export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}

/** The dictionary for the current request, and the locale it came from. */
export async function getTranslations(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaryFor(locale) };
}
