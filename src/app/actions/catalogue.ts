'use server';

/**
 * The capability catalogue: skills and positions.
 *
 * A position is a named capability baseline — "Senior Electrical Technician"
 * means these skills at these levels. Creating one is a first-class action in
 * the product, so it gets a proper form, validation and an audit entry rather
 * than being a database chore.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertDistributor, AccessError } from '@/lib/server/permissions';
import { recordAudit } from '@/lib/server/audit';
import { positionSlugExists, skillSlugExists, uniqueSlug } from '@/lib/server/references';
import { NECESSITIES, SKILL_KINDS } from '@/lib/domain/enums';

export interface ActionState {
  ok: boolean;
  error?: string;
  field?: string;
  createdId?: string;
  message?: string;
}

const EMPTY: ActionState = { ok: false };

function fail(error: string, field?: string): ActionState {
  return { ok: false, error, field };
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const skillSchema = z.object({
  name: z.string().trim().min(2, 'Give the capability a name.').max(80, 'That name is too long.'),
  category: z.string().trim().max(60).default('General'),
  description: z.string().trim().max(600).optional(),
  kind: z.enum(SKILL_KINDS),
  expires: z.boolean(),
});

export async function createSkillAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return fail(error instanceof AccessError ? error.message : 'Something went wrong.');
  }

  const parsed = skillSchema.safeParse({
    name: formData.get('name'),
    category: formData.get('category') || 'General',
    description: formData.get('description') || undefined,
    kind: formData.get('kind') === 'CERTIFICATION' ? 'CERTIFICATION' : 'GRADED',
    expires: formData.get('expires') === 'on',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return fail(issue.message, String(issue.path[0] ?? ''));
  }

  const existing = await prisma.skill.findFirst({
    where: { name: { equals: parsed.data.name } },
  });
  if (existing) return fail('A capability with that name already exists.', 'name');

  const slug = await uniqueSlug(parsed.data.name, skillSlugExists);
  const skill = await prisma.skill.create({
    data: {
      slug,
      name: parsed.data.name,
      category: parsed.data.category || 'General',
      description: parsed.data.description ?? null,
      kind: parsed.data.kind,
      // Only a certification can meaningfully expire.
      expires: parsed.data.kind === 'CERTIFICATION' ? parsed.data.expires : false,
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'skill.created',
    entity: 'Skill',
    entityId: skill.id,
    data: { name: skill.name, kind: skill.kind },
  });

  revalidatePath('/skills');
  return { ok: true, createdId: skill.id, message: `${skill.name} added to the catalogue.` };
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

const positionSchema = z.object({
  title: z.string().trim().min(2, 'Give the position a title.').max(90, 'That title is too long.'),
  department: z.string().trim().max(60).default('General'),
  description: z.string().trim().max(1200).optional(),
  seniority: z.number().int().min(1).max(5),
});

/**
 * Read the repeating requirement rows from the form.
 *
 * The form posts `requirement_skill[]`, `requirement_level[]` and
 * `requirement_necessity[]` in matching order. A row with no skill selected is
 * simply skipped, so an empty extra row is not an error.
 */
function readRequirements(formData: FormData) {
  const skillIds = formData.getAll('requirement_skill').map(String);
  const levels = formData.getAll('requirement_level').map(String);
  const necessities = formData.getAll('requirement_necessity').map(String);
  const weights = formData.getAll('requirement_weight').map(String);

  const rows: {
    skillId: string;
    minLevel: number;
    necessity: string;
    weight: number;
  }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < skillIds.length; i += 1) {
    const skillId = skillIds[i]?.trim();
    if (!skillId) continue;
    if (seen.has(skillId)) continue; // the same capability twice is a no-op
    seen.add(skillId);

    const minLevel = Math.min(5, Math.max(0, Number.parseInt(levels[i] ?? '3', 10) || 0));
    const necessity = (NECESSITIES as readonly string[]).includes(necessities[i] ?? '')
      ? necessities[i]!
      : 'MANDATORY';
    const weight = Math.min(5, Math.max(1, Number.parseInt(weights[i] ?? '3', 10) || 3));

    rows.push({ skillId, minLevel, necessity, weight });
  }

  return rows;
}

export async function createPositionAction(
  _prev: ActionState = EMPTY,
  formData: FormData,
): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return fail(error instanceof AccessError ? error.message : 'Something went wrong.');
  }

  const parsed = positionSchema.safeParse({
    title: formData.get('title'),
    department: formData.get('department') || 'General',
    description: formData.get('description') || undefined,
    seniority: Number.parseInt(String(formData.get('seniority') ?? '3'), 10) || 3,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return fail(issue.message, String(issue.path[0] ?? ''));
  }

  const duplicate = await prisma.position.findFirst({
    where: { title: { equals: parsed.data.title }, archivedAt: null },
  });
  if (duplicate) return fail('A position with that title already exists.', 'title');

  const requirements = readRequirements(formData);

  // Verify every referenced capability exists before writing anything.
  if (requirements.length > 0) {
    const found = await prisma.skill.count({
      where: { id: { in: requirements.map((r) => r.skillId) } },
    });
    if (found !== requirements.length) {
      return fail('One of the selected capabilities no longer exists. Reload and try again.');
    }
  }

  const slug = await uniqueSlug(parsed.data.title, positionSlugExists);
  const position = await prisma.position.create({
    data: {
      slug,
      title: parsed.data.title,
      department: parsed.data.department || 'General',
      description: parsed.data.description ?? null,
      seniority: parsed.data.seniority,
      requirements: {
        create: requirements.map((r) => ({
          skillId: r.skillId,
          minLevel: r.minLevel,
          necessity: r.necessity,
        })),
      },
    },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'position.created',
    entity: 'Position',
    entityId: position.id,
    data: { title: position.title, requirementCount: requirements.length },
  });

  revalidatePath('/positions');
  return {
    ok: true,
    createdId: position.id,
    message: `${position.title} created with ${requirements.length} capability requirement${requirements.length === 1 ? '' : 's'}.`,
  };
}

export async function archivePositionAction(positionId: string): Promise<ActionState> {
  let actor;
  try {
    actor = await assertDistributor();
  } catch (error) {
    return fail(error instanceof AccessError ? error.message : 'Something went wrong.');
  }

  const holders = await prisma.coworker.count({ where: { positionId } });
  if (holders > 0) {
    return fail(
      `${holders} coworker${holders === 1 ? ' still holds' : 's still hold'} this position. Move them first.`,
    );
  }

  await prisma.position.update({ where: { id: positionId }, data: { archivedAt: new Date() } });
  await recordAudit({
    actorId: actor.id,
    action: 'position.archived',
    entity: 'Position',
    entityId: positionId,
  });

  revalidatePath('/positions');
  return { ok: true, message: 'Position archived.' };
}

export { readRequirements };
