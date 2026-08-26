/**
 * Distribution: loading the real people, running the engine, and writing down
 * what happened.
 *
 * The engine itself is pure. This module is the part that talks to the
 * database: it assembles the candidate pool, hands it to `matchTask`, and then
 * persists the *whole* decision — including every coworker who was rejected and
 * why. That record is what makes a distribution defensible weeks later.
 */

import { prisma } from '@/lib/db';
import { matchTask } from '@/lib/matching/engine';
import type {
  CandidateInput,
  MatchPolicy,
  MatchResult,
  TaskInput,
} from '@/lib/matching/types';
import {
  OPEN_TASK_STATUSES,
  coerceEnum,
  AMBIGUITY_POLICIES,
  ROUTING_MODES,
  TASK_PRIORITIES,
  TIE_BREAKS,
  type MatchTrigger,
} from '@/lib/domain/enums';
import { notify } from '@/lib/notifications/dispatch';
import { getLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/locale';
import { recordAudit } from './audit';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Load one task in the shape the engine expects. */
export async function loadTaskInput(taskId: string): Promise<{
  task: TaskInput;
  policy: MatchPolicy;
  folderId: string;
  folderName: string;
} | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      requirements: { include: { skill: true } },
      folder: true,
      requiredPosition: true,
    },
  });
  if (!task) return null;

  return {
    folderId: task.folderId,
    folderName: task.folder.name,
    policy: {
      routingMode: coerceEnum(task.folder.routingMode, ROUTING_MODES, 'AUTO_ASSIGN'),
      tieBreak: coerceEnum(task.folder.tieBreak, TIE_BREAKS, 'BALANCED_LOAD'),
      tieEpsilon: task.folder.tieEpsilon,
      ambiguityPolicy: coerceEnum(task.folder.ambiguityPolicy, AMBIGUITY_POLICIES, 'STRICT'),
      minimumScore: task.folder.minimumScore,
    },
    task: {
      taskId: task.id,
      reference: task.reference,
      title: task.title,
      priority: coerceEnum(task.priority, TASK_PRIORITIES, 'NORMAL'),
      estimatedHours: task.estimatedHours,
      dueAt: task.dueAt,
      requiredPositionId: task.requiredPositionId,
      requiredPositionTitle: task.requiredPosition?.title ?? null,
      requiredLanguages: splitList(task.requiredLanguages),
      requiredDepartment: task.requiredDepartment.trim(),
      requirements: task.requirements.map((r) => ({
        skillId: r.skillId,
        skillName: r.skill.name,
        skillKind: r.skill.kind === 'CERTIFICATION' ? 'CERTIFICATION' : 'GRADED',
        minLevel: r.minLevel,
        necessity: r.necessity === 'PREFERRED' ? 'PREFERRED' : 'MANDATORY',
        weight: r.weight,
      })),
    },
  };
}

/**
 * Build the candidate pool.
 *
 * Every non-offboarded coworker is loaded, including ones who will obviously
 * fail: the point of the audit record is to show that they *were* considered
 * and on what grounds they were set aside.
 */
export async function loadCandidates(taskId: string): Promise<CandidateInput[]> {
  const [coworkers, exclusions] = await Promise.all([
    prisma.coworker.findMany({
      where: { availability: { not: 'OFFBOARDED' } },
      include: {
        user: { select: { fullName: true, status: true } },
        position: { select: { id: true, title: true } },
        skills: true,
        assignments: {
          where: { status: { in: ['PROPOSED', 'ACTIVE'] } },
          include: { task: { select: { estimatedHours: true, status: true } } },
        },
      },
    }),
    prisma.taskExclusion.findMany({ where: { taskId } }),
  ]);

  const exclusionByCoworker = new Map(exclusions.map((e) => [e.coworkerId, e.reason]));

  return coworkers.map((coworker) => {
    const open = coworker.assignments.filter((a) =>
      (OPEN_TASK_STATUSES as readonly string[]).includes(a.task.status),
    );
    const committedHours = open.reduce((sum, a) => sum + a.task.estimatedHours, 0);

    return {
      coworkerId: coworker.id,
      fullName: coworker.user.fullName,
      positionId: coworker.positionId,
      positionTitle: coworker.position?.title ?? null,
      department: coworker.department,
      // A suspended or deactivated account cannot receive work even if the
      // coworker record still says ACTIVE.
      availability:
        coworker.user.status === 'ACTIVE'
          ? (coworker.availability as CandidateInput['availability'])
          : 'UNAVAILABLE',
      availableFrom: coworker.availableFrom,
      availableUntil: coworker.availableUntil,
      weeklyCapacityHours: coworker.weeklyCapacityHours,
      committedHours,
      openTaskCount: open.length,
      languages: splitList(coworker.languages),
      timezone: coworker.timezone,
      skills: coworker.skills.map((s) => ({
        skillId: s.skillId,
        level: s.level,
        verified: s.verified,
        yearsExperience: s.yearsExperience,
        expiresAt: s.expiresAt,
      })),
      lastAssignedAt: coworker.lastAssignedAt,
      assignmentCount: coworker.assignmentCount,
      exclusionReason: exclusionByCoworker.get(coworker.id) ?? null,
    };
  });
}

