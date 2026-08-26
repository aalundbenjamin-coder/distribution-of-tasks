import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/SignInForm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Sign in' };

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'The Google sign-in was cancelled.',
  google_state: 'That sign-in link had expired or did not come from here. Try again.',
  google_code: 'Google did not return an authorisation code. Try again.',
  google_email: 'That account has no usable e-mail address.',
  google_account: 'We could not use that Google account to sign in.',
  google_unconfigured:
    'Google sign-in is not set up on this deployment yet. An administrator needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Until then, use an e-mail address or a phone number.',
  google_exchange:
    'Google would not complete the sign-in. If this deployment was just set up, check that the authorised redirect URI registered with Google matches this site exactly.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signedout?: string }>;
}) {
  if (await getCurrentUser()) redirect('/dashboard');
  const params = await searchParams;
  const { t } = await getTranslations();
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard';

  return (
    <div className="shell-narrow" style={{ maxWidth: 460 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">{t.auth.signInTitle}</h1>
        <p className="page-lede">{t.auth.signInLede}</p>
      </div>

      {params.signedout && (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          {t.auth.signedOut}
        </div>
      )}

      {params.error && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }} role="alert">
          {ERROR_MESSAGES[params.error] ?? 'Something went wrong with that sign-in. Try again.'}
        </div>
      )}

      <div className="card card-pad">
        <SignInForm next={next} t={t} />
      </div>
    </div>
  );
}
