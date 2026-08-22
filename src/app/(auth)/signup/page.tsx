import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignUpForm from '@/components/SignUpForm';
import { getCurrentUser } from '@/lib/auth/session';
import { isGoogleConfigured } from '@/lib/auth/google';
import { ShieldIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; error?: string; next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/dashboard');
  const params = await searchParams;

  const method =
    params.method === 'google' ? 'google' : params.method === 'phone' ? 'phone' : 'email';
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard';

  return (
    <div className="shell-narrow" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Create your account</h1>
        <p className="page-lede">
          One account, three ways in. Whichever you pick, you decide separately what we may send you
          and where.
        </p>
      </div>

      <div className="card card-pad">
        <SignUpForm
          initialMethod={method}
          initialError={params.error}
          next={next}
          googleConfigured={isGoogleConfigured()}
        />
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <ShieldIcon size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-subtle)' }} />
        <span className="tiny muted">
          Passwords are stored as salted scrypt hashes and one-time codes only as digests — neither
          can be read back, by us or by anyone who obtains the database. Every consent decision is
          recorded with the version of the document you were shown.
        </span>
      </div>
    </div>
  );
}
