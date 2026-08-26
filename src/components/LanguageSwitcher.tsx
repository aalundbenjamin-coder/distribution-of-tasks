'use client';

import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/locale';

/**
 * Danish / English toggle.
 *
 * Posts to a route handler that sets the cookie and sends the reader back to
 * the page they were on, so switching language never loses your place.
 *
 * The return path is read from `window.location` as the form submits rather
 * than from `useSearchParams`. That hook forces every page containing this
 * switcher to have a Suspense boundary — including the statically rendered
 * legal pages, which would otherwise fail to prerender. `usePathname` needs no
 * such boundary, and it is what renders in the markup before JavaScript runs.
 */
export default function LanguageSwitcher({
  current,
  compact = false,
}: {
  current: Locale;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const nextRef = useRef<HTMLInputElement>(null);

  function captureCurrentUrl() {
    if (nextRef.current) {
      nextRef.current.value = window.location.pathname + window.location.search;
    }
  }

  return (
    <form
      action="/api/locale"
      method="post"
      className="segmented"
      style={{ padding: 2, gap: 2 }}
      onSubmit={captureCurrentUrl}
    >
      <input ref={nextRef} type="hidden" name="next" defaultValue={pathname} />
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          data-active={locale === current}
          lang={locale}
          aria-current={locale === current ? 'true' : undefined}
          style={{ padding: compact ? '4px 9px' : '6px 12px', fontSize: compact ? 12 : 13 }}
          title={LOCALE_NAMES[locale]}
        >
          {compact ? locale.toUpperCase() : LOCALE_NAMES[locale]}
        </button>
      ))}
    </form>
  );
}
