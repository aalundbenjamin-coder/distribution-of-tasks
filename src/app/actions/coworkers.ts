'use server';

/**
 * Coworker profiles: the capability records the whole system rests on.
 *
 * Accuracy here is what makes distribution safe, so two rules are enforced:
 * a coworker can describe their own capabilities but cannot mark them
 * verified, and only a lead can sign one off. That keeps "verified" meaning
 * something in the ranking.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  AccessError,
  assertDistributor,
  assertUser,
  canVerifySkills,
} from '@/lib/server/permissions';
import { recordAudit } from '@/lib/server/audit';
import { notify } from '@/lib/notifications/dispatch';
import { AVAILABILITIES } from '@/lib/domain/enums';
import type { ActionState } from './catalogue';

const EMPTY: ActionState = { ok: false };

function denied(error: unknown): ActionState {
  return { ok: false, error: error instanceof AccessError ? error.message : 'Something went wrong.' };
}

/** May this user edit that coworker profile? Yourself, or a lead. */
async function assertCanEdit(coworkerId: string) {
  const actor = await assertUser();
  const coworker = await prisma.coworker.findUnique({
    where: { id: coworkerId },
    select: { userId: true },
  });
  if (!coworker) throw new AccessError('That profile no longer exists.');
  const isSelf = coworker.userId === actor.id;
  if (!isSelf && !canVerifySkills(actor.role)) {
    throw new AccessError('You can only change your own profile.');
  }
  return { actor, isSelf };
}

const profileSchema = z.object({
  department: z.string().trim().max(60),
  positionId: z.string().trim().optional(),
  availability: z.enum(AVAILABILITIES),
  weeklyCapacityHours: z.number().min(0).max(80),
  languages: z.string().trim().max(80),
  timezone: z.string().trim().max(60),
  notes: z.string().trim().max(2000).optional(),
  employeeNumber: z.string().trim().max(40).optional(),
});

export async function updateCoworkerProfileAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  const coworkerId = String(formData.get('coworkerId') ?? '');
  let actor;
  try {
    ({ actor } = await assertCanEdit(coworkerId));
  } catch (error) {
    return denied(error);
  }

  const parsed = profileSchema.safeParse({
    department: String(formData.get('department') ?? 'General'),
    positionId: formData.get('positionId') || undefined,
    availability: String(formData.get('availability') ?? 'ACTIVE'),
    weeklyCapacityHours: Number.parseFloat(String(formData.get('weeklyCapacityHours') ?? '37')),
    languages: String(formData.get('languages') ?? 'en'),
    timezone: String(formData.get('timezone') ?? 'Europe/Copenhagen'),
    notes: formData.get('notes') || undefined,
    employeeNumber: formData.get('employeeNumber') || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? '') };
  }

  const data = parsed.data;
  const rawFrom = String(formData.get('availableFrom') ?? '').trim();
  const rawUntil = String(formData.get('availableUntil') ?? '').trim();

  await prisma.coworker.update({
    where: { id: coworkerId },
    data: {
      department: data.department || 'General',
      positionId: data.positionId || null,
      availability: data.availability,
      weeklyCapacityHours: data.weeklyCapacityHours,
      // Normalised to lower-case ISO codes so the language gate compares cleanly.
      languages: data.languages
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean)
        .join(','),
      timezone: data.timezone || 'Europe/Copenhagen',
      notes: data.notes ?? null,
      employeeNumber: data.employeeNumber || null,
      availableFrom: rawFrom ? new Date(`${rawFrom}T00:00:00`) : null,
      availableUntil: rawUntil ? new Date(`${rawUntil}T23:59:59`) : null,
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'coworker.profile_updated',
    entity: 'Coworker',
    entityId: coworkerId,
    data: { availability: data.availability, capacity: data.weeklyCapacityHours },
  });

  revalidatePath(`/coworkers/${coworkerId}`);
  revalidatePath('/coworkers');
  return { ok: true, message: 'Profile saved. It applies to the next distribution.' };
}

const skillSchema = z.object({
  skillId: z.string().trim().min(1, 'Choose a capability.'),
  level: z.number().int().min(0).max(5),
  yearsExperience: z.number().min(0).max(60),
});

