import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser, canDistribute, canVerifySkills } from '@/lib/server/permissions';
import { ProfileForm, RemoveSkillButton, SkillEditor } from '@/components/CoworkerEditors';
import {
  AvailabilityBadge,
  Avatar,
  Badge,
  Card,
  LevelPips,
  PageHeader,
  Stat,
  TaskStatusBadge,
  formatDate,
  relativeTime,
} from '@/components/ui';
import { AlertIcon, ShieldIcon } from '@/components/icons';
import { OPEN_TASK_STATUSES } from '@/lib/domain/enums';

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
        eyebrow={coworker.position?.title ?? 'No position'}
        title={coworker.user.fullName}
        lede={
          isSelf
            ? 'This is what the system reads when it decides which work reaches you. Keeping it accurate is what keeps the matching honest.'
            : undefined
        }
        action={
          <div className="row" style={{ gap: 10 }}>
            <Avatar name={coworker.user.fullName} colour={coworker.user.avatarColor} large />
          </div>
        }
      />

      <div className="row" style={{ gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
        <AvailabilityBadge availability={coworker.availability} />
        <Badge>{coworker.department}</Badge>
        <Badge>{coworker.languages.split(',').filter(Boolean).join(', ').toUpperCase() || 'No languages'}</Badge>
        {coworker.employeeNumber && <Badge>#{coworker.employeeNumber}</Badge>}
        {coworker.user.status !== 'ACTIVE' && (
          <Badge tone="danger">Account {coworker.user.status.toLowerCase()}</Badge>
        )}
      </div>

      {expiringSoon.length > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          <AlertIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            <strong>
              {expiringSoon.length} capabilit{expiringSoon.length === 1 ? 'y expires' : 'ies expire'} within 60
              days.
            </strong>{' '}
            {expiringSoon.map((s) => `${s.skill.name} (${formatDate(s.expiresAt)})`).join(', ')}. Once
            lapsed they stop counting and work requiring them will route elsewhere.
          </span>
        </div>
      )}

      <div className="grid-auto" style={{ marginBottom: 20 }}>
        <Stat label="Open tasks" value={open.length} />
        <Stat
          label="Committed"
          value={`${Math.round(committed)}/${Math.round(coworker.weeklyCapacityHours)} h`}
          hint="This week"
          tone={committed >= coworker.weeklyCapacityHours ? 'warn' : undefined}
        />
        <Stat label="Capabilities" value={coworker.skills.length} hint={`${verifiedCount} verified`} />
        <Stat label="Completed" value={completed} hint="Recorded assignments" />
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          <Card
            title="Capabilities"
            subtitle="What this person can do, and how far it has been checked."
            padded={false}
          >
            {coworker.skills.length === 0 ? (
              <div className="empty">
                No capabilities recorded. Until at least one is, this person can only be matched to
                tasks with no requirements.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th style={{ width: 200 }}>Level</th>
                      <th style={{ width: 130 }}>Experience</th>
                      <th style={{ width: 150 }}>Status</th>
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
                                <ShieldIcon size={11} /> {lapsed ? 'Lapsed' : 'Held'}
                              </Badge>
                            ) : (
                              <LevelPips level={entry.level} />
                            )}
                          </td>
                          <td className="small muted num">
                            {entry.yearsExperience > 0 ? `${entry.yearsExperience} yr` : '—'}
                          </td>
                          <td>
                            <div className="stack" style={{ gap: 4 }}>
                              {entry.verified ? (
                                <Badge tone="ok"><ShieldIcon size={11} /> Verified</Badge>
                              ) : (
                                <Badge>Self-declared</Badge>
                              )}
                              {entry.expiresAt && (
                                <span className={`tiny ${lapsed ? '' : 'subtle'}`} style={lapsed ? { color: 'var(--danger)' } : undefined}>
                                  {lapsed ? 'Expired' : 'Valid until'} {formatDate(entry.expiresAt)}
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

          <Card title="Assignment history" padded={false}>
            {coworker.assignments.length === 0 ? (
              <div className="empty">No work has been distributed to this person yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th style={{ width: 150 }}>Status</th>
                      <th style={{ width: 110 }}>Match</th>
                      <th style={{ width: 130 }}>Assigned</th>
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
                            {assignment.method !== 'AUTOMATIC' && ' · assigned by hand'}
                          </div>
                        </td>
                        <td><TaskStatusBadge status={assignment.task.status} /></td>
                        <td className="small muted num">
                          {Math.round(assignment.scoreAtAssignment * 100)}%
                        </td>
                        <td className="tiny subtle">{relativeTime(assignment.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {coworker.notes && (
            <Card title="Notes">
              <p className="muted" style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{coworker.notes}</p>
            </Card>
          )}
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {(isSelf || canVerifySkills(viewer.role)) && (
            <Card title="Add or update a capability">
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
              />
            </Card>
          )}

          {(isSelf || isDistributor) && (
            <Card title="Profile" subtitle="Capacity and availability feed straight into matching.">
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
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
