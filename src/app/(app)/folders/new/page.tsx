import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { NewFolderForm } from '@/components/FolderForm';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'New folder' };
export const dynamic = 'force-dynamic';

export default async function NewFolderPage() {
  await requireDistributor('/folders/new');
  const positions = await prisma.position.findMany({
    where: { archivedAt: null },
    orderBy: { title: 'asc' },
    select: { id: true, title: true },
  });

  return (
    <div className="shell-narrow" style={{ padding: 0, maxWidth: 820 }}>
      <PageHeader
        eyebrow="Folders"
        title="New distribution folder"
        lede="Set the routing rules once. Every task dropped in here follows them."
      />
      <NewFolderForm positions={positions} />
    </div>
  );
}
