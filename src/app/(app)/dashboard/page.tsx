import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser, canDistribute } from '@/lib/server/permissions';
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums';
import {
  Badge,
  Card,
  PageHeader,
  PriorityBadge,
  Stat,
  TaskStatusBadge,
  formatDate,
  relativeTime,
} from '@/components/ui';
import { AlertIcon, ArrowRightIcon, PlusIcon, ShieldIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser('/dashboard');
  const { denied } = await searchParams;

  return (
    <>
      {denied && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }} role="alert">
          <AlertIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            {denied === 'admin'
              ? 'That area is for platform administrators.'
              : 'That area is for a head of distribution.'}
          </span>
        </div>
      )}

      {canDistribute(user.role) ? (
        <DistributorDashboard name={user.fullName} />
      ) : (
        <CoworkerDashboard userId={user.id} name={user.fullName} coworkerId={user.coworkerId} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

async function DistributorDashboard({ name }: { name: string }) {
  const [
    queued,
    needsReview,
    blocked,
    assignedThisWeek,
    folders,
    attention,
    recentRuns,
    poolSize,
  ] = await Promise.all([
    prisma.task.count({ where: { status: 'QUEUED' } }),
    prisma.task.count({ where: { status: { in: ['NEEDS_REVIEW', 'MATCHED'] } } }),
    prisma.task.count({ where: { status: 'BLOCKED_NO_MATCH' } }),
    prisma.assignment.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    prisma.taskFolder.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'asc' },
      take: 6,
    }),
    prisma.task.findMany({
      where: { status: { in: ['NEEDS_REVIEW', 'MATCHED', 'BLOCKED_NO_MATCH'] } },
      include: { folder: { select: { name: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 8,
    }),
    prisma.matchRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { task: { select: { id: true, reference: true, title: true } } },
    }),
    prisma.coworker.count({ where: { availability: 'ACTIVE' } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Head of distribution"
        title={`Good to see you, ${name.split(' ')[0]}`}
        lede="Everything waiting on a person, and everything the system handled on its own."
        action={
          <Link href="/tasks/new" className="btn btn-primary">
            <PlusIcon size={16} /> New task
          </Link>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 22 }}>
        <Stat label="Waiting in folders" value={queued} hint="Queued, not yet distributed" />
        <Stat
          label="Needs a decision"
          value={needsReview}
          hint="A tie, a weak match or a folder that proposes"
          tone={needsReview > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Nobody qualified"
          value={blocked}
          hint="No coworker meets the requirements"
          tone={blocked > 0 ? 'danger' : undefined}
        />
        <Stat
          label="Distributed this week"
          value={assignedThisWeek}
          hint={`Across ${poolSize} available coworker${poolSize === 1 ? '' : 's'}`}
          tone="ok"
        />
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card
          title="Waiting on you"
          subtitle="The system stopped rather than guess"
          action={
            <Link href="/tasks?status=NEEDS_REVIEW" className="btn btn-sm btn-ghost">
              All <ArrowRightIcon size={14} />
            </Link>
          }
          padded={false}
        >
          {attention.length === 0 ? (
            <div className="empty">
              Nothing is stuck. Every task in a folder found a qualified coworker.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {attention.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600 }}>
                          {task.title}
                        </Link>
                        <div className="tiny subtle" style={{ marginTop: 2 }}>
                          <span className="mono">{task.reference}</span> · {task.folder.name}
                          {task.dueAt && ` · due ${formatDate(task.dueAt)}`}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="stack" style={{ gap: 5, alignItems: 'flex-end' }}>
                          <TaskStatusBadge status={task.status} />
                          <PriorityBadge priority={task.priority} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Folders"
          subtitle="Where work comes in"
          action={
            <Link href="/folders" className="btn btn-sm btn-ghost">
              All <ArrowRightIcon size={14} />
            </Link>
          }
          padded={false}
        >
          {folders.length === 0 ? (
            <div className="empty">
              No folders yet. <Link href="/folders/new" style={{ color: 'var(--accent)' }}>Create the first one</Link>.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {folders.map((folder) => (
                    <tr key={folder.id}>
                      <td>
                        <Link href={`/folders/${folder.id}`} style={{ fontWeight: 600 }}>
                          {folder.name}
                        </Link>
                        <div className="tiny subtle" style={{ marginTop: 2 }}>
                          {folder.department} · {folder._count.tasks} task
                          {folder._count.tasks === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Badge tone={folder.routingMode === 'AUTO_ASSIGN' ? 'ok' : 'accent'}>
                          {folder.routingMode === 'AUTO_ASSIGN' ? 'Auto-assign' : 'Proposes'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card
          title="Recent distribution decisions"
          subtitle="Every run is kept, including the ones nobody was qualified for"
          padded={false}
        >
          {recentRuns.length === 0 ? (
            <div className="empty">No distribution has run yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th style={{ width: 150 }}>Outcome</th>
                    <th style={{ width: 110 }}>Considered</th>
                    <th>Summary</th>
                    <th style={{ width: 110 }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <Link href={`/tasks/${run.task.id}`} style={{ fontWeight: 560 }}>
                          {run.task.title}
                        </Link>
                        <div className="tiny subtle mono">{run.task.reference}</div>
                      </td>
                      <td>
                        <OutcomeChip outcome={run.outcome} />
                      </td>
                      <td className="small muted num">
                        {run.eligibleCount} of {run.candidateCount} qualified
                      </td>
                      <td className="small muted">{run.summary}</td>
                      <td className="tiny subtle">{relativeTime(run.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function OutcomeChip({ outcome }: { outcome: string }) {
  const map: Record<string, { tone: 'ok' | 'warn' | 'danger' | 'accent'; label: string }> = {
    ASSIGNED: { tone: 'ok', label: 'Assigned' },
    PROPOSED: { tone: 'accent', label: 'Proposed' },
    AMBIGUOUS_TIE: { tone: 'warn', label: 'Tie — asked a human' },
    BELOW_MINIMUM: { tone: 'warn', label: 'Below minimum' },
    NO_ELIGIBLE_CANDIDATE: { tone: 'danger', label: 'Nobody qualified' },
  };
  const entry = map[outcome] ?? { tone: 'accent' as const, label: outcome };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

// ---------------------------------------------------------------------------

async function CoworkerDashboard({
  userId,
  name,
  coworkerId,
}: {
  userId: string;
  name: string;
  coworkerId: string | null;
}) {
  if (!coworkerId) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${name.split(' ')[0]}`}
          lede="Your account exists, but you are not in the distribution pool yet."
        />
        <div className="notice notice-info">
          <ShieldIcon size={18} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            A head of distribution has to create your work profile before tasks can be matched to
            you. Once they do, your capabilities appear here and work starts arriving in the bell.
          </span>
        </div>
      </>
    );
  }

  const [coworker, myTasks, recentlyConsidered, unread] = await Promise.all([
    prisma.coworker.findUnique({
      where: { id: coworkerId },
      include: {
        position: true,
        skills: { include: { skill: true }, orderBy: { level: 'desc' } },
        assignments: {
          where: { status: { in: ['ACTIVE', 'PROPOSED'] } },
          include: { task: true },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        assignments: { some: { coworkerId, status: { in: ['ACTIVE', 'PROPOSED'] } } },
        status: { in: [...OPEN_TASK_STATUSES] },
      },
      include: { folder: { select: { name: true } } },
      orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }],
    }),
    prisma.matchCandidate.findMany({
      where: { coworkerId },
      orderBy: { matchRun: { createdAt: 'desc' } },
      take: 6,
      include: { matchRun: { include: { task: { select: { id: true, title: true, reference: true } } } } },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const committed = coworker?.assignments.reduce((sum, a) => sum + a.task.estimatedHours, 0) ?? 0;
  const capacity = coworker?.weeklyCapacityHours ?? 37;
  const verifiedCount = coworker?.skills.filter((s) => s.verified).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={coworker?.position?.title ?? 'Coworker'}
        title={`Good to see you, ${name.split(' ')[0]}`}
        lede="Work matched to what you can do, and a record of where you were considered."
        action={
          <Link href={`/coworkers/${coworkerId}`} className="btn">
            My capabilities
          </Link>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 22 }}>
        <Stat label="Open tasks" value={myTasks.length} hint="Assigned to you right now" />
        <Stat
          label="Committed hours"
          value={`${Math.round(committed)}/${Math.round(capacity)}`}
          hint="This week"
          tone={committed >= capacity ? 'warn' : undefined}
        />
        <Stat
          label="Capabilities"
          value={coworker?.skills.length ?? 0}
          hint={`${verifiedCount} verified by a lead`}
        />
        <Stat label="Unread in the bell" value={unread} tone={unread > 0 ? 'warn' : undefined} />
      </div>

      <Card title="Your tasks" subtitle="Matched to your recorded capabilities" padded={false}>
        {myTasks.length === 0 ? (
          <div className="empty">
            Nothing assigned to you at the moment. New work arrives in the bell in the top-right
            corner.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Task</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 110 }}>Estimate</th>
                  <th style={{ width: 130 }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600 }}>
                        {task.title}
                      </Link>
                      <div className="tiny subtle" style={{ marginTop: 2 }}>
                        <span className="mono">{task.reference}</span> · {task.folder.name}
                      </div>
                    </td>
                    <td><TaskStatusBadge status={task.status} /></td>
                    <td className="small muted num">{task.estimatedHours} h</td>
                    <td className="small muted">{formatDate(task.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 18 }}>
        <Card
          title="Where you were considered"
          subtitle="Distribution is not a black box — this is every recent run you appeared in"
          padded={false}
        >
          {recentlyConsidered.length === 0 ? (
            <div className="empty">You have not been part of a distribution run yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th style={{ width: 130 }}>You were</th>
                    <th>Reason</th>
                    <th style={{ width: 110 }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyConsidered.map((candidate) => {
                    const blockers = safeParseArray(candidate.blockersJson);
                    return (
                      <tr key={candidate.id}>
                        <td>
                          <Link href={`/tasks/${candidate.matchRun.task.id}`} style={{ fontWeight: 560 }}>
                            {candidate.matchRun.task.title}
                          </Link>
                          <div className="tiny subtle mono">{candidate.matchRun.task.reference}</div>
                        </td>
                        <td>
                          {candidate.eligible ? (
                            <Badge tone="ok" dot>
                              Qualified{candidate.rank ? ` · #${candidate.rank}` : ''}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">Not qualified</Badge>
                          )}
                        </td>
                        <td className="small muted">
                          {candidate.eligible
                            ? `Scored ${Math.round(candidate.score * 100)}%`
                            : blockers.map((b) => b.message).join(' ') || '—'}
                        </td>
                        <td className="tiny subtle">{relativeTime(candidate.matchRun.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function safeParseArray(json: string): { message: string }[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
