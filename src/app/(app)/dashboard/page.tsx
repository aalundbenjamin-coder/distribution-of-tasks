import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser, canDistribute } from '@/lib/server/permissions';
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums';
import {
  Badge,
  Card,
  PageHeader,
  Stat,
} from '@/components/ui';
import {
  LocalDate,
  PriorityBadge,
  RelativeTime,
  TaskStatusBadge,
} from '@/components/ui-labels';
import { AlertIcon, ArrowRightIcon, PlusIcon, ShieldIcon } from '@/components/icons';
import { fill, getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser('/dashboard');
  const { denied } = await searchParams;
  const { t } = await getTranslations();

  return (
    <>
      {denied && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }} role="alert">
          <AlertIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            {denied === 'admin' ? t.dash.deniedAdmin : t.dash.deniedDistribution}
          </span>
        </div>
      )}

      {canDistribute(user.role) ? (
        <DistributorDashboard name={user.fullName} t={t} />
      ) : (
        <CoworkerDashboard userId={user.id} name={user.fullName} coworkerId={user.coworkerId} t={t} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

async function DistributorDashboard({ name, t }: { name: string; t: Awaited<ReturnType<typeof getTranslations>>['t'] }) {
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
        eyebrow={t.dash.headEyebrow}
        title={`${t.dash.greeting} ${name.split(' ')[0]}`}
        lede={t.dash.headLede}
        action={
          <Link href="/tasks/new" className="btn btn-primary">
            <PlusIcon size={16} /> {t.dash.newTask}
          </Link>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 22 }}>
        <Stat label={t.dash.waitingInFolders} value={queued} hint={t.dash.waitingHint} />
        <Stat
          label={t.dash.needsDecision}
          value={needsReview}
          hint={t.dash.needsHint}
          tone={needsReview > 0 ? 'warn' : undefined}
        />
        <Stat
          label={t.dash.nobodyQualified}
          value={blocked}
          hint={t.dash.nobodyHint}
          tone={blocked > 0 ? 'danger' : undefined}
        />
        <Stat
          label={t.dash.distributedWeek}
          value={assignedThisWeek}
          hint={fill(t.dash.acrossCoworkers, { n: poolSize })}
          tone="ok"
        />
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card
          title={t.dash.waitingOnYou}
          subtitle={t.dash.waitingOnYouSub}
          action={
            <Link href="/tasks?status=NEEDS_REVIEW" className="btn btn-sm btn-ghost">
              {t.common.all} <ArrowRightIcon size={14} />
            </Link>
          }
          padded={false}
        >
          {attention.length === 0 ? (
            <div className="empty">
              {t.dash.nothingStuck}
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
                          {task.dueAt && ` · due ${<LocalDate value={task.dueAt} />}`}
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
          title={t.dash.foldersTitle}
          subtitle={t.dash.foldersSub}
          action={
            <Link href="/folders" className="btn btn-sm btn-ghost">
              {t.common.all} <ArrowRightIcon size={14} />
            </Link>
          }
          padded={false}
        >
          {folders.length === 0 ? (
            <div className="empty">
              {t.dash.noFolders}{' '}
              <Link href="/folders/new" style={{ color: 'var(--accent)' }}>{t.dash.createFirstFolder}</Link>.
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
                          {folder.department} · {folder._count.tasks} {t.nav.tasks.toLowerCase()}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Badge tone={folder.routingMode === 'AUTO_ASSIGN' ? 'ok' : 'accent'}>
                          {folder.routingMode === 'AUTO_ASSIGN' ? t.dash.autoAssign : t.dash.proposes}
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
          title={t.dash.recentDecisions}
          subtitle={t.dash.recentDecisionsSub}
          padded={false}
        >
          {recentRuns.length === 0 ? (
            <div className="empty">{t.dash.noRuns}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.dash.colTask}</th>
                    <th style={{ width: 150 }}>{t.dash.colOutcome}</th>
                    <th style={{ width: 110 }}>{t.dash.colConsidered}</th>
                    <th>{t.dash.colSummary}</th>
                    <th style={{ width: 110 }}>{t.dash.colWhen}</th>
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
                        {fill(t.dash.qualifiedOf, { a: run.eligibleCount, b: run.candidateCount })}
                      </td>
                      <td className="small muted">{run.summary}</td>
                      <td className="tiny subtle">{<RelativeTime value={run.createdAt} />}</td>
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
  t,
}: {
  userId: string;
  name: string;
  coworkerId: string | null;
  t: Awaited<ReturnType<typeof getTranslations>>['t'];
}) {
  if (!coworkerId) {
    return (
      <>
        <PageHeader
          title={`${t.dash.greeting} ${name.split(' ')[0]}`}
          lede={t.dash.notInPoolTitle}
        />
        <div className="notice notice-info">
          <ShieldIcon size={18} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            {t.dash.notInPoolBody}
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
        eyebrow={coworker?.position?.title ?? t.roles.COWORKER}
        title={`${t.dash.greeting} ${name.split(' ')[0]}`}
        lede={t.dash.coworkerLede}
        action={
          <Link href={`/coworkers/${coworkerId}`} className="btn">
            {t.dash.myCapabilitiesBtn}
          </Link>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 22 }}>
        <Stat label={t.dash.myOpenTasks} value={myTasks.length} hint={t.dash.myOpenHint} />
        <Stat
          label={t.dash.committedHours}
          value={`${Math.round(committed)}/${Math.round(capacity)}`}
          hint={t.dash.thisWeek}
          tone={committed >= capacity ? 'warn' : undefined}
        />
        <Stat
          label={t.dash.myCapabilities}
          value={coworker?.skills.length ?? 0}
          hint={fill(t.dash.verifiedByLead, { n: verifiedCount })}
        />
        <Stat label={t.dash.unreadInBell} value={unread} tone={unread > 0 ? 'warn' : undefined} />
      </div>

      <Card title={t.dash.myTasksTitle} subtitle={t.dash.myTasksSub} padded={false}>
        {myTasks.length === 0 ? (
          <div className="empty">
            {t.dash.nothingAssigned}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t.dash.colTask}</th>
                  <th style={{ width: 130 }}>{t.tasks.colStatus}</th>
                  <th style={{ width: 110 }}>{t.tasks.estimatedHours}</th>
                  <th style={{ width: 130 }}>{t.tasks.colDue}</th>
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
                    <td className="small muted">{<LocalDate value={task.dueAt} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 18 }}>
        <Card
          title={t.dash.consideredTitle}
          subtitle={t.dash.consideredSub}
          padded={false}
        >
          {recentlyConsidered.length === 0 ? (
            <div className="empty">{t.dash.notConsideredYet}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.dash.colTask}</th>
                    <th style={{ width: 130 }}>{t.dash.youWere}</th>
                    <th>{t.dash.reason}</th>
                    <th style={{ width: 110 }}>{t.dash.colWhen}</th>
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
                              {t.dash.qualified}{candidate.rank ? ` · #${candidate.rank}` : ''}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">{t.dash.notQualified}</Badge>
                          )}
                        </td>
                        <td className="small muted">
                          {candidate.eligible
                            ? fill(t.dash.scored, { p: Math.round(candidate.score * 100) })
                            : blockers.map((b) => b.message).join(' ') || '—'}
                        </td>
                        <td className="tiny subtle">{<RelativeTime value={candidate.matchRun.createdAt} />}</td>
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
