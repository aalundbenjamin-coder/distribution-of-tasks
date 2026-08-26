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
  
  PageHeader,
} from '@/components/ui';
import {
  LevelPips,
  LocalDate,
  LocalDateTime,
  OutcomeBadge,
  PriorityBadge,
  RelativeTime,
  TaskStatusBadge,
} from '@/components/ui-labels';
import { AlertIcon, ScaleIcon, ShieldIcon } from '@/components/icons';
import type { TieBreak } from '@/lib/domain/enums';
import { fill, getTranslations } from '@/lib/i18n';

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
  const { locale, t } = await getTranslations();

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
  const preview = isDistributor ? await previewMatch(id, locale) : null;

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
              <ProgressButtons
                taskId={task.id}
                status={task.status}
                labels={{ start: t.tasks.startWork, complete: t.tasks.markCompleted, completed: t.tasks.completed }}
              />
            )}
            {isDistributor && (
              <RedistributeButton taskId={task.id} labels={{ run: t.tasks.runAgain, running: t.tasks.running }} />
            )}
          </div>
        }
      />

      <div className="row" style={{ gap: 9, flexWrap: 'wrap', marginBottom: 22 }}>
        <TaskStatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <Badge>{task.estimatedHours} {t.tasks.estimatedSuffix}</Badge>
        {task.dueAt && (
          <Badge tone={task.dueAt < new Date() ? 'danger' : 'neutral'}>
            {t.tasks.dueOn} <LocalDate value={task.dueAt} />
          </Badge>
        )}
        <span className="tiny subtle">
          {t.tasks.createdBy} {task.createdBy.fullName} <RelativeTime value={task.createdAt} />
        </span>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          {task.description && (
            <Card title={t.tasks.fieldDescription}>
              <p className="muted" style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{task.description}</p>
            </Card>
          )}

          <Card
            title={t.tasks.requiresTitle}
            subtitle={t.tasks.requiresSub}
            padded={false}
          >
            {task.requirements.length === 0 ? (
              <div className="empty">
                {t.tasks.noRequirements}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.tasks.colCapability}</th>
                      <th style={{ width: 190 }}>{t.tasks.colMinimum}</th>
                      <th style={{ width: 130 }}>{t.tasks.colNecessity}</th>
                      <th style={{ width: 90 }}>{t.tasks.colWeight}</th>
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
                            <Badge tone="info"><ShieldIcon size={11} /> {t.tasks.mustHoldIt}</Badge>
                          ) : (
                            <LevelPips level={req.minLevel} required={req.minLevel} />
                          )}
                        </td>
                        <td>
                          <Badge tone={req.necessity === 'MANDATORY' ? 'danger' : 'neutral'}>
                            {req.necessity === 'MANDATORY' ? t.necessity.MANDATORY : t.necessity.PREFERRED}
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
                {task.requiredPosition && <Badge tone="info">{t.nav.positions}: {task.requiredPosition.title}</Badge>}
                {task.requiredDepartment && <Badge tone="info">{t.coworkers.department}: {task.requiredDepartment}</Badge>}
                {task.requiredLanguages && <Badge tone="info">{t.coworkers.languages}: {task.requiredLanguages}</Badge>}
              </div>
            )}
          </Card>

          {isDistributor && preview && (
            <>
              <Card
                title={t.tasks.mostQualified}
                subtitle={t.tasks.mostQualifiedSub}
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
                          <strong>{t.tasks.shortlistMoved}</strong>{' '}
                          {fill(t.tasks.shortlistMovedBody, {
                            holder: activeAssignment.coworker.user.fullName,
                            best: preview.result.selected.fullName,
                          })}
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
                title={t.tasks.notConsidered}
                subtitle={t.tasks.notConsideredSub}
                padded={false}
              >
                <BlockedTable candidates={preview.result.candidates} />
              </Card>
            </>
          )}

          <Card title={t.tasks.history} subtitle={t.tasks.historySub} padded={false}>
            {task.matchRuns.length === 0 ? (
              <div className="empty">{t.tasks.noHistory}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>{t.dash.colOutcome}</th>
                      <th style={{ width: 120 }}>{t.dash.qualified}</th>
                      <th>{t.dash.colSummary}</th>
                      <th style={{ width: 150 }}>{t.dash.colWhen}</th>
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
                          {<LocalDateTime value={run.createdAt} />}
                          <div>
                            {run.triggeredBy ? run.triggeredBy.fullName : t.tasks.bySystem} ·{' '}
                            {run.durationMs} ms
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
          <Card title={t.tasks.assignment}>
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
                      {fill(t.tasks.matchedAt, { p: Math.round(activeAssignment.scoreAtAssignment * 100) })} ·{' '}
                      {activeAssignment.method === 'AUTOMATIC' ? t.tasks.bySystem : t.tasks.byHand}
                    </div>
                  </div>
                </div>

                {activeAssignment.overrideReason && (
                  <div className="notice notice-warn">
                    <AlertIcon size={16} style={{ flex: 'none', marginTop: 1 }} />
                    <span className="tiny">
                      <strong>{t.tasks.manualOverride}</strong> {activeAssignment.overrideReason}
                      {activeAssignment.assignedBy && ` — ${activeAssignment.assignedBy.fullName}`}
                    </span>
                  </div>
                )}

                <p className="tiny muted">{activeAssignment.rationale}</p>
                <div className="tiny subtle">{t.tasks.assignedOn} <LocalDateTime value={activeAssignment.createdAt} /></div>

                <Link href={`/coworkers/${activeAssignment.coworkerId}`} className="btn btn-sm">
                  {t.tasks.seeCapabilities}
                </Link>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                <p className="small muted">
                  {t.tasks.nobodyHolds}
                  {task.status === 'BLOCKED_NO_MATCH' && ` ${t.tasks.blockedHint}`}
                </p>
              </div>
            )}
          </Card>

          {isDistributor && preview && preview.result.candidates.length > 0 && (
            <Card
              title={activeAssignment ? t.tasks.reassign : t.tasks.assignByHand}
              subtitle={t.tasks.assignSub}
            >
              <AssignForm
                taskId={task.id}
                candidates={preview.result.candidates.map((c) => ({
                  coworkerId: c.coworkerId,
                  fullName: c.fullName,
                  eligible: c.eligible,
                  score: c.score,
                }))}
                labels={{
                  assignTo: t.tasks.assignTo,
                  reason: t.tasks.reasonLabel,
                  reasonPlaceholder: t.tasks.reasonPlaceholder,
                  reasonHint: t.tasks.reasonHint,
                  qualified: t.tasks.qualifiedGroup,
                  unqualified: t.tasks.unqualifiedGroup,
                  notQualified: t.tasks.notQualifiedShort,
                  doesNotMeet: t.tasks.doesNotMeet,
                  acknowledge: t.tasks.acknowledgeOverride,
                  submit: t.tasks.assignThisTask,
                  submitting: t.tasks.assigning,
                }}
              />
            </Card>
          )}

          <Card title={t.tasks.folderPolicy} subtitle={task.folder.name}>
            <dl className="stack" style={{ gap: 11, margin: 0 }}>
              <PolicyRow
                label={t.tasks.polRouting}
                value={task.folder.routingMode === 'AUTO_ASSIGN' ? t.routingMode.AUTO_ASSIGN : t.routingMode.PROPOSE_ONLY}
              />
              <PolicyRow
                label={t.tasks.polTies}
                value={t.tieBreak[task.folder.tieBreak as TieBreak] ?? task.folder.tieBreak}
              />
              <PolicyRow
                label={t.tasks.polAmbiguity}
                value={task.folder.ambiguityPolicy === 'STRICT' ? t.ambiguity.STRICT : t.ambiguity.AUTO}
              />
              <PolicyRow
                label={t.tasks.polTieBand}
                value={fill(t.tasks.tieBandValue, { p: Math.round(task.folder.tieEpsilon * 100) })}
              />
              <PolicyRow
                label={t.tasks.polMinimum}
                value={fill(t.tasks.minimumValue, { p: Math.round(task.folder.minimumScore * 100) })}
              />
            </dl>
            {isDistributor && (
              <Link href={`/folders/${task.folder.id}`} className="btn btn-sm" style={{ marginTop: 13 }}>
                <ScaleIcon size={14} /> {t.tasks.changePolicy}
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
