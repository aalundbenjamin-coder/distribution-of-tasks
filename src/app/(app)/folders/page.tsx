import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { Badge, Card, PageHeader } from '@/components/ui';
import { FolderIcon, PlusIcon, ScaleIcon } from '@/components/icons';
import { TIE_BREAK_LABELS, type TieBreak } from '@/lib/domain/enums';

export const metadata: Metadata = { title: 'Folders' };
export const dynamic = 'force-dynamic';

export default async function FoldersPage() {
  await requireDistributor('/folders');

  const folders = await prisma.taskFolder.findMany({
    where: { archivedAt: null },
    include: {
      defaultPosition: { select: { title: true } },
      owner: { select: { fullName: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Distribution folders"
        lede="A folder is where work comes in. Its policy decides how that whole class of work is routed, so you set the rules once instead of deciding task by task."
        action={
          <Link href="/folders/new" className="btn btn-primary">
            <PlusIcon size={16} /> New folder
          </Link>
        }
      />

      {folders.length === 0 ? (
        <Card>
          <div className="empty">
            <FolderIcon size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div>No folders yet.</div>
            <Link href="/folders/new" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
              Create the first one
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
          {folders.map((folder) => {
            const queued = folder.tasks.filter((t) => t.status === 'QUEUED').length;
            const needsReview = folder.tasks.filter(
              (t) => t.status === 'NEEDS_REVIEW' || t.status === 'MATCHED',
            ).length;
            const blocked = folder.tasks.filter((t) => t.status === 'BLOCKED_NO_MATCH').length;

            return (
              <Link key={folder.id} href={`/folders/${folder.id}`} className="card card-pad">
                <div className="row" style={{ gap: 10, marginBottom: 9 }}>
                  <span style={{ color: 'var(--accent)', display: 'flex' }}>
                    <FolderIcon size={19} />
                  </span>
                  <strong style={{ fontSize: 15 }}>{folder.name}</strong>
                </div>

                <p className="small muted" style={{ minHeight: 38 }}>
                  {folder.description ?? 'No description.'}
                </p>

                <div className="row" style={{ gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                  <Badge tone={folder.routingMode === 'AUTO_ASSIGN' ? 'ok' : 'accent'}>
                    {folder.routingMode === 'AUTO_ASSIGN' ? 'Auto-assign' : 'Proposes'}
                  </Badge>
                  {folder.ambiguityPolicy === 'STRICT' && (
                    <Badge tone="info"><ScaleIcon size={11} /> Strict on ties</Badge>
                  )}
                  {folder.defaultPosition && <Badge>{folder.defaultPosition.title}</Badge>}
                </div>

                <div
                  className="row"
                  style={{
                    gap: 18,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <Metric label="Queued" value={queued} />
                  <Metric label="Needs you" value={needsReview} tone={needsReview > 0 ? 'warn' : undefined} />
                  <Metric label="Blocked" value={blocked} tone={blocked > 0 ? 'danger' : undefined} />
                  <Metric label="Total" value={folder.tasks.length} />
                </div>

                <div className="tiny subtle" style={{ marginTop: 10 }}>
                  {folder.department} · {TIE_BREAK_LABELS[folder.tieBreak as TieBreak]?.toLowerCase()}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'danger' }) {
  return (
    <div>
      <div
        className="num"
        style={{
          fontSize: 19,
          fontWeight: 660,
          color: tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      <div className="tiny subtle">{label}</div>
    </div>
  );
}