export async function upsertCoworkerSkillAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  const coworkerId = String(formData.get('coworkerId') ?? '');
  let actor;
  let isSelf: boolean;
  try {
    ({ actor, isSelf } = await assertCanEdit(coworkerId));
  } catch (error) {
    return denied(error);
  }

  const parsed = skillSchema.safeParse({
    skillId: formData.get('skillId'),
    level: Number.parseInt(String(formData.get('level') ?? '3'), 10),
    yearsExperience: Number.parseFloat(String(formData.get('yearsExperience') ?? '0')) || 0,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? '') };
  }

  const skill = await prisma.skill.findUnique({ where: { id: parsed.data.skillId } });
  if (!skill) return { ok: false, error: 'That capability no longer exists.', field: 'skillId' };

  const rawExpiry = String(formData.get('expiresAt') ?? '').trim();
  if (skill.expires && !rawExpiry) {
    return {
      ok: false,
      field: 'expiresAt',
      error: `${skill.name} expires, so it needs a valid-until date.`,
    };
  }

  // Only a lead may set the verified flag, and only when editing someone else.
  const wantsVerified = formData.get('verified') === 'on';
  const mayVerify = canVerifySkills(actor.role) && !isSelf;
  const verified = mayVerify ? wantsVerified : false;

  const existing = await prisma.coworkerSkill.findUnique({
    where: { coworkerId_skillId: { coworkerId, skillId: skill.id } },
  });

  // A self-edit must not silently drop a verification a lead granted earlier,
  // but changing the level does invalidate it — it was signed off at the old
  // level, not the new one.
  const keepVerification =
    !mayVerify && existing?.verified === true && existing.level === parsed.data.level;

  await prisma.coworkerSkill.upsert({
    where: { coworkerId_skillId: { coworkerId, skillId: skill.id } },
    create: {
      coworkerId,
      skillId: skill.id,
      level: parsed.data.level,
      yearsExperience: parsed.data.yearsExperience,
      verified,
      verifiedById: verified ? actor.id : null,
      verifiedAt: verified ? new Date() : null,
      expiresAt: rawExpiry ? new Date(`${rawExpiry}T23:59:59`) : null,
      evidence: String(formData.get('evidence') ?? '').trim() || null,
    },
    update: {
      level: parsed.data.level,
      yearsExperience: parsed.data.yearsExperience,
      verified: mayVerify ? verified : keepVerification,
      verifiedById: mayVerify ? (verified ? actor.id : null) : existing?.verifiedById ?? null,
      verifiedAt: mayVerify ? (verified ? new Date() : null) : existing?.verifiedAt ?? null,
      expiresAt: rawExpiry ? new Date(`${rawExpiry}T23:59:59`) : null,
      evidence: String(formData.get('evidence') ?? '').trim() || null,
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: existing ? 'coworker.skill_updated' : 'coworker.skill_added',
    entity: 'Coworker',
    entityId: coworkerId,
    data: { skill: skill.name, level: parsed.data.level, verified: mayVerify ? verified : keepVerification },
  });

  if (mayVerify && verified && !existing?.verified) {
    const coworker = await prisma.coworker.findUnique({
      where: { id: coworkerId },
      select: { userId: true },
    });
    if (coworker) {
      await notify({
        userId: coworker.userId,
        type: 'SKILL_VERIFIED',
        title: `${skill.name} verified`,
        body: `${actor.fullName} signed off your ${skill.name} at level ${parsed.data.level}. Verified capabilities rank higher when work is distributed.`,
        link: `/coworkers/${coworkerId}`,
        severity: 'SUCCESS',
      });
    }
  }

  revalidatePath(`/coworkers/${coworkerId}`);
  return {
    ok: true,
    message: existing ? `${skill.name} updated.` : `${skill.name} added to the profile.`,
  };
}

export async function removeCoworkerSkillAction(
  coworkerId: string,
  skillId: string,
): Promise<ActionState> {
  let actor;
  try {
    ({ actor } = await assertCanEdit(coworkerId));
  } catch (error) {
    return denied(error);
  }

  await prisma.coworkerSkill.deleteMany({ where: { coworkerId, skillId } });
  await recordAudit({
    actorId: actor.id,
    action: 'coworker.skill_removed',
    entity: 'Coworker',
    entityId: coworkerId,
    data: { skillId },
  });

  revalidatePath(`/coworkers/${coworkerId}`);
  return { ok: true, message: 'Capability removed.' };
}

/**
 * Give a user a work profile so they can receive tasks.
 *
 * A person can have an account without being in the distribution pool — this is
 * the step that puts them in it.
 */
export async function createCoworkerProfileAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return denied(error);
  }

  const userId = String(formData.get('userId') ?? '');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { coworker: { select: { id: true } } },
  });
  if (!user) return { ok: false, error: 'That account no longer exists.' };
  if (user.coworker) return { ok: false, error: 'That person already has a work profile.' };

  const positionId = String(formData.get('positionId') ?? '') || null;
  const position = positionId
    ? await prisma.position.findUnique({
        where: { id: positionId },
        include: { requirements: true },
      })
    : null;

  const coworker = await prisma.coworker.create({
    data: {
      userId,
      positionId: position?.id ?? null,
      department: String(formData.get('department') ?? '') || position?.department || 'General',
      weeklyCapacityHours: Number.parseFloat(String(formData.get('weeklyCapacityHours') ?? '37')) || 37,
      languages: String(formData.get('languages') ?? 'en')
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean)
        .join(','),
      // The position's baseline is seeded as a starting point, unverified: it
      // says what the role expects, not what this person has proven.
      skills: position
        ? {
            create: position.requirements.map((r) => ({
              skillId: r.skillId,
              level: r.minLevel,
              verified: false,
            })),
          }
        : undefined,
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'coworker.created',
    entity: 'Coworker',
    entityId: coworker.id,
    data: { userId, positionId: position?.id ?? null },
  });

  await notify({
    userId,
    type: 'PROFILE_CREATED',
    title: 'You are now in the distribution pool',
    body: position
      ? `Your profile was set up as ${position.title}. Check that the capability levels are right — they decide which work reaches you.`
      : 'Your work profile was created. Add your capabilities so tasks can be matched to you.',
    link: `/coworkers/${coworker.id}`,
    severity: 'INFO',
  });

  revalidatePath('/coworkers');
  return { ok: true, createdId: coworker.id, message: `${user.fullName} added to the pool.` };
}
