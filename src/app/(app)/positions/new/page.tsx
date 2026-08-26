import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import PositionForm from '@/components/PositionForm';
import { PageHeader } from '@/components/ui';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'New position' };
export const dynamic = 'force-dynamic';

export default async function NewPositionPage() {
  await requireDistributor('/positions/new');
  const { t } = await getTranslations();
  const skills = await prisma.skill.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="shell-narrow" style={{ padding: 0, maxWidth: 860 }}>
      <PageHeader
        eyebrow={t.nav.positions}
        title={t.positions.createTitle}
        lede={t.positions.createLede}
      />
      <PositionForm
        skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.category, kind: s.kind }))}
        t={t}
      />
    </div>
  );
}
