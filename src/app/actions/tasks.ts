'use server';

/**
 * Creating tasks and distributing them.
 *
 * "Send to the folder" is the moment the product exists for: a head of
 * distribution describes the work and its requirements once, and the system
 * takes it from there.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AccessError, assertDistributor, assertUser } from '@/lib/server/permissions';
import { recordAudit } from '@/lib/server/audit';
import { nextTaskReference } from '@/lib/server/references';
import { assignManually, distributeTask } from '@/lib/server/distribution';
import { NECESSITIES, TASK_PRIORITIES } from '@/lib/domain/enums';
import type { ActionState } from './catalogue';

const EMPTY: ActionState = { ok: false };

const taskSchema = z.object({
  title: z.string().trim().min(3, 'Give the task a title.').max(140, 'That title is too long.'),
  description: z.string().trim().max(4000).optional(),
  folderId: z.string().trim().min(1, 'Choose a folder to send this to.'),
  priority: z.enum(TASK_PRIORITIES),
  estimatedHours: z.number().min(0.25, 'Estimate at least a quarter of an hour.').max(400),
  dueAt: z.date().nullable(),
  requiredPositionId: z.string().trim().optional(),
  requiredLanguages: z.string().trim().max(80),
  requiredDepartment: z.string().trim().max(60),
});

function readRequirementRows(formData: FormData) {
  const skillIds = formData.getAll('requirement_skill').map(String);
  const levels = formData.getAll('requirement_level').map(String);
  const necessities = formData.getAll('requirement_necessity').map(String);
  const weights = formData.getAll('requirement_weight').map(String);

  const rows: { skillId: string; minLevel: number; necessity: string; weight: number }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < skillIds.length; i += 1) {
    const skillId = skillIds[i]?.trim();
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    rows.push({
      skillId,
      minLevel: Math.min(5, Math.max(0, Number.parseInt(levels[i] ?? '3', 10) || 0)),
      necessity: (NECESSITIES as readonly string[]).includes(necessities[i] ?? '')
        ? necessities[i]!
        : 'MANDATORY',
      weight: Math.min(5, Math.max(1, Number.parseInt(weights[i] ?? '3', 10) || 3)),
    });
  }
  return rows;
}

export interface CreateTaskState extends ActionState {
  /** Where the task ended up, so the form can report it without a round trip. */
  outcome?: string;
  outcomeSummary?: string;
  taskId?: string;
}

/**
 * Create a task and, unless it is saved as a draft, immediately run
 * distribution for it.
 */
