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
import {
  Badge,
  Card,
  PageHeader,
} from '@/components/ui';
import {
  LocalDateTime,
} from '@/components/ui-labels';
import type { ConsentType } from '@/lib/domain/enums';
import { getTranslations } from '@/lib/i18n';
import { emailTransportKind, smsTransportKind } from '@/lib/notifications/transports';
import { AlertIcon, GoogleIcon, MailIcon, PhoneIcon, ShieldIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser('/settings');
  const { t } = await getTranslations();

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
        title={t.settings.title}
        lede={t.settings.lede}
      />

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          {!termsCurrent && (
            <Card title={t.settings.termsChanged}>
              <div className="notice notice-warn" style={{ marginBottom: 14 }}>
                <AlertIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
                <span>
                  {t.settings.termsChangedBody}{' '}
                  <Link href="/legal/terms" target="_blank" style={{ textDecoration: 'underline' }}>
                    {t.consent.TERMS_OF_SERVICE.toLowerCase()}
                  </Link>{' '}
                  {t.settings.and}{' '}
                  <Link href="/legal/privacy" target="_blank" style={{ textDecoration: 'underline' }}>
                    {t.consent.PRIVACY_POLICY.toLowerCase()}
                  </Link>
                  .
                </span>
              </div>
              <ReacceptTermsForm labels={{ accept: t.settings.acceptCurrent, recording: t.settings.recording }} />
            </Card>
          )}

          <Card
            title={t.settings.notificationsTitle}
            subtitle={t.settings.notificationsSub}
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
              t={t}
            />
          </Card>

          <Card
            title={t.settings.consentHistory}
            subtitle={t.settings.consentHistorySub}
            padded={false}
          >
            {history.length === 0 ? (
              <div className="empty">{t.settings.noConsent}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.settings.colWhat}</th>
                      <th style={{ width: 110 }}>{t.settings.colDecision}</th>
                      <th style={{ width: 120 }}>{t.settings.colWhere}</th>
                      <th style={{ width: 190 }}>{t.dash.colWhen}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td className="small">
                          {t.consent[row.type as ConsentType] ?? row.type}
                          {row.documentVersion && (
                            <span className="tiny subtle"> · v{row.documentVersion}</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={row.granted ? 'ok' : 'neutral'}>
                            {row.granted ? t.settings.agreed : t.settings.declined}
                          </Badge>
                        </td>
                        <td className="tiny subtle">{row.source.toLowerCase()}</td>
                        <td className="tiny subtle">{<LocalDateTime value={row.createdAt} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card title={t.settings.yourAccount}>
            <dl className="stack" style={{ gap: 12, margin: 0 }}>
              <Row label={t.settings.name} value={user.fullName} />
              <Row
                label={t.auth.email}
                value={
                  user.email ? (
                    <span className="row" style={{ gap: 7 }}>
                      {user.email}
                      {user.emailVerified ? (
                        <Badge tone="ok">{t.common.verified}</Badge>
                      ) : (
                        <Badge tone="warn">{t.settings.unverified}</Badge>
                      )}
                    </span>
                  ) : (
                    <span className="subtle">{t.settings.notSet}</span>
                  )
                }
              />
              <Row
                label={t.settings.phoneNumber}
                value={
                  user.phone ? (
                    <span className="row" style={{ gap: 7 }}>
                      {user.phone}
                      {user.phoneVerified ? (
                        <Badge tone="ok">{t.common.verified}</Badge>
                      ) : (
                        <Badge tone="warn">{t.settings.unverified}</Badge>
                      )}
                    </span>
                  ) : (
                    <span className="subtle">{t.settings.notSet}</span>
                  )
                }
              />
              <Row label={t.settings.role} value={t.roles[user.role]} />
              <Row label={t.settings.activeSessions} value={String(sessions)} />
            </dl>
          </Card>

          <Card title={t.settings.howYouSignIn} subtitle={t.settings.howYouSignInSub}>
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
                    {identity.provider === 'GOOGLE'
                      ? t.auth.methodGoogle
                      : identity.provider === 'PHONE'
                        ? t.auth.methodPhone
                        : t.auth.methodEmail}
                  </span>
                  <span className="tiny subtle">{identity.label}</span>
                </div>
              ))}
            </div>

            {!user.phone && (
              <div id="link-phone" style={{ scrollMarginTop: 80 }}>
              <PhoneLinkForm
                labels={{
                  phoneNumber: t.settings.phoneNumber,
                  hint: t.settings.linkPhoneHint,
                  send: t.settings.sendVerification,
                  sending: t.common.sending,
                  code: t.auth.codeLabel,
                  verify: t.settings.verifyNumber,
                  checking: t.common.checking,
                  devMode: t.auth.devMode,
                  devBody: t.auth.devModeBody,
                }}
              />
              </div>
            )}
          </Card>

          <Card title={t.settings.delivery}>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 9, justifyContent: 'space-between' }}>
                <span className="small row" style={{ gap: 7 }}>
                  <MailIcon size={15} /> {t.auth.email}
                </span>
                <Badge tone={emailTransport === 'LOCAL' ? 'warn' : 'ok'}>
                  {emailTransport === 'LOCAL' ? t.settings.simulated : emailTransport}
                </Badge>
              </div>
              <div className="row" style={{ gap: 9, justifyContent: 'space-between' }}>
                <span className="small row" style={{ gap: 7 }}>
                  <PhoneIcon size={15} /> SMS
                </span>
                <Badge tone={smsTransport === 'LOCAL' ? 'warn' : 'ok'}>
                  {smsTransport === 'LOCAL' ? t.settings.simulated : smsTransport}
                </Badge>
              </div>
              {(emailTransport === 'LOCAL' || smsTransport === 'LOCAL') && (
                <p className="tiny muted">
                  {t.settings.simulatedNote}
                </p>
              )}
            </div>
          </Card>

          <Card title={t.settings.documents}>
            <div className="stack" style={{ gap: 9 }}>
              <Link href="/legal/terms" className="row small" style={{ gap: 8 }}>
                <ShieldIcon size={15} /> {t.consent.TERMS_OF_SERVICE}
                <span className="tiny subtle">v{TERMS_VERSION}</span>
              </Link>
              <Link href="/legal/privacy" className="row small" style={{ gap: 8 }}>
                <ShieldIcon size={15} /> {t.consent.PRIVACY_POLICY}
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
