import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/SignInForm';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'The Google sign-in was cancelled.',
  google_state: 'That sign-in link had expired or did not come from here. Try again.',
  google_code: 'Google did not return an authorisation code. Try again.',
  google_exchange: 'We could not complete the exchange with Google. Try again in a moment.',
  google_email: 'That account has no usable e-mail address.',
  google_account: 'We could not use that Google account to sign in.',
  google_unconfigured: 'Google sign-in is not configured on this deployment.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signedout?: string }>;
}) {
  if (await getCurrentUser()) redirect('/dashboard');
  const params = await searchParams;
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard';

  return (
    <div className="shell-narrow" style={{ maxWidth: 460 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Sign in</h1>
        <p className="page-lede">Use whichever method you signed up with.</p>
      </div>

      {params.signedout && (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          You are signed out.
        </div>
      )}

      {params.error && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }} role="alert">
          {ERROR_MESSAGES[params.error] ?? 'Something went wrong with that sign-in. Try again.'}
        </div>
      )}

      <div className="card card-pad">
        <SignInForm next={next} />
      </div>
    </div>
  );
}
