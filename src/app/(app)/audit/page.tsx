import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/server/permissions';
import { recentAuditEvents } from '@/lib/server/audit';
import { Avatar, Badge, Card, PageHeader, formatDateTime } from '@/components/ui';

export const metadata: Metadata = { title: 'Audit trail' };
export const dynamic = 'force-dynamic';

/** Actions that deserve to stand out when someone scans the list. */
const NOTABLE = new Set([
  'task.assigned_override_unqualified',
  'consent.updated',
  'folder.policy_changed',
  'account.created',
]);

export default async function AuditPage() {
  await requireAdmin('/audit');
  const events = await recentAuditEvents(150);

  return (
    <>
      <PageHeader
        title="Audit trail"
        lede="Append-only. Every consequential action, including the ones where a person overrode the system."
      />

      <Card padded={false}>
        {events.length === 0 ? (
          <div className="empty">Nothing recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 210 }}>Action</th>
                  <th style={{ width: 190 }}>Who</th>
                  <th style={{ width: 160 }}>Entity</th>
                  <th>Detail</th>
                  <th style={{ width: 190 }}>When</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Badge tone={NOTABLE.has(event.action) ? 'warn' : 'neutral'}>
                        {event.action}
                      </Badge>
                    </td>
                    <td>
                      {event.actor ? (
                        <span className="row" style={{ gap: 8 }}>
                          <Avatar name={event.actor.fullName} colour={event.actor.avatarColor} />
                          <span className="small">{event.actor.fullName}</span>
                        </span>
                      ) : (
                        <span className="subtle small">system</span>
                      )}
                    </td>
                    <td className="tiny subtle mono">
                      {event.entity}
                      <div>{event.entityId.slice(0, 10)}…</div>
                    </td>
                    <td>
                      <code className="tiny muted" style={{ wordBreak: 'break-word' }}>
                        {event.dataJson === '{}' ? '—' : event.dataJson.slice(0, 240)}
                      </code>
                    </td>
                    <td className="tiny subtle">{formatDateTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
