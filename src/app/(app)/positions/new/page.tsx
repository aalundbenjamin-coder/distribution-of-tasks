import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import PositionForm from '@/components/PositionForm';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'New position' };
export const dynamic = 'force-dynamic';

export default async function NewPositionPage() {
  await requireDistributor('/positions/new');
  const skills = await prisma.skill.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="shell-narrow" style={{ padding: 0, maxWidth: 860 }}>
      <PageHeader
        eyebrow="Positions"
        title="Create a position"
        lede="Describe the role once and the capability baseline comes with it everywhere the position is used."
      />
      <PositionForm
        skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.category, kind: s.kind }))}
      />
    </div>
  );
}
