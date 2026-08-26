import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireDistributor } from '@/lib/server/permissions';
import { FolderPolicyForm } from '@/components/FolderForm';
import {
  Card,
  PageHeader,
  Stat,
} from '@/components/ui';
import {
  LocalDate,
  PriorityBadge,
  TaskStatusBadge,
} from '@/components/ui-labels';
import { PlusIcon } from '@/components/icons';
import { getTranslations } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const folder = await prisma.taskFolder.findUnique({ where: { id }, select: { name: true } });
  return { title: folder?.name ?? 'Folder' };
}

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireDistributor(`/folders/${id}`);
  const { t } = await getTranslations();

  const folder = await prisma.taskFolder.findUnique({
    where: { id },
    include: {
      owner: { select: { fullName: true } },
      defaultPosition: { select: { id: true, title: true } },
      tasks: {
        include: {
          assignments: {
            where: { status: { in: ['ACTIVE', 'PROPOSED'] } },
            include: { coworker: { include: { user: { select: { fullName: true } } } } },
            take: 1,
          },
        },
        orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });

  if (!folder) notFound();

  const queued = folder.tasks.filter((t) => t.status === 'QUEUED').length;
  const review = folder.tasks.filter((t) => t.status === 'NEEDS_REVIEW' || t.status === 'MATCHED').length;
  const blocked = folder.tasks.filter((t) => t.status === 'BLOCKED_NO_MATCH').length;
  const assigned = folder.tasks.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length;

  return (
    <>
      <PageHeader
        eyebrow={t.folders.title}
        title={folder.name}
        lede={folder.description ?? undefined}
        action={
          <Link href={`/tasks/new?folder=${folder.id}`} className="btn btn-primary">
            <PlusIcon size={16} /> {t.folders.sendTaskHere}
          </Link>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 20 }}>
        <Stat label={t.folders.queued} value={queued} />
        <Stat label={t.dash.needsDecision} value={review} tone={review > 0 ? 'warn' : undefined} />
        <Stat label={t.dash.nobodyQualified} value={blocked} tone={blocked > 0 ? 'danger' : undefined} />
        <Stat label={t.folders.beingWorkedOn} value={assigned} tone="ok" />
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)', alignItems: 'start' }}>
        <Card title={t.folders.tasksInFolder} padded={false}>
          {folder.tasks.length === 0 ? (
            <div className="empty">
              {t.folders.nothingHere}{' '}
              <Link href={`/tasks/new?folder=${folder.id}`} style={{ color: 'var(--accent)' }}>
                {t.folders.sendFirstTask}
              </Link>
              .
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.dash.colTask}</th>
                    <th style={{ width: 170 }}>{t.tasks.colStatus}</th>
                    <th style={{ width: 170 }}>{t.tasks.colAssignedTo}</th>
                    <th style={{ width: 110 }}>{t.tasks.colDue}</th>
                  </tr>
                </thead>
                <tbody>
                  {folder.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600 }}>
                          {task.title}
                        </Link>
                        <div className="tiny subtle row" style={{ gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          <span className="mono">{task.reference}</span>
                          <PriorityBadge priority={task.priority} />
                          <span>{task.estimatedHours} {t.common.hours}</span>
                        </div>
                      </td>
                      <td><TaskStatusBadge status={task.status} /></td>
                      <td className="small">
                        {task.assignments[0]?.coworker.user.fullName ?? <span className="subtle">—</span>}
                      </td>
                      <td className="small muted">{<LocalDate value={task.dueAt} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack" style={{ gap: 18 }}>
          <Card
            title={t.folders.routingPolicy}
            subtitle={t.folders.policyChangeNote}
          >
            <FolderPolicyForm
              folderId={folder.id}
              values={{
                routingMode: folder.routingMode,
                tieBreak: folder.tieBreak,
                ambiguityPolicy: folder.ambiguityPolicy,
                tieEpsilon: folder.tieEpsilon,
                minimumScore: folder.minimumScore,
              }}
              t={t}
            />
          </Card>

          <Card title={t.folders.aboutFolder}>
            <dl className="stack" style={{ gap: 11, margin: 0 }}>
              <div>
                <dt className="eyebrow">{t.coworkers.department}</dt>
                <dd className="small" style={{ margin: '2px 0 0' }}>{folder.department}</dd>
              </div>
              <div>
                <dt className="eyebrow">{t.folders.owner}</dt>
                <dd className="small" style={{ margin: '2px 0 0' }}>{folder.owner.fullName}</dd>
              </div>
              <div>
                <dt className="eyebrow">{t.folders.defaultPosition}</dt>
                <dd className="small" style={{ margin: '2px 0 0' }}>
                  {folder.defaultPosition ? (
                    <Link href={`/positions`} style={{ color: 'var(--accent)' }}>
                      {folder.defaultPosition.title}
                    </Link>
                  ) : (
                    <span className="subtle">{t.common.none}</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
