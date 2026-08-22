import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/server/permissions';
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  getConsentHistory,
  getConsentState,
} from '@/lib/auth/consent';
import { ConsentForm, PhoneLinkForm, ReacceptTermsForm } from '@/components/SettingsForms';
import { Badge, Card, PageHeader, formatDateTime } from '@/components/ui';
import { AUTH_PROVIDER_LABELS, CONSENT_LABELS, USER_ROLE_LABELS, type AuthProvider, type ConsentType } from '@/lib/domain/enums';
import { emailTransportKind, smsTransportKind } from '@/lib/notifications/transports';
import { AlertIcon, GoogleIcon, MailIcon, PhoneIcon, ShieldIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser('/settings');

  const [consent, history, identities, sessions] = await Promise.all([
    getConsentState(user.id),
    getConsentHistory(user.id),
    prisma.authIdentity.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.session.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);

  const termsCurrent = consent.TERMS_OF_SERVICE && consent.PRIVACY_POLICY;
  const emailTransport = emailTransportKind();
  const smsTransport = smsTransportKind();

  return (
    <>
      <PageHeader
        title="Settings"
        lede="Your account, what you have agreed to, and where notifications go."
      />

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          {!termsCurrent && (
            <Card title="The terms have changed">
              <div className="notice notice-warn" style={{ marginBottom: 14 }}>
                <AlertIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
                <span>
                  Your acceptance on file is for an older version. Your previous agreement is not
                  carried over automatically — please read the current{' '}
                  <Link href="/legal/terms" target="_blank" style={{ textDecoration: 'underline' }}>
                    terms of service
                  </Link>{' '}
                  and{' '}
                  <Link href="/legal/privacy" target="_blank" style={{ textDecoration: 'underline' }}>
                    privacy policy
                  </Link>
                  .
                </span>
              </div>
              <ReacceptTermsForm />
            </Card>
          )}

          <Card
            title="Notifications"
            subtitle="The bell always works. These decide whether a copy also goes to your inbox or your phone."
          >
            <ConsentForm
              values={{
                OPERATIONAL_EMAIL: consent.OPERATIONAL_EMAIL,
                OPERATIONAL_SMS: consent.OPERATIONAL_SMS,
                MARKETING_EMAIL: consent.MARKETING_EMAIL,
                MARKETING_SMS: consent.MARKETING_SMS,
              }}
              hasEmail={Boolean(user.email)}
              hasPhone={Boolean(user.phone)}
              emailVerified={user.emailVerified}
              phoneVerified={user.phoneVerified}
            />
          </Card>

          <Card
            title="Consent history"
            subtitle="Every decision you have made, kept so we can always show what applied on a given day."
            padded={false}
          >
            {history.length === 0 ? (
              <div className="empty">No consent decisions recorded.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>What</th>
                      <th style={{ width: 110 }}>Decision</th>
                      <th style={{ width: 120 }}>Where</th>
                      <th style={{ width: 190 }}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td className="small">
                          {CONSENT_LABELS[row.type as ConsentType] ?? row.type}
                          {row.documentVersion && (
                            <span className="tiny subtle"> · v{row.documentVersion}</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={row.granted ? 'ok' : 'neutral'}>
                            {row.granted ? 'Agreed' : 'Declined'}
                          </Badge>
                        </td>
                        <td className="tiny subtle">{row.source.toLowerCase()}</td>
                        <td className="tiny subtle">{formatDateTime(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card title="Your account">
            <dl className="stack" style={{ gap: 12, margin: 0 }}>
              <Row label="Name" value={user.fullName} />
              <Row
                label="E-mail"
                value={
                  user.email ? (
                    <span className="row" style={{ gap: 7 }}>
                      {user.email}
                      {user.emailVerified ? (
                        <Badge tone="ok">Verified</Badge>
                      ) : (
                        <Badge tone="warn">Unverified</Badge>
                      )}
                    </span>
                  ) : (
                    <span className="subtle">Not set</span>
                  )
                }
              />
              <Row
                label="Phone"
                value={
                  user.phone ? (
                    <span className="row" style={{ gap: 7 }}>
                      {user.phone}
                      {user.phoneVerified ? (
                        <Badge tone="ok">Verified</Badge>
                      ) : (
                        <Badge tone="warn">Unverified</Badge>
                      )}
                    </span>
                  ) : (
                    <span className="subtle">Not set</span>
                  )
                }
              />
              <Row label="Role" value={USER_ROLE_LABELS[user.role]} />
              <Row label="Active sessions" value={String(sessions)} />
            </dl>
          </Card>

          <Card title="How you sign in" subtitle="Add a second method and both work.">
            <div className="stack" style={{ gap: 9, marginBottom: 16 }}>
              {identities.map((identity) => (
                <div key={identity.id} className="row" style={{ gap: 9 }}>
                  <span style={{ display: 'flex', color: 'var(--text-subtle)' }}>
                    {identity.provider === 'GOOGLE' ? (
                      <GoogleIcon size={16} />
                    ) : identity.provider === 'PHONE' ? (
                      <PhoneIcon size={16} />
                    ) : (
                      <MailIcon size={16} />
                    )}
                  </span>
                  <span className="small" style={{ flex: 1 }}>
                    {AUTH_PROVIDER_LABELS[identity.provider as AuthProvider] ?? identity.provider}
                  </span>
                  <span className="tiny subtle">{identity.label}</span>
                </div>
              ))}
            </div>

            {!user.phone && <PhoneLinkForm />}
          </Card>

          <Card title="Delivery on this deployment">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 9, justifyContent: 'space-between' }}>
                <span className="small row" style={{ gap: 7 }}>
                  <MailIcon size={15} /> E-mail
                </span>
                <Badge tone={emailTransport === 'LOCAL' ? 'warn' : 'ok'}>
                  {emailTransport === 'LOCAL' ? 'Simulated' : emailTransport}
                </Badge>
              </div>
              <div className="row" style={{ gap: 9, justifyContent: 'space-between' }}>
                <span className="small row" style={{ gap: 7 }}>
                  <PhoneIcon size={15} /> SMS
                </span>
                <Badge tone={smsTransport === 'LOCAL' ? 'warn' : 'ok'}>
                  {smsTransport === 'LOCAL' ? 'Simulated' : smsTransport}
                </Badge>
              </div>
              {(emailTransport === 'LOCAL' || smsTransport === 'LOCAL') && (
                <p className="tiny muted">
                  No provider is configured for the simulated channels, so messages are logged on the
                  server rather than sent. The bell is unaffected.
                </p>
              )}
            </div>
          </Card>

          <Card title="Documents">
            <div className="stack" style={{ gap: 9 }}>
              <Link href="/legal/terms" className="row small" style={{ gap: 8 }}>
                <ShieldIcon size={15} /> Terms of service
                <span className="tiny subtle">v{TERMS_VERSION}</span>
              </Link>
              <Link href="/legal/privacy" className="row small" style={{ gap: 8 }}>
                <ShieldIcon size={15} /> Privacy policy
                <span className="tiny subtle">v{PRIVACY_VERSION}</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="small" style={{ margin: '3px 0 0' }}>{value}</dd>
    </div>
  );
}
