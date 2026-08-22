import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isGoogleSimulationAllowed } from '@/lib/auth/google';
import { GoogleIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Google sign-in (local stand-in)' };

/**
 * A stand-in for Google's consent screen, used only when no Google credentials
 * are configured and only outside production.
 *
 * It exists so the Google branch of sign-up is not a dead end during
 * development. It is labelled plainly as a stand-in — it does not imitate
 * Google's screen, and it cannot be reached once real credentials are set.
 */
export default async function GooglePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (!isGoogleSimulationAllowed()) notFound();
  const { state } = await searchParams;
  if (!state) notFound();

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card card-pad" style={{ width: '100%', maxWidth: 420 }}>
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <GoogleIcon size={22} />
          <h1 style={{ fontSize: 18, fontWeight: 640 }}>Google sign-in — local stand-in</h1>
        </div>

        <div className="notice notice-warn" style={{ margin: '14px 0 18px' }}>
          <span>
            This is <strong>not</strong> Google. No Google credentials are configured on this
            deployment, so this form stands in for the real consent screen while you develop. Set{' '}
            <span className="mono">GOOGLE_CLIENT_ID</span> and{' '}
            <span className="mono">GOOGLE_CLIENT_SECRET</span> and this page disappears.
          </span>
        </div>

        <form action="/api/auth/google/callback" method="post" className="stack" style={{ gap: 14 }}>
          <input type="hidden" name="state" value={state} />

          <div className="field">
            <label className="label" htmlFor="gp-email">Which e-mail should the account use?</label>
            <input
              id="gp-email"
              name="email"
              type="email"
              className="input"
              required
              autoFocus
              placeholder="anna.holm@company.com"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="gp-name">Display name</label>
            <input id="gp-name" name="name" className="input" placeholder="Anna Holm" />
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            Continue as this account
          </button>
        </form>
      </div>
    </div>
  );
}