/**
 * Score a task against everyone without changing anything.
 *
 * This backs the "who is most qualified for this?" view: a head of distribution
 * can look at the full shortlist before any work is handed out.
 */
export async function previewMatch(
  taskId: string,
  locale?: Locale,
): Promise<{ result: MatchResult; task: TaskInput; folderName: string } | null> {
  const loaded = await loadTaskInput(taskId);
  if (!loaded) return null;
  const candidates = await loadCandidates(taskId);
  // The engine writes its own explanations, so it needs to know which language
  // the person reading them is using.
  const result = matchTask(loaded.task, candidates, {
    policy: loaded.policy,
    locale: locale ?? (await getLocale()),
  });
  return { result, task: loaded.task, folderName: loaded.folderName };
}

export interface DistributeOptions {
  taskId: string;
  actorUserId: string | null;
  trigger?: MatchTrigger;
  /** Skip the auto-assign step and only record the shortlist. */
  previewOnly?: boolean;
}

export interface DistributeOutcome {
  matchRunId: string;
  result: MatchResult;
  assignmentId: string | null;
  taskStatus: string;
}

/**
 * Run distribution for one task and persist everything: the match run, every
 * candidate verdict, the assignment when one is warranted, and the
 * notifications that follow from it.
 */
export async function distributeTask(options: DistributeOptions): Promise<DistributeOutcome> {
  const startedAt = Date.now();
  const loaded = await loadTaskInput(options.taskId);
  if (!loaded) throw new Error('That task no longer exists.');

  const candidates = await loadCandidates(options.taskId);
  const result = matchTask(loaded.task, candidates, {
    policy: loaded.policy,
    locale: await getLocale(),
  });
  const durationMs = Date.now() - startedAt;

  const shouldAssign = result.autoAssignable && result.selected !== null && !options.previewOnly;

  const nextStatus = shouldAssign
    ? 'ASSIGNED'
    : result.outcome === 'NO_ELIGIBLE_CANDIDATE'
      ? 'BLOCKED_NO_MATCH'
      : result.outcome === 'PROPOSED'
        ? 'MATCHED'
        : 'NEEDS_REVIEW';

  const matchRun = await prisma.$transaction(async (tx) => {
    const run = await tx.matchRun.create({
      data: {
        taskId: options.taskId,
        triggeredById: options.actorUserId,
        trigger: options.trigger ?? 'MANUAL',
        outcome: result.outcome,
        summary: result.summary,
        policyJson: JSON.stringify(result.policy),
        engineVersion: result.engineVersion,
        candidateCount: result.candidateCount,
        eligibleCount: result.eligibleCount,
        durationMs,
        candidates: {
          create: result.candidates.map((c) => ({
            coworkerId: c.coworkerId,
            eligible: c.eligible,
            blockersJson: JSON.stringify(c.blockers),
            score: c.score,
            breakdownJson: JSON.stringify({
              factors: c.factors,
              findings: c.requirementFindings,
              tieBreakNote: c.tieBreakNote ?? null,
              openTaskCount: c.openTaskCount,
              committedHours: c.committedHours,
              weeklyCapacityHours: c.weeklyCapacityHours,
            }),
            rank: c.rank,
          })),
        },
      },
    });

    await tx.task.update({
      where: { id: options.taskId },
      data: { status: nextStatus },
    });

    return run;
  });

  let assignmentId: string | null = null;

  if (shouldAssign && result.selected) {
    const selected = result.selected;
    const created = await prisma.$transaction(async (tx) => {
      // Any earlier live assignment is revoked, so a task never has two owners.
      await tx.assignment.updateMany({
        where: { taskId: options.taskId, status: { in: ['PROPOSED', 'ACTIVE'] } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });

      const assignment = await tx.assignment.create({
        data: {
          taskId: options.taskId,
          coworkerId: selected.coworkerId,
          matchRunId: matchRun.id,
          method: 'AUTOMATIC',
          assignedById: options.actorUserId,
          status: 'ACTIVE',
          scoreAtAssignment: selected.score,
          rationale: result.rationale,
        },
      });

      await tx.coworker.update({
        where: { id: selected.coworkerId },
        data: { lastAssignedAt: new Date(), assignmentCount: { increment: 1 } },
      });

      return assignment;
    });

    assignmentId = created.id;

    await recordAudit({
      actorId: options.actorUserId,
      action: 'task.assigned',
      entity: 'Task',
      entityId: options.taskId,
      data: {
        coworkerId: selected.coworkerId,
        score: selected.score,
        matchRunId: matchRun.id,
        engineVersion: result.engineVersion,
      },
    });

    await notifyAssignee(selected.coworkerId, loaded.task, result);
  } else {
    await recordAudit({
      actorId: options.actorUserId,
      action: 'task.match_run',
      entity: 'Task',
      entityId: options.taskId,
      data: { outcome: result.outcome, matchRunId: matchRun.id, eligible: result.eligibleCount },
    });

    if (nextStatus === 'NEEDS_REVIEW' || nextStatus === 'BLOCKED_NO_MATCH') {
      await notifyDistributors(options.taskId, loaded.task, result, loaded.folderName);
    }
  }

  return { matchRunId: matchRun.id, result, assignmentId, taskStatus: nextStatus };
}

async function notifyAssignee(coworkerId: string, task: TaskInput, result: MatchResult) {
  const coworker = await prisma.coworker.findUnique({
    where: { id: coworkerId },
    select: { userId: true },
  });
  if (!coworker) return;

  await notify({
    userId: coworker.userId,
    type: 'TASK_ASSIGNED',
    title: `New task: ${task.title}`,
    body: `${task.reference} has been distributed to you because you meet every requirement. ${result.rationale}`,
    link: `/tasks/${task.taskId}`,
    severity: task.priority === 'CRITICAL' ? 'CRITICAL' : 'SUCCESS',
    category: 'OPERATIONAL',
  });
}

async function notifyDistributors(
  taskId: string,
  task: TaskInput,
  result: MatchResult,
  folderName: string,
) {
  const distributors = await prisma.user.findMany({
    where: { role: { in: ['HEAD_OF_DISTRIBUTION', 'PLATFORM_ADMIN'] }, status: 'ACTIVE' },
    select: { id: true },
  });

  const isBlocked = result.outcome === 'NO_ELIGIBLE_CANDIDATE';
  for (const user of distributors) {
    await notify({
      userId: user.id,
      type: isBlocked ? 'TASK_NO_MATCH' : 'TASK_NEEDS_REVIEW',
      title: isBlocked
        ? `No qualified coworker for ${task.reference}`
        : `${task.reference} needs your decision`,
      body: `${task.title} in ${folderName}. ${result.summary}`,
      link: `/tasks/${taskId}`,
      severity: isBlocked ? 'WARNING' : 'INFO',
      category: 'OPERATIONAL',
    });
  }
}

/**
 * Assign a task to a specific coworker, chosen by a human.
 *
 * The gate still runs. A head of distribution can override the *ranking* — they
 * cannot override the qualifications, unless they say in writing that they are
 * doing so, which is stored on the assignment.
 */
export async function assignManually(params: {
  taskId: string;
  coworkerId: string;
  actorUserId: string;
  reason: string;
  /** Required to push a task past a failed requirement. */
  acknowledgeUnqualified?: boolean;
}): Promise<{ ok: true; assignmentId: string } | { ok: false; error: string; blockers?: string[] }> {
  const loaded = await loadTaskInput(params.taskId);
  if (!loaded) return { ok: false, error: 'That task no longer exists.' };

  const candidates = await loadCandidates(params.taskId);
  const chosen = candidates.find((c) => c.coworkerId === params.coworkerId);
  if (!chosen) return { ok: false, error: 'That coworker is not in the candidate pool.' };

  const result = matchTask(loaded.task, candidates, {
    policy: loaded.policy,
    locale: await getLocale(),
  });
  const evaluation = result.candidates.find((c) => c.coworkerId === params.coworkerId);

  if (evaluation && !evaluation.eligible && !params.acknowledgeUnqualified) {
    return {
      ok: false,
      error: `${chosen.fullName} does not meet every requirement of this task.`,
      blockers: evaluation.blockers.map((b) => b.message),
    };
  }

  const assignment = await prisma.$transaction(async (tx) => {
    await tx.assignment.updateMany({
      where: { taskId: params.taskId, status: { in: ['PROPOSED', 'ACTIVE'] } },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    const created = await tx.assignment.create({
      data: {
        taskId: params.taskId,
        coworkerId: params.coworkerId,
        method: 'MANUAL_OVERRIDE',
        assignedById: params.actorUserId,
        status: 'ACTIVE',
        scoreAtAssignment: evaluation?.score ?? 0,
        rationale:
          evaluation?.eligible === false
            ? `Assigned by hand despite unmet requirements. ${params.reason}`
            : `Assigned by hand. ${params.reason}`,
        overrideReason: params.reason,
      },
    });

    await tx.task.update({ where: { id: params.taskId }, data: { status: 'ASSIGNED' } });
    await tx.coworker.update({
      where: { id: params.coworkerId },
      data: { lastAssignedAt: new Date(), assignmentCount: { increment: 1 } },
    });

    return created;
  });

  await recordAudit({
    actorId: params.actorUserId,
    action: evaluation?.eligible === false ? 'task.assigned_override_unqualified' : 'task.assigned_manual',
    entity: 'Task',
    entityId: params.taskId,
    data: {
      coworkerId: params.coworkerId,
      reason: params.reason,
      blockers: evaluation?.blockers.map((b) => b.code) ?? [],
    },
  });

  await notifyAssignee(params.coworkerId, loaded.task, { ...result, rationale: assignment.rationale });

  return { ok: true, assignmentId: assignment.id };
}
