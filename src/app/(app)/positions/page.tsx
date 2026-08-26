import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { Badge, Card, PageHeader } from '@/components/ui';
import { LevelPips } from '@/components/ui-labels';
import { BadgeIcon, PlusIcon, ShieldIcon } from '@/components/icons';
import { fill, getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Positions' };
export const dynamic = 'force-dynamic';

export default async function PositionsPage() {
  await requireDistributor('/positions');
  const { t } = await getTranslations();

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
        title={t.positions.title}
        lede={t.positions.lede}
        action={
          <Link href="/positions/new" className="btn btn-primary">
            <PlusIcon size={16} /> {t.positions.newPosition}
          </Link>
        }
      />

      {positions.length === 0 ? (
        <Card>
          <div className="empty">
            <BadgeIcon size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div>{t.positions.noneYet}</div>
            <Link href="/positions/new" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
              {t.positions.createFirst}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {positions.map((position) => (
            <Card
              key={position.id}
              title={position.title}
              subtitle={`${position.department} · ${t.positions.seniority} ${position.seniority} · ${fill(t.positions.holders, { n: position._count.coworkers })}`}
              action={
                <Link href={`/coworkers?position=${position.id}`} className="btn btn-sm btn-ghost">
                  {t.coworkers.whoHoldsIt}
                </Link>
              }
            >
              {position.description && (
                <p className="small muted" style={{ marginBottom: 14 }}>{position.description}</p>
              )}

              {position.requirements.length === 0 ? (
                <p className="small subtle">{t.positions.noBaseline}</p>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="eyebrow">{t.positions.expectedCapabilities}</div>
                  {position.requirements.map((req) => (
                    <div
                      key={req.id}
                      className="row"
                      style={{ gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}
                    >
                      <span className="row" style={{ gap: 9 }}>
                        <span className="small" style={{ fontWeight: 540 }}>{req.skill.name}</span>
                        {req.skill.kind === 'CERTIFICATION' && (
                          <Badge tone="info"><ShieldIcon size={11} /> {t.skillKind.CERTIFICATION}</Badge>
                        )}
                        {req.necessity === 'PREFERRED' && <Badge>{t.necessity.PREFERRED}</Badge>}
                      </span>
                      {req.skill.kind === 'CERTIFICATION' ? (
                        <span className="tiny muted">{t.positions.mustHoldIt}</span>
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
