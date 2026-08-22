import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { Badge, Card, LevelPips, PageHeader } from '@/components/ui';
import { BadgeIcon, PlusIcon, ShieldIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Positions' };
export const dynamic = 'force-dynamic';

export default async function PositionsPage() {
  await requireDistributor('/positions');

  const positions = await prisma.position.findMany({
    where: { archivedAt: null },
    include: {
      requirements: { include: { skill: true } },
      _count: { select: { coworkers: true, tasks: true } },
    },
    orderBy: [{ department: 'asc' }, { title: 'asc' }],
  });

  return (
    <>
      <PageHeader
        title="Positions"
        lede="A position is a named capability baseline. Define one and it can be used to restrict a task, to seed a new coworker's profile, and to set a folder's default."
        action={
          <Link href="/positions/new" className="btn btn-primary">
            <PlusIcon size={16} /> New position
          </Link>
        }
      />

      {positions.length === 0 ? (
        <Card>
          <div className="empty">
            <BadgeIcon size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div>No positions defined yet.</div>
            <Link href="/positions/new" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
              Create the first one
            </Link>
          </div>
        </Card>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {positions.map((position) => (
            <Card
              key={position.id}
              title={position.title}
              subtitle={`${position.department} · seniority ${position.seniority} · ${position._count.coworkers} coworker${position._count.coworkers === 1 ? '' : 's'} hold it`}
              action={
                <Link href={`/coworkers?position=${position.id}`} className="btn btn-sm btn-ghost">
                  Who holds it
                </Link>
              }
            >
              {position.description && (
                <p className="small muted" style={{ marginBottom: 14 }}>{position.description}</p>
              )}

              {position.requirements.length === 0 ? (
                <p className="small subtle">No capability baseline set for this position.</p>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="eyebrow">Expected capabilities</div>
                  {position.requirements.map((req) => (
                    <div
                      key={req.id}
                      className="row"
                      style={{ gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}
                    >
                      <span className="row" style={{ gap: 9 }}>
                        <span className="small" style={{ fontWeight: 540 }}>{req.skill.name}</span>
                        {req.skill.kind === 'CERTIFICATION' && (
                          <Badge tone="info"><ShieldIcon size={11} /> Certification</Badge>
                        )}
                        {req.necessity === 'PREFERRED' && <Badge>Preferred</Badge>}
                      </span>
                      {req.skill.kind === 'CERTIFICATION' ? (
                        <span className="tiny muted">Must hold it</span>
                      ) : (
                        <LevelPips level={req.minLevel} required={req.minLevel} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
