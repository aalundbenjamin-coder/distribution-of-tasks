import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import TaskForm from '@/components/TaskForm';
import { PageHeader } from '@/components/ui';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'New task' };
export const dynamic = 'force-dynamic';

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  await requireDistributor('/tasks/new');
  const { folder } = await searchParams;
  const { t } = await getTranslations();

  const [folders, positions, skills] = await Promise.all([
    prisma.taskFolder.findMany({
      where: { archivedAt: null },
      include: { defaultPosition: { select: { title: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.position.findMany({ where: { archivedAt: null }, orderBy: { title: 'asc' } }),
    prisma.skill.findMany({ where: { archivedAt: null }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="shell-narrow" style={{ padding: 0, maxWidth: 900 }}>
      <PageHeader
        eyebrow={t.tasks.newEyebrow}
        title={t.tasks.newTitle}
        lede={t.tasks.newLede}
      />
      <TaskForm
        defaultFolderId={folder}
        folders={folders.map((f) => ({
          id: f.id,
          name: f.name,
          department: f.department,
          routingMode: f.routingMode,
          defaultPositionTitle: f.defaultPosition?.title ?? null,
        }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title, department: p.department }))}
        skills={skills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          kind: s.kind,
        }))}
        t={t}
      />
    </div>
  );
}
