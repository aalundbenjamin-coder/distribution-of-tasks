'use client';

import { useFormStatus } from 'react-dom';
import { switchLocaleAction } from '@/app/actions/locale';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/locale';

/**
 * Danish / English toggle.
 *
 * Submits a server action that sets the language cookie; the page re-renders
 * in place, keeping scroll position and layout, instead of bouncing through a
 * redirect. The form still posts and returns a full page when JavaScript has
 * not loaded, so the switch works on every page for every reader.
 */
export default function LanguageSwitcher({
  current,
  compact = false,
}: {
  current: Locale;
  compact?: boolean;
}) {
  return (
    <form action={switchLocaleAction} className="segmented" style={{ padding: 2, gap: 2 }}>
      {LOCALES.map((locale) => (
        <LocaleButton key={locale} locale={locale} current={current} compact={compact} />
      ))}
    </form>
  );
}

function LocaleButton({
  locale,
  current,
  compact,
}: {
  locale: Locale;
  current: Locale;
  compact: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="locale"
      value={locale}
      disabled={pending}
      data-active={locale === current}
      lang={locale}
      aria-current={locale === current ? 'true' : undefined}
      style={{
        padding: compact ? '4px 9px' : '6px 12px',
        fontSize: compact ? 12 : 13,
        opacity: pending ? 0.55 : undefined,
        transition: 'opacity 120ms ease',
      }}
      title={LOCALE_NAMES[locale]}
    >
      {compact ? locale.toUpperCase() : LOCALE_NAMES[locale]}
    </button>
  );
}
