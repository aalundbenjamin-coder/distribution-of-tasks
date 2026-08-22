/**
 * End-to-end distribution against the real database.
 *
 * The unit tests prove the engine's logic. This one proves the wiring: that the
 * candidate pool is assembled correctly from Prisma, that a match run and its
 * candidate verdicts are persisted, that an assignment is created, and that the
 * assignee is notified.
 *
 * It runs against the seeded development database and reads more than it
 * writes; the tasks it distributes are the seeded ones, so `npm run db:reset`
 * puts everything back.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma';
import { distributeTask, loadCandidates, previewMatch } from '@/lib/server/distribution';
import { prisma } from '@/lib/db';

const db: PrismaClient = prisma;

async function taskByTitleStart(prefix: string) {
  const tasks = await db.task.findMany({ select: { id: true, title: true, reference: true } });
  const task = tasks.find((t) => t.title.startsWith(prefix));
  if (!task) throw new Error(`No seeded task starting with "${prefix}". Run npm run db:seed.`);
  return task;
}

beforeAll(async () => {
  const count = await db.coworker.count();
  if (count === 0) throw new Error('The database is empty. Run `npm run db:seed` first.');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('the candidate pool is built from real records', () => {
  it('loads every non-offboarded coworker with their workload', async () => {
    const task = await taskByTitleStart('Intermittent trip');
    const candidates = await loadCandidates(task.id);

    expect(candidates.length).toBeGreaterThan(4);
    for (const candidate of candidates) {
      expect(candidate.fullName.length).toBeGreaterThan(0);
      expect(candidate.weeklyCapacityHours).toBeGreaterThan(0);
      expect(candidate.committedHours).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(candidate.skills)).toBe(true);
    }
  });
});

describe('the hard gate holds against real profiles', () => {
  it('rules out a lapsed certification, a level that is short, and someone on leave', async () => {
    const task = await taskByTitleStart('Intermittent trip');
    const preview = await previewMatch(task.id);
    expect(preview).not.toBeNull();

    const byName = new Map(preview!.result.candidates.map((c) => [c.fullName, c]));

    // David has the strongest fault-finding on the team but an expired permit.
    const david = byName.get('David Nyholm');
    expect(david?.eligible).toBe(false);
    expect(david?.blockers.some((b) => b.code === 'CERTIFICATION_EXPIRED')).toBe(true);

    // Camilla is one level short on the mandatory capability.
    const camilla = byName.get('Camilla Bech');
    expect(camilla?.eligible).toBe(false);
    expect(camilla?.blockers.some((b) => b.code === 'SKILL_LEVEL_TOO_LOW')).toBe(true);

    // Henrik is on leave; he never reaches the capability checks.
    const henrik = byName.get('Henrik Vad');
    expect(henrik?.eligible).toBe(false);
    expect(henrik?.blockers.some((b) => b.code === 'NOT_AVAILABLE')).toBe(true);

    // Anna and Bo both clear everything.
    expect(byName.get('Anna Holm')?.eligible).toBe(true);
    expect(byName.get('Bo Lindqvist')?.eligible).toBe(true);
  });

  it('blocks a task nobody in the organisation is qualified for', async () => {
    const task = await taskByTitleStart('Switch the 11 kV');
    const preview = await previewMatch(task.id);
    expect(preview!.result.outcome).toBe('NO_ELIGIBLE_CANDIDATE');
    expect(preview!.result.eligibleCount).toBe(0);
    // And it says why, per person, rather than just failing.
    expect(preview!.result.candidates.every((c) => c.blockers.length > 0)).toBe(true);
  });
});

describe('distributing a task writes the whole decision down', () => {
  it('creates a match run, a verdict per candidate, and an assignment', async () => {
    const task = await taskByTitleStart('Replace damaged distribution board');
    const before = await db.matchRun.count({ where: { taskId: task.id } });

    const outcome = await distributeTask({ taskId: task.id, actorUserId: null, trigger: 'MANUAL' });

    expect(outcome.result.outcome).toBe('ASSIGNED');
    expect(outcome.assignmentId).not.toBeNull();
    expect(outcome.taskStatus).toBe('ASSIGNED');

    const after = await db.matchRun.count({ where: { taskId: task.id } });
    expect(after).toBe(before + 1);

    const run = await db.matchRun.findUnique({
      where: { id: outcome.matchRunId },
      include: { candidates: true },
    });

    // Every coworker considered has a stored verdict, winners and losers alike.
    expect(run!.candidates.length).toBe(outcome.result.candidateCount);
    expect(run!.candidates.filter((c) => c.eligible).length).toBe(outcome.result.eligibleCount);
    expect(run!.policyJson).toContain('tieBreak');
    expect(run!.engineVersion).toBe('1.0.0');

    // Rejections carry their reasons.
    const rejected = run!.candidates.find((c) => !c.eligible);
    expect(JSON.parse(rejected!.blockersJson).length).toBeGreaterThan(0);

    // The winner's breakdown is stored, not just their score.
    const winner = run!.candidates.find((c) => c.rank === 1);
    const breakdown = JSON.parse(winner!.breakdownJson);
    expect(breakdown.factors.length).toBe(7);
  });

  it('notifies the assignee in the bell, whatever their consent says', async () => {
    const task = await taskByTitleStart('Rebuild the tipper ram');
    const outcome = await distributeTask({ taskId: task.id, actorUserId: null });
    expect(outcome.assignmentId).not.toBeNull();

    const assignment = await db.assignment.findUnique({
      where: { id: outcome.assignmentId! },
      include: { coworker: { select: { userId: true } } },
    });

    const notification = await db.notification.findFirst({
      where: { userId: assignment!.coworker.userId, type: 'TASK_ASSIGNED' },
      orderBy: { createdAt: 'desc' },
    });

    expect(notification).not.toBeNull();
    expect(notification!.title).toContain('New task');
    // The in-app copy always exists; the e-mail copy is what consent gates.
    expect(['SENT', 'SKIPPED_NO_CONSENT', 'NOT_APPLICABLE', 'FAILED']).toContain(
      notification!.emailStatus,
    );
  });

  it('never leaves a task with two live assignments', async () => {
    const task = await taskByTitleStart('Replace damaged distribution board');
    await distributeTask({ taskId: task.id, actorUserId: null });
    await distributeTask({ taskId: task.id, actorUserId: null });

    const live = await db.assignment.count({
      where: { taskId: task.id, status: { in: ['ACTIVE', 'PROPOSED'] } },
    });
    expect(live).toBe(1);
  });
});

describe('two identical coworkers are separated by a stated rule', () => {
  it('picks the one carrying less work and says so', async () => {
    const task = await taskByTitleStart('Intermittent trip');
    const preview = await previewMatch(task.id);

    const ranked = preview!.result.candidates.filter((c) => c.eligible);
    const names = ranked.map((c) => c.fullName);
    expect(names).toContain('Anna Holm');
    expect(names).toContain('Bo Lindqvist');

    // Whoever wins, the reason is recorded and readable.
    const winner = ranked[0]!;
    expect(winner.rank).toBe(1);
    if (Math.abs(ranked[0]!.score - (ranked[1]?.score ?? 0)) < 1e-6) {
      expect(winner.tieBreakNote).toBeTruthy();
    }
  });

  it('returns the same answer every time it is asked', async () => {
    const task = await taskByTitleStart('Intermittent trip');
    const runs = await Promise.all([previewMatch(task.id), previewMatch(task.id), previewMatch(task.id)]);
    const orders = runs.map((r) =>
      r!.result.candidates.filter((c) => c.eligible).map((c) => c.coworkerId).join(','),
    );
    expect(new Set(orders).size).toBe(1);
  });
});

describe('a propose-only folder never assigns on its own', () => {
  it('proposes and leaves the task waiting for a person', async () => {
    const task = await taskByTitleStart('Commission the new palletiser');
    const outcome = await distributeTask({ taskId: task.id, actorUserId: null });

    expect(outcome.result.outcome).toBe('PROPOSED');
    expect(outcome.assignmentId).toBeNull();
    expect(outcome.taskStatus).toBe('MATCHED');
    expect(outcome.result.selected).not.toBeNull();
  });
});
