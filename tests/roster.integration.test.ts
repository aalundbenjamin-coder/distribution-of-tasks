/**
 * The demo roster, checked against the database it is seeded into.
 *
 * This data is what anyone looking at the app sees first, so the things that
 * make it look like a real organisation — a profile on every person, work that
 * stays attached to whoever did it, no two jobs wearing the same name — are
 * worth holding in place rather than rediscovering by eye before a demo.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { paletteFor } from '@/components/Portrait';

const db: PrismaClient = prisma;

beforeAll(async () => {
  if ((await db.coworker.count()) === 0) {
    throw new Error('The database is empty. Run `npm run db:seed` first.');
  }
});

describe('every colleague reads as a person', () => {
  it('has an education, a final project and something written about them', async () => {
    const coworkers = await db.coworker.findMany({ include: { user: { select: { fullName: true } } } });
    const bare = coworkers
      .filter((c) => !c.education || !c.school || !c.thesis || !c.bio)
      .map((c) => c.user.fullName);
    expect(bare).toEqual([]);
  });

  it('keeps the five from the presentation, with the portraits they were drawn with', async () => {
    const five = ['Sofie Lindgren', 'Freja Nilsen', 'Mikkel Dahl', 'Jonas Berg', 'Amira Haddad'];
    for (const fullName of five) {
      const coworker = await db.coworker.findFirst({ where: { user: { fullName } } });
      expect(coworker, `${fullName} is missing from the roster`).not.toBeNull();
      expect(coworker!.portrait).toBeTruthy();
      // A portrait key that no longer resolves would silently fall back to a
      // face derived from the name, and the slide and the app would diverge.
      expect(paletteFor(coworker!.portrait!)).not.toEqual(paletteFor(fullName));
    }
  });
});

describe('finished work stays attached to whoever did it', () => {
  it('gives most of the team something in their history', async () => {
    const withHistory = await db.coworker.count({
      where: { assignments: { some: { status: 'COMPLETED' } } },
    });
    expect(withHistory).toBeGreaterThanOrEqual(8);
  });

  it('records exactly one completed assignment against each completed task', async () => {
    const done = await db.task.findMany({
      where: { status: 'COMPLETED' },
      include: { assignments: true },
    });
    expect(done.length).toBeGreaterThan(0);
    for (const task of done) {
      const completed = task.assignments.filter((a) => a.status === 'COMPLETED');
      expect(completed, `${task.reference} has ${completed.length} completed assignments`).toHaveLength(1);
      expect(task.completedAt).not.toBeNull();
    }
  });

  it('never dates a task as finished before it was queued', async () => {
    const done = await db.task.findMany({ where: { status: 'COMPLETED' } });
    for (const task of done) {
      if (task.queuedAt && task.completedAt) {
        expect(task.completedAt.getTime(), task.reference).toBeGreaterThanOrEqual(task.queuedAt.getTime());
      }
    }
  });
});

describe('the task list can be read without ambiguity', () => {
  it('gives no two tasks the same title', async () => {
    // A completed job sharing a title with a queued one shows the same work
    // twice in the roster, once done and once waiting, and makes any lookup by
    // title — a person's or a test's — pick between them arbitrarily.
    const tasks = await db.task.findMany({ select: { title: true, reference: true } });
    const byTitle = new Map<string, string[]>();
    for (const t of tasks) byTitle.set(t.title, [...(byTitle.get(t.title) ?? []), t.reference]);
    expect([...byTitle].filter(([, refs]) => refs.length > 1)).toEqual([]);
  });

  it('gives no two tasks the same reference', async () => {
    const refs = await db.task.findMany({ select: { reference: true } });
    expect(new Set(refs.map((r) => r.reference)).size).toBe(refs.length);
  });

  it('numbers queued work above the work already finished', async () => {
    const number = (r: string) => Number(r.replace('TSK-', ''));
    const done = await db.task.findMany({ where: { status: 'COMPLETED' }, select: { reference: true } });
    const queued = await db.task.findMany({ where: { status: 'QUEUED' }, select: { reference: true } });
    if (done.length && queued.length) {
      expect(Math.min(...queued.map((t) => number(t.reference)))).toBeGreaterThan(
        Math.max(...done.map((t) => number(t.reference))),
      );
    }
  });
});

describe('every trade folder can actually receive work', () => {
  // A folder whose position nobody holds demos as "no qualified coworker",
  // which reads as a broken product in front of an audience. For each trade
  // folder, a probe task gated on the folder's default position and its
  // mandatory baseline must find at least one eligible person.
  const TRADE_FOLDERS = [
    'electrical-jobs',
    'masonry-jobs',
    'carpentry-jobs',
    'plumbing-sewer-jobs',
    'painting-jobs',
    'relining-jobs',
  ];

  it.each(TRADE_FOLDERS)('%s has someone the engine will accept', async (slug) => {
    const { previewMatch } = await import('@/lib/server/distribution');
    const folder = await db.taskFolder.findUnique({ where: { slug } });
    expect(folder, `folder ${slug} is missing`).not.toBeNull();
    expect(folder!.defaultPositionId, `${slug} has no default position`).not.toBeNull();

    const position = await db.position.findUnique({
      where: { id: folder!.defaultPositionId! },
      include: { requirements: { where: { necessity: 'MANDATORY' } } },
    });
    const head = await db.user.findFirst({ where: { role: 'HEAD_OF_DISTRIBUTION' } });

    const probe = await db.task.create({
      data: {
        reference: `TSK-PROBE-${slug}`,
        title: `Probe: ${slug}`,
        folderId: folder!.id,
        createdById: head!.id,
        status: 'QUEUED',
        queuedAt: new Date(),
        estimatedHours: 4,
        requiredPositionId: position!.id,
        requirements: {
          create: position!.requirements.map((r) => ({
            skillId: r.skillId,
            minLevel: r.minLevel,
            necessity: 'MANDATORY',
            weight: 3,
          })),
        },
      },
    });

    try {
      const preview = await previewMatch(probe.id);
      expect(preview!.result.eligibleCount, `${slug}: nobody qualifies`).toBeGreaterThanOrEqual(1);
      expect(preview!.result.selected?.fullName).toBeTruthy();
    } finally {
      await db.task.delete({ where: { id: probe.id } });
    }
  });
});
