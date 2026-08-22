import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser, canDistribute } from '@/lib/server/permissions';
import { previewMatch } from '@/lib/server/distribution';
import {
  BlockedTable,
  MatchOutcomeNotice,
  ShortlistTable,
} from '@/components/MatchExplanation';
import { AssignForm, ProgressButtons, RedistributeButton } from '@/components/TaskActions';
import {
  Avatar,
  Badge,
  Card,
  LevelPips,
  OutcomeBadge,
  PageHeader,
  PriorityBadge,
  TaskStatusBadge,
  formatDate,
  formatDateTime,
  relativeTime,
} from '@/components/ui';
import { AlertIcon, ScaleIcon, ShieldIcon } from '@/components/icons';
import { TIE_BREAK_LABELS, type TieBreak } from '@/lib/domain/enums';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, select: { reference: true, title: true } });
  return { title: task ? `${task.reference} · ${task.title}` : 'Task' };
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/tasks/${id}`);

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      folder: { include: { defaultPosition: { select: { title: true } } } },
      createdBy: { select: { fullName: true, avatarColor: true } },
      requiredPosition: { select: { title: true } },
      requirements: {
        include: { skill: true },
        // Mandatory first, then by weight: the requirements that gate the task
        // should be the ones a reader sees first.
        orderBy: [{ necessity: 'asc' }, { weight: 'desc' }],
      },
      assignments: {
        include: {
          coworker: { include: { user: { select: { fullName: true, avatarColor: true } } } },
          assignedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      matchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { triggeredBy: { select: { fullName: true } } },
      },
    },
  });

  if (!task) notFound();

  const isDistributor = canDistribute(user.role);
  const activeAssignment = task.assignments.find((a) => a.status === 'ACTIVE' || a.status === 'PROPOSED');
  const isAssignee = activeAssignment?.coworker.userId === user.id;

  // A coworker may only open a task that is theirs.
  if (!isDistributor && !task.assignments.some((a) => a.coworker.userId === user.id)) {
    notFound();
  }

  // Recomputed live rather than read from the last run, so the shortlist
  // reflects capability and availability changes since then.
  const preview = isDistributor ? await previewMatch(id) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span className="mono">{task.reference}</span> · {task.folder.name}
          </>
        }
        title={task.title}
        action={
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {(isAssignee || isDistributor) && activeAssignment && (
              <ProgressButtons taskId={task.id} status={task.status} />
            )}
            {isDistributor && <RedistributeButton taskId={task.id} />}
          </div>
        }
      />

      <div className="row" style={{ gap: 9, flexWrap: 'wrap', marginBottom: 22 }}>
        <TaskStatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <Badge>{task.estimatedHours} h estimated</Badge>
        {task.dueAt && <Badge tone={task.dueAt < new Date() ? 'danger' : 'neutral'}>Due {formatDate(task.dueAt)}</Badge>}
        <span className="tiny subtle">Created by {task.createdBy.fullName} {relativeTime(task.createdAt)}</span>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          {task.description && (
            <Card title="Description">
              <p className="muted" style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{task.description}</p>
            </Card>
          )}

          <Card
            title="What this task requires"
            subtitle="Mandatory requirements are the gate; preferred ones only affect the ranking."
            padded={false}
          >
            {task.requirements.length === 0 ? (
              <div className="empty">
                No capability requirements. Any available coworker with capacity qualifies.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th style={{ width: 190 }}>Minimum</th>
                      <th style={{ width: 130 }}>Necessity</th>
                      <th style={{ width: 90 }}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.requirements.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ fontWeight: 560 }}>{req.skill.name}</div>
                          <div className="tiny subtle">{req.skill.category}</div>
                        </td>
                        <td>
                          {req.skill.kind === 'CERTIFICATION' ? (
                            <Badge tone="info"><ShieldIcon size={11} /> Must hold it</Badge>
                          ) : (
                            <LevelPips level={req.minLevel} required={req.minLevel} />
                          )}
                        </td>
                        <td>
                          <Badge tone={req.necessity === 'MANDATORY' ? 'danger' : 'neutral'}>
                            {req.necessity === 'MANDATORY' ? 'Mandatory' : 'Preferred'}
                          </Badge>
                        </td>
                        <td className="num small muted">{req.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(task.requiredPosition || task.requiredDepartment || task.requiredLanguages) && (
              <div className="card-pad row" style={{ gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                {task.requiredPosition && <Badge tone="info">Position: {task.requiredPosition.title}</Badge>}
                {task.requiredDepartment && <Badge tone="info">Department: {task.requiredDepartment}</Badge>}
                {task.requiredLanguages && <Badge tone="info">Languages: {task.requiredLanguages}</Badge>}
              </div>
            )}
          </Card>

          {isDistributor && preview && (
            <>
              <Card
                title="Who is most qualified for this task"
                subtitle="Recomputed now, against current capabilities, availability and workload."
                padded={false}
              >
                <div className="card-pad stack" style={{ gap: 12 }}>
                  <MatchOutcomeNotice result={preview.result} />
                  {activeAssignment &&
                    preview.result.selected &&
                    preview.result.selected.coworkerId !== activeAssignment.coworkerId && (
                      <div className="notice notice-warn">
                        <ScaleIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
                        <span>
                          <strong>The shortlist has moved since this was assigned.</strong>{' '}
                          {activeAssignment.coworker.user.fullName} holds the task, but on today&rsquo;s
                          capabilities and workload the strongest match is{' '}
                          {preview.result.selected.fullName}. That is expected as work is taken on — it
                          is only worth acting on if the task has not been started.
                        </span>
                      </div>
                    )}
                </div>
                <ShortlistTable
                  candidates={preview.result.candidates}
                  assignedId={activeAssignment?.coworkerId}
                  recommendedId={preview.result.selected?.coworkerId}
                />
              </Card>

              <Card
                title="Not considered"
                subtitle="Everyone the hard gate removed, and the requirement they failed."
                padded={false}
              >
                <BlockedTable candidates={preview.result.candidates} />
              </Card>
            </>
          )}

          <Card title="Distribution history" subtitle="Every run, kept for the record." padded={false}>
            {task.matchRuns.length === 0 ? (
              <div className="empty">Distribution has not run for this task yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>Outcome</th>
                      <th style={{ width: 120 }}>Qualified</th>
                      <th>Summary</th>
                      <th style={{ width: 150 }}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.matchRuns.map((run) => (
                      <tr key={run.id}>
                        <td><OutcomeBadge outcome={run.outcome} /></td>
                        <td className="small muted num">
                          {run.eligibleCount} of {run.candidateCount}
                        </td>
                        <td className="small muted">{run.summary}</td>
                        <td className="tiny subtle">
                          {formatDateTime(run.createdAt)}
                          <div>
                            {run.triggeredBy ? `by ${run.triggeredBy.fullName}` : 'automatic'} ·{' '}
                            {run.durationMs} ms · engine {run.engineVersion}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar --------------------------------------------------------- */}
        <div className="stack" style={{ gap: 18 }}>
          <Card title="Assignment">
            {activeAssignment ? (
              <div className="stack" style={{ gap: 12 }}>
                <div className="row" style={{ gap: 11 }}>
                  <Avatar
                    name={activeAssignment.coworker.user.fullName}
                    colour={activeAssignment.coworker.user.avatarColor}
                    large
                  />
                  <div>
                    <div style={{ fontWeight: 640 }}>{activeAssignment.coworker.user.fullName}</div>
                    <div className="tiny muted">
                      Matched at {Math.round(activeAssignment.scoreAtAssignment * 100)}% ·{' '}
                      {activeAssignment.method === 'AUTOMATIC' ? 'by the system' : 'by hand'}
                    </div>
                  </div>
                </div>

                {activeAssignment.overrideReason && (
                  <div className="notice notice-warn">
                    <AlertIcon size={16} style={{ flex: 'none', marginTop: 1 }} />
                    <span className="tiny">
                      <strong>Manual override.</strong> {activeAssignment.overrideReason}
                      {activeAssignment.assignedBy && ` — ${activeAssignment.assignedBy.fullName}`}
                    </span>
                  </div>
                )}

                <p className="tiny muted">{activeAssignment.rationale}</p>
                <div className="tiny subtle">Assigned {formatDateTime(activeAssignment.createdAt)}</div>

                <Link href={`/coworkers/${activeAssignment.coworkerId}`} className="btn btn-sm">
                  See their capabilities
                </Link>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                <p className="small muted">
                  Nobody holds this task yet.
                  {task.status === 'BLOCKED_NO_MATCH' &&
                    ' No coworker met every requirement — widen the requirements, add capacity, or assign by hand with a reason.'}
                </p>
              </div>
            )}
          </Card>

          {isDistributor && preview && preview.result.candidates.length > 0 && (
            <Card
              title={activeAssignment ? 'Reassign' : 'Assign by hand'}
              subtitle="Overrides the ranking, not the requirements — unless you say so explicitly."
            >
              <AssignForm
                taskId={task.id}
                candidates={preview.result.candidates.map((c) => ({
                  coworkerId: c.coworkerId,
                  fullName: c.fullName,
                  eligible: c.eligible,
                  score: c.score,
                }))}
              />
            </Card>
          )}

          <Card title="Folder policy" subtitle={task.folder.name}>
            <dl className="stack" style={{ gap: 11, margin: 0 }}>
              <PolicyRow
                label="Routing"
                value={task.folder.routingMode === 'AUTO_ASSIGN' ? 'Assigns automatically' : 'Proposes, a human confirms'}
              />
              <PolicyRow
                label="Ties"
                value={TIE_BREAK_LABELS[task.folder.tieBreak as TieBreak] ?? task.folder.tieBreak}
              />
              <PolicyRow
                label="Ambiguity"
                value={
                  task.folder.ambiguityPolicy === 'STRICT'
                    ? 'Asks a person when candidates are too close'
                    : 'Always picks the top-ranked candidate'
                }
              />
              <PolicyRow
                label="Tie band"
                value={`Within ${Math.round(task.folder.tieEpsilon * 100)}% counts as tied`}
              />
              <PolicyRow
                label="Minimum score"
                value={`${Math.round(task.folder.minimumScore * 100)}% to assign automatically`}
              />
            </dl>
            {isDistributor && (
              <Link href={`/folders/${task.folder.id}`} className="btn btn-sm" style={{ marginTop: 13 }}>
                <ScaleIcon size={14} /> Change the policy
              </Link>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="small" style={{ margin: '2px 0 0' }}>{value}</dd>
    </div>
  );
}
