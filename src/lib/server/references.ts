/**
 * Human-facing identifiers.
 *
 * Task references (TSK-1042) come from a counter row updated inside a
 * transaction, so two people creating a task at the same moment cannot end up
 * with the same reference. Slugs are made unique by appending a suffix rather
 * than failing the user's save.
 */

import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma';

type Tx = Prisma.TransactionClient;

export async function nextTaskReference(tx: Tx): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { name: 'task' },
    create: { name: 'task', value: 1001 },
    update: { value: { increment: 1 } },
  });
  return `TSK-${counter.value}`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'oe')
    .replace(/[åÅ]/g, 'aa')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

/** A slug that is not taken yet, given a function that checks availability. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let n = 2; n < 200; n += 1) {
    const candidate = `${root}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export const positionSlugExists = async (slug: string) =>
  (await prisma.position.count({ where: { slug } })) > 0;

export const skillSlugExists = async (slug: string) =>
  (await prisma.skill.count({ where: { slug } })) > 0;

export const folderSlugExists = async (slug: string) =>
  (await prisma.taskFolder.count({ where: { slug } })) > 0;
