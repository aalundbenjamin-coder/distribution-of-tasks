import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser, canDistribute } from '@/lib/server/permissions';
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '@/lib/domain/enums';
import { Card, PageHeader, PriorityBadge, TaskStatusBadge, formatDate } from '@/components/ui';
import { PlusIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; folder?: string }>;
}) {
  const user = await requireUser('/tasks');
  const params = await searchParams;
  const isDistributor = canDistribute(user.role);

  const statusFilter = (TASK_STATUSES as readonly string[]).includes(params.status ?? '')
    ? (params.status as TaskStatus)
    : null;

  const tasks = await prisma.task.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(params.folder ? { folderId: params.folder } : {}),
      // A coworker only sees the work that is actually theirs.
      ...(isDistributor
        ? {}
        : {
            assignments: {
              some: { coworkerId: user.coworkerId ?? '__none__', status: { in: ['ACTIVE', 'PROPOSED', 'COMPLETED'] } },
            },
          }),
    },
    include: {
      folder: { select: { id: true, name: true } },
      assignments: {
        where: { status: { in: ['ACTIVE', 'PROPOSED'] } },
        include: { coworker: { include: { user: { select: { fullName: true } } } } },
        take: 1,
      },
      _count: { select: { requirements: true } },
    },
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  const counts = await prisma.task.groupBy({
    by: ['status'],
    _count: { _all: true },
    ...(isDistributor
      ? {}
      : {
          where: {
            assignments: { some: { coworkerId: user.coworkerId ?? '__none__' } },
          },
        }),
  });
  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]));

  return (
    <>
      <PageHeader
        title={isDistributor ? 'Tasks' : 'My tasks'}
        lede={
          isDistributor
            ? 'Everything in every folder, and where each piece ended up.'
            : 'Work that has been matched to your recorded capabilities.'
        }
        action={
          isDistributor && (
            <Link href="/tasks/new" className="btn btn-primary">
              <PlusIcon size={16} /> New task
            </Link>
          )
        }
      />

      <div className="row" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href="/tasks" className="badge" style={!statusFilter ? activeChip : undefined}>
          All
        </Link>
        {TASK_STATUSES.filter((s) => (countByStatus.get(s) ?? 0) > 0).map((status) => (
          <Link
            key={status}
            href={`/tasks?status=${status}`}
            className="badge"
            style={statusFilter === status ? activeChip : undefined}
          >
            {TASK_STATUS_LABELS[status]} · {countByStatus.get(status)}
          </Link>
        ))}
      </div>

      <Card padded={false}>
        {tasks.length === 0 ? (
          <div className="empty">
            {isDistributor
              ? 'No tasks match this filter.'
              : 'Nothing assigned to you yet. New work arrives in the bell.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Task</th>
                  <th style={{ width: 170 }}>Status</th>
                  <th style={{ width: 180 }}>Assigned to</th>
                  <th style={{ width: 130 }}>Folder</th>
                  <th style={{ width: 120 }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const assignee = task.assignments[0]?.coworker.user.fullName ?? null;
                  return (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600 }}>
                          {task.title}
                        </Link>
                        <div className="tiny subtle row" style={{ gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          <span className="mono">{task.reference}</span>
                          <PriorityBadge priority={task.priority} />
                          <span>
                            {task._count.requirements} requirement
                            {task._count.requirements === 1 ? '' : 's'}
                          </span>
                          <span>{task.estimatedHours} h</span>
                        </div>
                      </td>
                      <td><TaskStatusBadge status={task.status} /></td>
                      <td className="small">
                        {assignee ?? <span className="subtle">—</span>}
                      </td>
                      <td className="small muted">
                        <Link href={`/folders/${task.folder.id}`}>{task.folder.name}</Link>
                      </td>
                      <td className="small muted">{formatDate(task.dueAt)}</td>
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
