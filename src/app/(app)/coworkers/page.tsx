import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums';
import {
  AvailabilityBadge,
  Avatar,
  Badge,
  Card,
  PageHeader,
  ScoreBar,
} from '@/components/ui';
import { ShieldIcon } from '@/components/icons';
import { CreateCoworkerForm } from '@/components/CreateCoworkerForm';

export const metadata: Metadata = { title: 'Coworkers' };
export const dynamic = 'force-dynamic';

export default async function CoworkersPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string }>;
}) {
  await requireDistributor('/coworkers');
  const { position } = await searchParams;

  const [coworkers, positions, unprofiled] = await Promise.all([
    prisma.coworker.findMany({
      where: position ? { positionId: position } : {},
      include: {
        user: { select: { fullName: true, avatarColor: true, email: true, status: true } },
        position: { select: { id: true, title: true } },
        skills: { include: { skill: { select: { name: true, kind: true } } } },
        assignments: {
          where: { status: { in: ['ACTIVE', 'PROPOSED'] } },
          include: { task: { select: { estimatedHours: true, status: true } } },
        },
      },
      orderBy: [{ department: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.position.findMany({ where: { archivedAt: null }, orderBy: { title: 'asc' } }),
    prisma.user.findMany({
      where: { coworker: null, status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true, phone: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Coworkers"
        lede="Every profile here is a specification: what this person can do, to what level, how much they can take on, and when. This is what distribution reads."
      />

      {unprofiled.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Card
            title={`${unprofiled.length} account${unprofiled.length === 1 ? '' : 's'} not in the pool yet`}
            subtitle="They have signed up but cannot receive work until they have a work profile."
          >
            <CreateCoworkerForm
              users={unprofiled.map((u) => ({
                id: u.id,
                label: `${u.fullName}${u.email ? ` · ${u.email}` : u.phone ? ` · ${u.phone}` : ''}`,
              }))}
              positions={positions.map((p) => ({ id: p.id, title: p.title }))}
            />
          </Card>
        </div>
      )}

      <div className="row" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href="/coworkers" className="badge" style={!position ? activeChip : undefined}>
          All positions
        </Link>
        {positions.map((p) => (
          <Link
            key={p.id}
            href={`/coworkers?position=${p.id}`}
            className="badge"
            style={position === p.id ? activeChip : undefined}
          >
            {p.title}
          </Link>
        ))}
      </div>

      <Card padded={false}>
        {coworkers.length === 0 ? (
          <div className="empty">No coworkers match this filter.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Coworker</th>
                  <th style={{ width: 180 }}>Position</th>
                  <th style={{ width: 150 }}>Availability</th>
                  <th style={{ width: 170 }}>This week</th>
                  <th>Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {coworkers.map((coworker) => {
                  const open = coworker.assignments.filter((a) =>
                    (OPEN_TASK_STATUSES as readonly string[]).includes(a.task.status),
                  );
                  const committed = open.reduce((sum, a) => sum + a.task.estimatedHours, 0);
                  const load = coworker.weeklyCapacityHours > 0 ? committed / coworker.weeklyCapacityHours : 1;
                  const verified = coworker.skills.filter((s) => s.verified).length;

                  return (
                    <tr key={coworker.id}>
                      <td>
                        <Link href={`/coworkers/${coworker.id}`} className="row" style={{ gap: 10 }}>
                          <Avatar name={coworker.user.fullName} colour={coworker.user.avatarColor} />
                          <span>
                            <span style={{ display: 'block', fontWeight: 600 }}>
                              {coworker.user.fullName}
                            </span>
                            <span className="tiny subtle">{coworker.department}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="small muted">
                        {coworker.position?.title ?? <span className="subtle">—</span>}
                      </td>
                      <td><AvailabilityBadge availability={coworker.availability} /></td>
                      <td>
                        <ScoreBar score={Math.min(1, load)} tone={load >= 1 ? 'warn' : 'ok'} />
                        <div className="tiny subtle num" style={{ marginTop: 3 }}>
                          {Math.round(committed)}/{Math.round(coworker.weeklyCapacityHours)} h ·{' '}
                          {open.length} task{open.length === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                          {coworker.skills.slice(0, 4).map((s) => (
                            <Badge key={s.id} tone={s.verified ? 'ok' : 'neutral'}>
                              {s.verified && <ShieldIcon size={10} />}
                              {s.skill.name}
                              {s.skill.kind === 'GRADED' ? ` ${s.level}` : ''}
                            </Badge>
                          ))}
                          {coworker.skills.length > 4 && (
                            <span className="tiny subtle">+{coworker.skills.length - 4} more</span>
                          )}
                          {coworker.skills.length === 0 && (
                            <span className="tiny subtle">None recorded — cannot be matched</span>
                          )}
                        </div>
                        {verified > 0 && (
                          <div className="tiny subtle" style={{ marginTop: 4 }}>
                            {verified} verified by a lead
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

const activeChip = {
  background: 'var(--accent-soft)',
  borderColor: 'var(--accent-border)',
  color: 'var(--accent)',
} as const;
