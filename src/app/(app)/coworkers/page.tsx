import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums';
import {
  Badge,
  Card,
  PageHeader,
  ScoreBar,
} from '@/components/ui';
import Portrait from '@/components/Portrait';
import {
  AvailabilityBadge,
} from '@/components/ui-labels';
import { ShieldIcon } from '@/components/icons';
import { CreateCoworkerForm } from '@/components/CreateCoworkerForm';
import { fill, getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Coworkers' };
export const dynamic = 'force-dynamic';

export default async function CoworkersPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string }>;
}) {
  await requireDistributor('/coworkers');
  const { position } = await searchParams;
  const { t } = await getTranslations();

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
        title={t.coworkers.title}
        lede={t.coworkers.lede}
      />

      {unprofiled.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Card
            title={fill(t.coworkers.notInPool, { n: unprofiled.length })}
            subtitle={t.coworkers.notInPoolSub}
          >
            <CreateCoworkerForm
              users={unprofiled.map((u) => ({
                id: u.id,
                label: `${u.fullName}${u.email ? ` · ${u.email}` : u.phone ? ` · ${u.phone}` : ''}`,
              }))}
              positions={positions.map((p) => ({ id: p.id, title: p.title }))}
              labels={{
                account: t.coworkers.account,
                choose: t.coworkers.choose,
                position: t.coworkers.position,
                noPosition: t.coworkers.noPosition,
                seedsBaseline: t.coworkers.seedsBaseline,
                department: t.coworkers.department,
                fromPosition: t.coworkers.fromPosition,
                weeklyHours: t.coworkers.weeklyHours,
                languages: t.coworkers.languages,
                submit: t.coworkers.addToPool,
                submitting: t.common.saving,
              }}
            />
          </Card>
        </div>
      )}

      <div className="row" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href="/coworkers" className="badge" style={!position ? activeChip : undefined}>
          {t.coworkers.allPositions}
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
          <div className="empty">{t.coworkers.noneMatch}</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t.tasks.colCoworker}</th>
                  <th style={{ width: 180 }}>{t.coworkers.position}</th>
                  <th style={{ width: 150 }}>{t.coworkers.availabilityLabel}</th>
                  <th style={{ width: 170 }}>{t.dash.thisWeek}</th>
                  <th>{t.coworkers.capabilitiesTitle}</th>
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
                          <Portrait seed={coworker.portrait ?? coworker.user.fullName} size={38} />
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
                          {open.length} {t.nav.tasks.toLowerCase()}
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
                            <span className="tiny subtle">+{coworker.skills.length - 4} {t.coworkers.moreSuffix}</span>
                          )}
                          {coworker.skills.length === 0 && (
                            <span className="tiny subtle">{t.coworkers.noneRecorded}</span>
                          )}
                        </div>
                        {verified > 0 && (
                          <div className="tiny subtle" style={{ marginTop: 4 }}>
                            {fill(t.coworkers.verifiedByLeadCount, { n: verified })}
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
