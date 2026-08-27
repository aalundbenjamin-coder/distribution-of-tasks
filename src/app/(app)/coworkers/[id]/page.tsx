import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser, canDistribute, canVerifySkills } from '@/lib/server/permissions';
import { ProfileForm, RemoveSkillButton, SkillEditor } from '@/components/CoworkerEditors';
import Portrait from '@/components/Portrait';
import {
  Badge,
  Card,
  
  PageHeader,
  Stat,
} from '@/components/ui';
import {
  LevelPips,
  AvailabilityBadge,
  LocalDate,
  RelativeTime,
  TaskStatusBadge,
} from '@/components/ui-labels';
import { AlertIcon, ShieldIcon } from '@/components/icons';
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums';
import { fill, getTranslations } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const coworker = await prisma.coworker.findUnique({
    where: { id },
    select: { user: { select: { fullName: true } } },
  });
  return { title: coworker?.user.fullName ?? 'Coworker' };
}

export default async function CoworkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(`/coworkers/${id}`);
  const { t } = await getTranslations();

  const coworker = await prisma.coworker.findUnique({
    where: { id },
    include: {
      user: true,
      position: true,
      skills: { include: { skill: true }, orderBy: [{ verified: 'desc' }, { level: 'desc' }] },
      assignments: {
        include: { task: { include: { folder: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 25,
      },
    },
  });

  if (!coworker) notFound();

  const isSelf = coworker.userId === viewer.id;
  const isDistributor = canDistribute(viewer.role);
  if (!isSelf && !isDistributor) notFound();

  const skills = await prisma.skill.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
  });
  const positions = await prisma.position.findMany({
    where: { archivedAt: null },
    orderBy: { title: 'asc' },
    select: { id: true, title: true },
  });

  const open = coworker.assignments.filter(
    (a) =>
      (a.status === 'ACTIVE' || a.status === 'PROPOSED') &&
      (OPEN_TASK_STATUSES as readonly string[]).includes(a.task.status),
  );
  const committed = open.reduce((sum, a) => sum + a.task.estimatedHours, 0);
  const completed = coworker.assignments.filter((a) => a.status === 'COMPLETED').length;
  const verifiedCount = coworker.skills.filter((s) => s.verified).length;
  const expiringSoon = coworker.skills.filter(
    (s) => s.expiresAt && s.expiresAt.getTime() - Date.now() < 60 * 86_400_000,
  );

  return (
    <>
      <PageHeader
        eyebrow={coworker.position?.title ?? t.coworkers.noPosition}
        title={coworker.user.fullName}
        lede={
          isSelf
            ? t.coworkers.selfLede
            : undefined
        }
        action={
          <div className="row" style={{ gap: 10 }}>
            <Portrait seed={coworker.portrait ?? coworker.user.fullName} size={64} />
          </div>
        }
      />

      <div className="row" style={{ gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
        <AvailabilityBadge availability={coworker.availability} />
        <Badge>{coworker.department}</Badge>
        <Badge>{coworker.languages.split(',').filter(Boolean).join(', ').toUpperCase() || '—'}</Badge>
        {coworker.employeeNumber && <Badge>#{coworker.employeeNumber}</Badge>}
        {coworker.user.status !== 'ACTIVE' && (
          <Badge tone="danger">{coworker.user.status.toLowerCase()}</Badge>
        )}
      </div>

      {expiringSoon.length > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          <AlertIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            <strong>{fill(t.coworkers.expiringSoon, { n: expiringSoon.length })}</strong>{' '}
            {expiringSoon.map((s) => s.skill.name).join(', ')}. {t.coworkers.expiringTail}
          </span>
        </div>
      )}

      <div className="grid-auto" style={{ marginBottom: 20 }}>
        <Stat label={t.coworkers.openTasks} value={open.length} />
        <Stat
          label={t.coworkers.committed}
          value={`${Math.round(committed)}/${Math.round(coworker.weeklyCapacityHours)} ${t.common.hours}`}
          hint={t.dash.thisWeek}
          tone={committed >= coworker.weeklyCapacityHours ? 'warn' : undefined}
        />
        <Stat
          label={t.coworkers.capabilitiesTitle}
          value={coworker.skills.length}
          hint={fill(t.coworkers.verifiedCount, { n: verifiedCount })}
        />
        <Stat label={t.coworkers.completedStat} value={completed} hint={t.coworkers.completedHint} />
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          <Card
            title={t.coworkers.capabilitiesTitle}
            subtitle={t.coworkers.capabilitiesSub}
            padded={false}
          >
            {coworker.skills.length === 0 ? (
              <div className="empty">
                {t.coworkers.noCapabilities}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.coworkers.capability}</th>
                      <th style={{ width: 200 }}>{t.coworkers.colLevel}</th>
                      <th style={{ width: 130 }}>{t.coworkers.colExperience}</th>
                      <th style={{ width: 150 }}>{t.coworkers.colStatus}</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {coworker.skills.map((entry) => {
                      const lapsed = entry.expiresAt !== null && entry.expiresAt < new Date();
                      return (
                        <tr key={entry.id} className={lapsed ? 'is-blocked' : undefined}>
                          <td>
                            <div style={{ fontWeight: 560 }}>{entry.skill.name}</div>
                            <div className="tiny subtle">{entry.skill.category}</div>
                            {entry.evidence && (
                              <div className="tiny muted" style={{ marginTop: 3 }}>{entry.evidence}</div>
                            )}
                          </td>
                          <td>
                            {entry.skill.kind === 'CERTIFICATION' ? (
                              <Badge tone={lapsed ? 'danger' : 'info'}>
                                <ShieldIcon size={11} /> {lapsed ? t.coworkers.lapsed : t.coworkers.held}
                              </Badge>
                            ) : (
                              <LevelPips level={entry.level} />
                            )}
                          </td>
                          <td className="small muted num">
                            {entry.yearsExperience > 0 ? `${entry.yearsExperience} ${t.coworkers.years}` : '—'}
                          </td>
                          <td>
                            <div className="stack" style={{ gap: 4 }}>
                              {entry.verified ? (
                                <Badge tone="ok"><ShieldIcon size={11} /> {t.common.verified}</Badge>
                              ) : (
                                <Badge>{t.common.selfDeclared}</Badge>
                              )}
                              {entry.expiresAt && (
                                <span className={`tiny ${lapsed ? '' : 'subtle'}`} style={lapsed ? { color: 'var(--danger)' } : undefined}>
                                  {lapsed ? t.coworkers.expired : t.coworkers.validUntil}{' '}
                                  <LocalDate value={entry.expiresAt} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {(isSelf || canVerifySkills(viewer.role)) && (
                              <RemoveSkillButton
                                coworkerId={coworker.id}
                                skillId={entry.skillId}
                                skillName={entry.skill.name}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={t.coworkers.assignmentHistory} padded={false}>
            {coworker.assignments.length === 0 ? (
              <div className="empty">{t.coworkers.noAssignments}</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.dash.colTask}</th>
                      <th style={{ width: 150 }}>{t.tasks.colStatus}</th>
                      <th style={{ width: 110 }}>{t.tasks.colMatch}</th>
                      <th style={{ width: 130 }}>{t.coworkers.colAssigned}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coworker.assignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td>
                          <Link href={`/tasks/${assignment.taskId}`} style={{ fontWeight: 560 }}>
                            {assignment.task.title}
                          </Link>
                          <div className="tiny subtle">
                            <span className="mono">{assignment.task.reference}</span> ·{' '}
                            {assignment.task.folder.name}
                            {assignment.method !== 'AUTOMATIC' && ` · ${t.coworkers.assignedByHand}`}
                          </div>
                        </td>
                        <td><TaskStatusBadge status={assignment.task.status} /></td>
                        <td className="small muted num">
                          {Math.round(assignment.scoreAtAssignment * 100)}%
                        </td>
                        <td className="tiny subtle">{<RelativeTime value={assignment.createdAt} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {(coworker.bio || coworker.education || coworker.thesis) && (
            <Card title={t.coworkers.background}>
              <div className="stack" style={{ gap: 15 }}>
                {coworker.bio && (
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{coworker.bio}</p>
                )}
                {coworker.education && (
                  <div>
                    <div className="small muted">{t.coworkers.education}</div>
                    <div style={{ fontWeight: 560 }}>{coworker.education}</div>
                    {coworker.school && <div className="small muted">{coworker.school}</div>}
                  </div>
                )}
                {coworker.thesis && (
                  <div>
                    <div className="small muted">{t.coworkers.thesis}</div>
                    <div style={{ fontStyle: 'italic' }}>{coworker.thesis}</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {coworker.notes && (
            <Card title={t.coworkers.notes}>
              <p className="muted" style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{coworker.notes}</p>
            </Card>
          )}
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {(isSelf || canVerifySkills(viewer.role)) && (
            <Card title={t.coworkers.addCapability}>
              <SkillEditor
                coworkerId={coworker.id}
                canVerify={canVerifySkills(viewer.role) && !isSelf}
                held={coworker.skills.map((s) => s.skillId)}
                skills={skills.map((s) => ({
                  id: s.id,
                  name: s.name,
                  category: s.category,
                  kind: s.kind,
                  expires: s.expires,
                }))}
                labels={{
                  capability: t.coworkers.capability,
                  choose: t.coworkers.choose,
                  level: t.coworkers.colLevel,
                  statusHeld: t.coworkers.statusHeld,
                  years: t.coworkers.yearsExperience,
                  validUntil: t.coworkers.validUntil,
                  evidence: t.coworkers.evidence,
                  evidencePlaceholder: t.coworkers.evidencePlaceholder,
                  verifiedByMe: t.coworkers.verifiedByMe,
                  verifiedHint: t.coworkers.verifiedHint,
                  selfNote: t.coworkers.selfNote,
                  submit: t.coworkers.saveCapability,
                  submitting: t.common.saving,
                  levelLabels: t.levels,
                  certification: t.skillKind.CERTIFICATION,
                }}
              />
            </Card>
          )}

          {(isSelf || isDistributor) && (
            <Card title={t.coworkers.profileTitle} subtitle={t.coworkers.profileSub}>
              <ProfileForm
                coworkerId={coworker.id}
                positions={positions}
                values={{
                  positionId: coworker.positionId,
                  department: coworker.department,
                  availability: coworker.availability,
                  weeklyCapacityHours: coworker.weeklyCapacityHours,
                  languages: coworker.languages,
                  timezone: coworker.timezone,
                  notes: coworker.notes,
                  employeeNumber: coworker.employeeNumber,
                  availableFrom: coworker.availableFrom?.toISOString().slice(0, 10) ?? null,
                  availableUntil: coworker.availableUntil?.toISOString().slice(0, 10) ?? null,
                }}
                labels={{
                  position: t.coworkers.position,
                  noPosition: t.coworkers.noPosition,
                  department: t.coworkers.department,
                  availability: t.coworkers.availabilityLabel,
                  availabilityHint: t.coworkers.availabilityHint,
                  availabilityLabels: t.availability,
                  capacity: t.coworkers.weeklyCapacity,
                  capacityHint: t.coworkers.capacityHint,
                  languages: t.coworkers.languages,
                  languagesHint: t.coworkers.languagesHint,
                  timezone: t.coworkers.timezone,
                  availableFrom: t.coworkers.availableFrom,
                  availableUntil: t.coworkers.availableUntil,
                  availableUntilHint: t.coworkers.availableUntilHint,
                  employeeNumber: t.coworkers.employeeNumber,
                  notes: t.coworkers.notes,
                  notesPlaceholder: t.coworkers.notesPlaceholder,
                  submit: t.coworkers.saveProfile,
                  submitting: t.common.saving,
                }}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
