import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/server/permissions';
import { getConsentState } from '@/lib/auth/consent';
import { getTranslations } from '@/lib/i18n';
import { formatDateTimeIn } from '@/lib/i18n/locale';
import {
  Badge,
  Card,
  PageHeader,
} from '@/components/ui';
import {
  LocalDateTime,
  RelativeTime,
} from '@/components/ui-labels';
import { BellIcon, MailIcon, PhoneIcon, SparkIcon } from '@/components/icons';
import type { DeliveryStatus } from '@/lib/domain/enums';
import { fill } from '@/lib/i18n';
import { MarkAllReadButton } from '@/components/NotificationActions';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser('/notifications');
  const { locale, t } = await getTranslations();

  const [notifications, unread, consent] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    getConsentState(user.id),
  ]);

  const externalOff =
    !consent.OPERATIONAL_EMAIL &&
    !consent.OPERATIONAL_SMS &&
    !consent.MARKETING_EMAIL &&
    !consent.MARKETING_SMS;

  return (
    <>
      <PageHeader
        title={t.notifications.title}
        lede={t.notifications.lede}
        action={
          unread > 0 ? (
            <MarkAllReadButton labels={{ mark: t.notifications.markAllRead, marking: t.notifications.marking }} />
          ) : undefined
        }
      />

      {externalOff && (
        <div className="notice notice-accent" style={{ marginBottom: 20 }}>
          <BellIcon size={18} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            <strong>{t.notifications.externalOffTitle}</strong> {t.notifications.externalOffBody}{' '}
            <Link href="/settings" style={{ textDecoration: 'underline' }}>
              {t.notifications.changeUnder}
            </Link>{' '}
            {t.notifications.whenYouLike}
          </span>
        </div>
      )}

      <Card padded={false}>
        {notifications.length === 0 ? (
          <div className="empty">{t.common.nothingYet}</div>
        ) : (
          <div>
            {notifications.map((n) => (
              <article
                key={n.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${n.readAt ? 'transparent' : 'var(--accent)'}`,
                  background: n.readAt ? undefined : 'var(--accent-soft)',
                }}
              >
                <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5 }}>{n.title}</strong>
                      {n.category === 'MARKETING' && (
                        <Badge tone="accent"><SparkIcon size={11} /> {t.notifications.productNews}</Badge>
                      )}
                      {!n.readAt && <Badge tone="info">{t.notifications.isNew}</Badge>}
                    </div>
                    <p className="small muted" style={{ marginTop: 4 }}>{n.body}</p>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="tiny"
                        style={{ color: 'var(--accent)', fontWeight: 560, display: 'inline-block', marginTop: 6 }}
                      >
                        {t.notifications.openArrow}
                      </Link>
                    )}
                  </div>

                  <div className="stack" style={{ gap: 5, alignItems: 'flex-end' }}>
                    <span className="tiny subtle" title={formatDateTimeIn(locale, n.createdAt)}>
                      {<RelativeTime value={n.createdAt} />}
                    </span>
                    <div className="row" style={{ gap: 6 }}>
                      <DeliveryChip icon={<MailIcon size={11} />} status={n.emailStatus} labels={t.delivery} />
                      <DeliveryChip icon={<PhoneIcon size={11} />} status={n.smsStatus} labels={t.delivery} />
                    </div>
                  </div>
                </div>

                {n.deliveryNote && (
                  <p className="tiny subtle" style={{ marginTop: 7 }}>{n.deliveryNote}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function DeliveryChip({
  icon,
  status,
  labels,
}: {
  icon: React.ReactNode;
  status: string;
  labels: Record<string, string>;
}) {
  if (status === 'NOT_APPLICABLE') return null;
  const label = labels[status as DeliveryStatus] ?? status;
  const tone =
    status === 'SENT' ? 'ok' : status === 'FAILED' ? 'danger' : status === 'QUEUED' ? 'info' : 'neutral';
  return (
    <Badge tone={tone}>
      {icon} {label}
    </Badge>
  );
}