export async function createTaskAction(
  _prev: CreateTaskState = EMPTY,
  formData: FormData,
): Promise<CreateTaskState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const rawDue = String(formData.get('dueAt') ?? '').trim();
  const parsed = taskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    folderId: formData.get('folderId'),
    priority: (TASK_PRIORITIES as readonly string[]).includes(String(formData.get('priority')))
      ? String(formData.get('priority'))
      : 'NORMAL',
    estimatedHours: Number.parseFloat(String(formData.get('estimatedHours') ?? '4')),
    dueAt: rawDue ? new Date(`${rawDue}T17:00:00`) : null,
    requiredPositionId: formData.get('requiredPositionId') || undefined,
    requiredLanguages: String(formData.get('requiredLanguages') ?? ''),
    requiredDepartment: String(formData.get('requiredDepartment') ?? ''),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? '') };
  }

  const data = parsed.data;
  if (data.dueAt && Number.isNaN(data.dueAt.getTime())) {
    return { ok: false, error: 'That deadline is not a valid date.', field: 'dueAt' };
  }

  const folder = await prisma.taskFolder.findUnique({ where: { id: data.folderId } });
  if (!folder) return { ok: false, error: 'That folder no longer exists.', field: 'folderId' };

  const requirements = readRequirementRows(formData);
  if (requirements.length > 0) {
    const found = await prisma.skill.count({
      where: { id: { in: requirements.map((r) => r.skillId) } },
    });
    if (found !== requirements.length) {
      return { ok: false, error: 'One of the selected capabilities no longer exists. Reload and try again.' };
    }
  }

  const asDraft = formData.get('intent') === 'draft';

  const task = await prisma.$transaction(async (tx) => {
    const reference = await nextTaskReference(tx);
    return tx.task.create({
      data: {
        reference,
        title: data.title,
        description: data.description ?? null,
        folderId: data.folderId,
        createdById: actor.id,
        status: asDraft ? 'DRAFT' : 'QUEUED',
        queuedAt: asDraft ? null : new Date(),
        priority: data.priority,
        estimatedHours: data.estimatedHours,
        dueAt: data.dueAt,
        // A folder's default position applies unless the task names its own.
        requiredPositionId: data.requiredPositionId || folder.defaultPositionId || null,
        requiredLanguages: data.requiredLanguages,
        requiredDepartment: data.requiredDepartment,
        requirements: {
          create: requirements.map((r) => ({
            skillId: r.skillId,
            minLevel: r.minLevel,
            necessity: r.necessity,
            weight: r.weight,
          })),
        },
      },
    });
  });

  await recordAudit({
    actorId: actor.id,
    action: asDraft ? 'task.drafted' : 'task.queued',
    entity: 'Task',
    entityId: task.id,
    data: { reference: task.reference, folderId: data.folderId, requirements: requirements.length },
  });

  if (asDraft) {
    revalidatePath('/tasks');
    return { ok: true, taskId: task.id, createdId: task.id, message: `${task.reference} saved as a draft.` };
  }

  const outcome = await distributeTask({
    taskId: task.id,
    actorUserId: actor.id,
    trigger: 'FOLDER_INTAKE',
  });

  revalidatePath('/tasks');
  revalidatePath('/folders');
  return {
    ok: true,
    taskId: task.id,
    createdId: task.id,
    outcome: outcome.result.outcome,
    outcomeSummary: outcome.result.summary,
    message: `${task.reference} created.`,
  };
}

/** Re-run distribution for a task that is already in a folder. */
export async function redistributeTaskAction(taskId: string): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!task) return { ok: false, error: 'That task no longer exists.' };
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    return { ok: false, error: 'That task is closed. Reopen it before distributing again.' };
  }

  if (task.status === 'DRAFT') {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'QUEUED', queuedAt: new Date() },
    });
  }

  const outcome = await distributeTask({ taskId, actorUserId: actor.id, trigger: 'REQUEUE' });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
  return { ok: true, message: outcome.result.summary };
}

/** Accept the engine's proposal on a folder set to propose rather than assign. */
export async function confirmProposalAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const taskId = String(formData.get('taskId') ?? '');
  const coworkerId = String(formData.get('coworkerId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const acknowledge = formData.get('acknowledgeUnqualified') === 'on';

  if (!taskId || !coworkerId) return { ok: false, error: 'Choose who should take this task.' };

  const result = await assignManually({
    taskId,
    coworkerId,
    actorUserId: actor.id,
    reason: reason || 'Confirmed by the head of distribution.',
    acknowledgeUnqualified: acknowledge,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.blockers?.length
        ? `${result.error} Blocking: ${result.blockers.join(' ')}`
        : result.error,
    };
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
  return { ok: true, message: 'Task assigned.' };
}

/** The assignee moves their own task along. */
export async function updateTaskProgressAction(
  taskId: string,
  status: 'IN_PROGRESS' | 'COMPLETED',
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertUser();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const assignment = await prisma.assignment.findFirst({
    where: { taskId, status: 'ACTIVE' },
    include: { coworker: { select: { userId: true } } },
  });

  const isAssignee = assignment?.coworker.userId === actor.id;
  const isDistributor = actor.role === 'HEAD_OF_DISTRIBUTION' || actor.role === 'PLATFORM_ADMIN';
  if (!isAssignee && !isDistributor) {
    return { ok: false, error: 'Only the assignee or a head of distribution can change this.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { status, completedAt: status === 'COMPLETED' ? new Date() : null },
    });
    if (assignment && status === 'COMPLETED') {
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
  });

  await recordAudit({
    actorId: actor.id,
    action: status === 'COMPLETED' ? 'task.completed' : 'task.started',
    entity: 'Task',
    entityId: taskId,
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { ok: true, message: status === 'COMPLETED' ? 'Task completed.' : 'Task started.' };
}
