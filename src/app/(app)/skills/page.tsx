import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import SkillForm from '@/components/SkillForm';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ShieldIcon } from '@/components/icons';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Capabilities' };
export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  await requireDistributor('/skills');
  const { t } = await getTranslations();

  const skills = await prisma.skill.findMany({
    where: { archivedAt: null },
    include: {
      _count: { select: { coworkerSkills: true, taskRequirements: true } },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const byCategory = new Map<string, typeof skills>();
  for (const skill of skills) {
    const list = byCategory.get(skill.category) ?? [];
    list.push(skill);
    byCategory.set(skill.category, list);
  }

  return (
    <>
      <PageHeader
        title={t.skills.title}
        lede={t.skills.lede}
      />

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          {skills.length === 0 ? (
            <Card>
              <div className="empty">
                {t.skills.empty}
              </div>
            </Card>
          ) : (
            [...byCategory.entries()].map(([category, items]) => (
              <Card key={category} title={category} padded={false}>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t.skills.colCapability}</th>
                        <th style={{ width: 150 }}>{t.skills.colKind}</th>
                        <th style={{ width: 110 }}>{t.skills.colHeldBy}</th>
                        <th style={{ width: 110 }}>{t.skills.colAskedFor}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((skill) => (
                        <tr key={skill.id}>
                          <td>
                            <div style={{ fontWeight: 560 }}>{skill.name}</div>
                            {skill.description && (
                              <div className="tiny muted" style={{ marginTop: 2 }}>
                                {skill.description}
                              </div>
                            )}
                          </td>
                          <td>
                            {skill.kind === 'CERTIFICATION' ? (
                              <Badge tone="info">
                                <ShieldIcon size={11} /> {skill.expires ? t.skills.expires : t.skillKind.CERTIFICATION}
                              </Badge>
                            ) : (
                              <Badge>{t.skillKind.GRADED}</Badge>
                            )}
                          </td>
                          <td className="small muted num">{skill._count.coworkerSkills}</td>
                          <td className="small muted num">{skill._count.taskRequirements}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card title={t.skills.addCapability}>
            <SkillForm t={t} />
          </Card>

          <Card title={t.skills.whatLevelsMean}>
            <dl className="stack" style={{ gap: 9, margin: 0 }}>
              {[5, 4, 3, 2, 1, 0].map((level) => (
                <div key={level} className="row" style={{ gap: 10 }}>
                  <span
                    className="num"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: 'var(--bg-sunken)',
                      border: '1px solid var(--border)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 660,
                      flex: 'none',
                    }}
                  >
                    {level}
                  </span>
                  <span className="small">{t.levels[level as 0|1|2|3|4|5]}</span>
                </div>
              ))}
            </dl>
            <p className="tiny muted" style={{ marginTop: 12 }}>
              {t.skills.levelsNote}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
