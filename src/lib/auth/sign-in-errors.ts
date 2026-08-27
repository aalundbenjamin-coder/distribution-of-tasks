import type { Dictionary } from '@/lib/i18n/dictionary';

/**
 * Turn an `?error=` code from the Google routes into a sentence in the reader's
 * language. Unknown codes fall back to the generic line rather than showing the
 * raw code, which means a new failure path can never leak an identifier onto
 * the page before its message is written.
 */
export function signInErrorMessage(t: Dictionary, code: string | undefined | null): string | null {
  if (!code) return null;
  const e = t.auth.signInErrors;
  const messages: Record<string, string> = {
    google_denied: e.denied,
    google_state: e.state,
    google_code: e.code,
    google_email: e.email,
    google_account: e.account,
    google_host: e.host,
    google_unconfigured: e.unconfigured,
    google_exchange: e.exchange,
    consent: t.auth.consentRequired,
  };
  return messages[code] ?? e.generic;
}
