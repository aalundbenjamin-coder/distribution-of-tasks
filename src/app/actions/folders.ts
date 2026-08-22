'use server';

/**
 * Distribution folders.
 *
 * A folder is where a head of distribution drops work, and it carries the
 * routing policy for that kind of work: who may take it, how ties are settled,
 * whether the system may assign on its own, and how weak a match it is allowed
 * to accept. Setting the policy once on the folder is what makes distributing
 * the hundredth task as quick as distributing the first.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AccessError, assertDistributor } from '@/lib/server/permissions';
import { recordAudit } from '@/lib/server/audit';
import { folderSlugExists, uniqueSlug } from '@/lib/server/references';
import { AMBIGUITY_POLICIES, ROUTING_MODES, TIE_BREAKS } from '@/lib/domain/enums';
import type { ActionState } from './catalogue';

const EMPTY: ActionState = { ok: false };

const folderSchema = z.object({
  name: z.string().trim().min(2, 'Give the folder a name.').max(80, 'That name is too long.'),
  description: z.string().trim().max(600).optional(),
  department: z.string().trim().max(60).default('General'),
  defaultPositionId: z.string().trim().optional(),
  routingMode: z.enum(ROUTING_MODES),
  tieBreak: z.enum(TIE_BREAKS),
  ambiguityPolicy: z.enum(AMBIGUITY_POLICIES),
  tieEpsilon: z.number().min(0).max(0.5),
  minimumScore: z.number().min(0).max(1),
});

function parsePercent(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return n / 100;
}

export async function createFolderAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const parsed = folderSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    department: formData.get('department') || 'General',
    defaultPositionId: formData.get('defaultPositionId') || undefined,
    routingMode: formData.get('routingMode') === 'PROPOSE_ONLY' ? 'PROPOSE_ONLY' : 'AUTO_ASSIGN',
    tieBreak: String(formData.get('tieBreak') ?? 'BALANCED_LOAD'),
    ambiguityPolicy: formData.get('ambiguityPolicy') === 'AUTO' ? 'AUTO' : 'STRICT',
    tieEpsilon: parsePercent(formData.get('tieEpsilon'), 0.02),
    minimumScore: parsePercent(formData.get('minimumScore'), 0.5),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? '') };
  }

  const data = parsed.data;
  const slug = await uniqueSlug(data.name, folderSlugExists);

  const folder = await prisma.taskFolder.create({
    data: {
      slug,
      name: data.name,
      description: data.description ?? null,
      department: data.department || 'General',
      ownerId: actor.id,
      defaultPositionId: data.defaultPositionId || null,
      routingMode: data.routingMode,
      tieBreak: data.tieBreak,
      ambiguityPolicy: data.ambiguityPolicy,
      tieEpsilon: data.tieEpsilon,
      minimumScore: data.minimumScore,
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'folder.created',
    entity: 'TaskFolder',
    entityId: folder.id,
    data: { name: folder.name, routingMode: folder.routingMode },
  });

  revalidatePath('/folders');
  return { ok: true, createdId: folder.id, message: `${folder.name} is ready for work.` };
}

export async function updateFolderPolicyAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
  }

  const folderId = String(formData.get('folderId') ?? '');
  const folder = await prisma.taskFolder.findUnique({ where: { id: folderId } });
  if (!folder) return { ok: false, error: 'That folder no longer exists.' };

  const before = {
    routingMode: folder.routingMode,
    tieBreak: folder.tieBreak,
    ambiguityPolicy: folder.ambiguityPolicy,
    tieEpsilon: folder.tieEpsilon,
    minimumScore: folder.minimumScore,
  };

  const updated = await prisma.taskFolder.update({
    where: { id: folderId },
    data: {
      routingMode: formData.get('routingMode') === 'PROPOSE_ONLY' ? 'PROPOSE_ONLY' : 'AUTO_ASSIGN',
      tieBreak: (TIE_BREAKS as readonly string[]).includes(String(formData.get('tieBreak')))
        ? String(formData.get('tieBreak'))
        : 'BALANCED_LOAD',
      ambiguityPolicy: formData.get('ambiguityPolicy') === 'AUTO' ? 'AUTO' : 'STRICT',
      tieEpsilon: parsePercent(formData.get('tieEpsilon'), folder.tieEpsilon),
      minimumScore: parsePercent(formData.get('minimumScore'), folder.minimumScore),
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'folder.policy_changed',
    entity: 'TaskFolder',
    entityId: folderId,
    data: {
      before,
      after: {
        routingMode: updated.routingMode,
        tieBreak: updated.tieBreak,
        ambiguityPolicy: updated.ambiguityPolicy,
        tieEpsilon: updated.tieEpsilon,
        minimumScore: updated.minimumScore,
      },
    },
  });

  revalidatePath(`/folders/${folderId}`);
  return { ok: true, message: 'Routing policy updated. It applies to the next distribution.' };
}
