import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/SignInForm';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { signInErrorMessage } from '@/lib/auth/sign-in-errors';

export const metadata: Metadata = { title: 'Sign in' };


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
          {signInErrorMessage(t, params.error)}
        </div>
      )}

      <div className="card card-pad">
        <SignInForm next={next} t={t} />
      </div>
    </div>
  );
}
