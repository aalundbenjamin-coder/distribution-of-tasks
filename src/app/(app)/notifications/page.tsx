import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/server/permissions';
import { getConsentState } from '@/lib/auth/consent';
import { Badge, Card, PageHeader, formatDateTime, relativeTime } from '@/components/ui';
import { BellIcon, MailIcon, PhoneIcon, SparkIcon } from '@/components/icons';
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from '@/lib/domain/enums';
import { MarkAllReadButton } from '@/components/NotificationActions';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser('/notifications');

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
        title="Notifications"
        lede="Everything the system has told you, whether or not a copy also went to your inbox or your phone."
        action={unread > 0 ? <MarkAllReadButton /> : undefined}
      />

      {externalOff && (
        <div className="notice notice-accent" style={{ marginBottom: 20 }}>
          <BellIcon size={18} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            <strong>You have not switched on e-mail or SMS, and that is fine.</strong> This page and
            the bell in the top-right corner carry everything — assignments, decisions waiting on
            you, and new features.{' '}
            <Link href="/settings" style={{ textDecoration: 'underline' }}>
              Change it under Settings
            </Link>{' '}
            whenever you like.
          </span>
        </div>
      )}

      <Card padded={false}>
        {notifications.length === 0 ? (
          <div className="empty">Nothing yet.</div>
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
                        <Badge tone="accent"><SparkIcon size={11} /> Product news</Badge>
                      )}
                      {!n.readAt && <Badge tone="info">New</Badge>}
                    </div>
                    <p className="small muted" style={{ marginTop: 4 }}>{n.body}</p>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="tiny"
                        style={{ color: 'var(--accent)', fontWeight: 560, display: 'inline-block', marginTop: 6 }}
                      >
                        Open →
                      </Link>
                    )}
                  </div>

                  <div className="stack" style={{ gap: 5, alignItems: 'flex-end' }}>
                    <span className="tiny subtle" title={formatDateTime(n.createdAt)}>
                      {relativeTime(n.createdAt)}
                    </span>
                    <div className="row" style={{ gap: 6 }}>
                      <DeliveryChip icon={<MailIcon size={11} />} status={n.emailStatus} />
                      <DeliveryChip icon={<PhoneIcon size={11} />} status={n.smsStatus} />
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

function DeliveryChip({ icon, status }: { icon: React.ReactNode; status: string }) {
  if (status === 'NOT_APPLICABLE') return null;
  const label = DELIVERY_STATUS_LABELS[status as DeliveryStatus] ?? status;
  const tone =
    status === 'SENT' ? 'ok' : status === 'FAILED' ? 'danger' : status === 'QUEUED' ? 'info' : 'neutral';
  return (
    <Badge tone={tone}>
      {icon} {label}
    </Badge>
  );
}
