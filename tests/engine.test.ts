import { describe, expect, it } from 'vitest';
import { matchTask } from '@/lib/matching/engine';
import type { CandidateInput } from '@/lib/matching/types';
import { NOW, coworker, req, skill, task } from './helpers';

const weldingTask = task({
  requirements: [req({ skillId: 'welding', skillName: 'Welding', minLevel: 3, weight: 5 })],
});

describe('an unqualified coworker is never selected', () => {
  it('refuses to assign when nobody meets the requirements', () => {
    const result = matchTask(weldingTask, [
      coworker('anna', { skills: [skill('welding', 2)] }),
      coworker('bo', { skills: [skill('painting', 5)] }),
    ], { now: NOW });

    expect(result.outcome).toBe('NO_ELIGIBLE_CANDIDATE');
    expect(result.selected).toBeNull();
    expect(result.autoAssignable).toBe(false);
    expect(result.eligibleCount).toBe(0);
    // Both are still reported, with reasons.
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((c) => !c.eligible && c.blockers.length > 0)).toBe(true);
  });

  it('picks the one qualified person out of a crowd of unqualified ones', () => {
    const result = matchTask(weldingTask, [
      coworker('anna', { skills: [skill('welding', 2)] }),
      coworker('bo', { skills: [skill('welding', 5)] }),
      coworker('cara', { skills: [] }),
      coworker('dan', { skills: [skill('welding', 4)], availability: 'ON_LEAVE' }),
    ], { now: NOW });

    expect(result.outcome).toBe('ASSIGNED');
    expect(result.selected?.coworkerId).toBe('bo');
    expect(result.eligibleCount).toBe(1);
  });

  it('never lets a high score rescue a failed requirement', () => {
    // "cara" is perfect on every soft factor but one level short on the hard one.
    const result = matchTask(
      task({ requirements: [req({ skillId: 'welding', minLevel: 4 })] }),
      [
        coworker('cara', {
          skills: [skill('welding', 3, { verified: true, yearsExperience: 20 })],
          openTaskCount: 0,
          committedHours: 0,
        }),
      ],
      { now: NOW },
    );
    expect(result.selected).toBeNull();
    expect(result.candidates[0].score).toBe(0);
  });

  it('distinguishes "at capacity" from "not qualified" in the summary', () => {
    const result = matchTask(
      task({ requirements: [req({ skillId: 'welding' })], estimatedHours: 10 }),
      [coworker('eve', { skills: [skill('welding', 4)], committedHours: 35 })],
      { now: NOW },
    );
    expect(result.outcome).toBe('NO_ELIGIBLE_CANDIDATE');
    expect(result.summary).toContain('full capacity');
  });
});

describe('ranking puts the strongest qualified coworker first', () => {
  it('prefers the higher capability level, all else equal', () => {
    const result = matchTask(weldingTask, [
      coworker('low', { skills: [skill('welding', 3)] }),
      coworker('high', { skills: [skill('welding', 5)] }),
    ], { now: NOW });
    expect(result.candidates[0].coworkerId).toBe('high');
    expect(result.candidates[0].rank).toBe(1);
    expect(result.candidates[1].rank).toBe(2);
    expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score);
  });

  it('prefers a verified capability over a self-declared one', () => {
    const result = matchTask(weldingTask, [
      coworker('declared', { skills: [skill('welding', 4)] }),
      coworker('verified', { skills: [skill('welding', 4, { verified: true })] }),
    ], { now: NOW });
    expect(result.selected?.coworkerId).toBe('verified');
  });

  it('rewards a preferred capability without ever requiring it', () => {
    const t = task({
      requirements: [
        req({ skillId: 'welding', minLevel: 3 }),
        req({ skillId: 'crane', minLevel: 3, necessity: 'PREFERRED' }),
      ],
    });
    const result = matchTask(t, [
      coworker('plain', { skills: [skill('welding', 4)] }),
      coworker('extra', { skills: [skill('welding', 4), skill('crane', 4)] }),
    ], { now: NOW });
    expect(result.selected?.coworkerId).toBe('extra');
    expect(result.eligibleCount).toBe(2); // "plain" is still qualified
  });

  it('spreads work: the lighter-loaded of two equals wins', () => {
    const result = matchTask(weldingTask, [
      coworker('busy', { skills: [skill('welding', 4)], openTaskCount: 6, committedHours: 24 }),
      coworker('free', { skills: [skill('welding', 4)], openTaskCount: 0, committedHours: 0 }),
    ], { now: NOW });
    expect(result.selected?.coworkerId).toBe('free');
  });

  it('reports the full factor breakdown for every eligible candidate', () => {
    const result = matchTask(weldingTask, [coworker('anna', { skills: [skill('welding', 4)] })], {
      now: NOW,
    });
    const keys = result.candidates[0].factors.map((f) => f.key).sort();
    expect(keys).toEqual([
      'capacityHeadroom',
      'contextFit',
      'deadlineFit',
      'experience',
      'skillFit',
      'verification',
      'workloadBalance',
    ]);
    // Every factor carries a sentence a person can read.
    expect(result.candidates[0].factors.every((f) => f.detail.length > 0)).toBe(true);
  });

  it('keeps every score inside 0-1', () => {
    const result = matchTask(
      task({
        requirements: [req({ skillId: 'welding', minLevel: 1 })],
        dueAt: new Date('2026-03-30T00:00:00Z'),
      }),
      [
        coworker('max', {
          skills: [skill('welding', 5, { verified: true, yearsExperience: 30 })],
          positionId: 'p1',
          positionTitle: 'Lead',
        }),
        coworker('min', { skills: [skill('welding', 1)], committedHours: 36 }),
      ],
      { now: NOW },
    );
    for (const c of result.candidates) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('two coworkers with identical capabilities', () => {
  const identical = (id: string, extra: Partial<CandidateInput> = {}) =>
    coworker(id, {
      skills: [skill('welding', 4, { verified: true, yearsExperience: 5 })],
      ...extra,
    });

  it('falls back on the identifier only when literally nothing else separates them', () => {
    const result = matchTask(weldingTask, [
      identical('anna', { openTaskCount: 3, lastAssignedAt: null, assignmentCount: 0 }),
      identical('bo', { openTaskCount: 3, lastAssignedAt: null, assignmentCount: 0 }),
    ], { now: NOW, policy: { tieBreak: 'BALANCED_LOAD', ambiguityPolicy: 'AUTO' } });

    expect(result.outcome).toBe('ASSIGNED');
    expect(result.selected).not.toBeNull();
    expect(result.selected?.tieBreakNote).toContain('stable identifier');
  });

  it('uses rotation history before the identifier when workloads are equal', () => {
    // Both carry the same live workload, so the load rule cannot separate them.
    // The system still knows who has waited longer, and should use that rather
    // than fall through to an arbitrary identifier.
    const result = matchTask(weldingTask, [
      identical('anna', { openTaskCount: 3, lastAssignedAt: new Date('2026-02-28T00:00:00Z'), assignmentCount: 14 }),
      identical('bo', { openTaskCount: 3, lastAssignedAt: new Date('2026-02-09T00:00:00Z'), assignmentCount: 9 }),
    ], { now: NOW, policy: { tieBreak: 'BALANCED_LOAD', ambiguityPolicy: 'AUTO' } });

    expect(result.selected?.coworkerId).toBe('bo');
    expect(result.selected?.tieBreakNote).toContain('waited longer');
    expect(result.selected?.tieBreakNote).not.toContain('stable identifier');
  });

  it('falls back to lifetime count when the last-assigned dates match', () => {
    const sameDay = new Date('2026-02-20T00:00:00Z');
    const result = matchTask(weldingTask, [
      identical('anna', { openTaskCount: 2, lastAssignedAt: sameDay, assignmentCount: 30 }),
      identical('bo', { openTaskCount: 2, lastAssignedAt: sameDay, assignmentCount: 4 }),
    ], { now: NOW, policy: { tieBreak: 'BALANCED_LOAD', ambiguityPolicy: 'AUTO' } });

    expect(result.selected?.coworkerId).toBe('bo');
    expect(result.selected?.tieBreakNote).toContain('lifetime assignment count');
  });

  it('separates unequal workloads on the score, before any tie-break runs', () => {
    // A tie-break only exists to settle equal scores. Different open workloads
    // already move the workload-balance factor, so the two are separated on
    // score and no tie-break note is produced. Both policies agree here.
    for (const tieBreak of ['BALANCED_LOAD', 'ROUND_ROBIN'] as const) {
      const result = matchTask(weldingTask, [
        identical('anna', { openTaskCount: 5, lastAssignedAt: new Date('2026-01-01T00:00:00Z') }),
        identical('bo', { openTaskCount: 1, lastAssignedAt: new Date('2026-03-01T00:00:00Z') }),
      ], { now: NOW, policy: { tieBreak, ambiguityPolicy: 'AUTO' } });

      expect(result.selected?.coworkerId).toBe('bo');
      expect(result.selected?.score).toBeGreaterThan(result.candidates[1]!.score);
      expect(result.selected?.tieBreakNote).toBeUndefined();
    }
  });

  it('ROUND_ROBIN puts rotation ahead of load once the scores tie', () => {
    // Equal live workload, so the scores tie and the tie-break decides. Anna has
    // waited two months, Bo one day.
    const result = matchTask(weldingTask, [
      identical('anna', { openTaskCount: 2, lastAssignedAt: new Date('2026-01-01T00:00:00Z') }),
      identical('bo', { openTaskCount: 2, lastAssignedAt: new Date('2026-03-01T00:00:00Z') }),
    ], { now: NOW, policy: { tieBreak: 'ROUND_ROBIN', ambiguityPolicy: 'AUTO' } });

    expect(result.selected?.coworkerId).toBe('anna');
    expect(result.selected?.tieBreakNote).toContain('waited longer');
  });

  it('differing committed hours are also settled on the score, not the tie-break', () => {
    // Committed hours feed the capacity-headroom factor, so two people carrying
    // different hours are separated before any tie-break is consulted. The
    // committed-hours rule in the cascade is a safety net for the rare case
    // where the hours differ but the headroom *ratio* does not.
    const sameDay = new Date('2026-02-20T00:00:00Z');
    const result = matchTask(weldingTask, [
      identical('anna', { openTaskCount: 2, committedHours: 18, lastAssignedAt: sameDay }),
      identical('bo', { openTaskCount: 2, committedHours: 6, lastAssignedAt: sameDay }),
    ], { now: NOW, policy: { tieBreak: 'ROUND_ROBIN', ambiguityPolicy: 'AUTO' } });

    expect(result.selected?.coworkerId).toBe('bo');
    expect(result.selected!.score).toBeGreaterThan(result.candidates[1]!.score);
  });

  it('falls back to verified capabilities when workload and rotation are identical', () => {
    // Everything the fairness rules look at is equal, so the cascade reaches the
    // next real signal: who has had more of the required capabilities signed off.
    const sameDay = new Date('2026-02-20T00:00:00Z');
    const base = { openTaskCount: 2, committedHours: 8, lastAssignedAt: sameDay, assignmentCount: 5 };
    const result = matchTask(weldingTask, [
      coworker('anna', { ...base, skills: [skill('welding', 4, { yearsExperience: 5 })] }),
      coworker('bo', { ...base, skills: [skill('welding', 4, { verified: true, yearsExperience: 5 })] }),
    ], { now: NOW, policy: { tieBreak: 'ROUND_ROBIN', ambiguityPolicy: 'AUTO' } });

    expect(result.selected?.coworkerId).toBe('bo');
  });

  it('picks the lighter-loaded one and explains why', () => {
    const result = matchTask(weldingTask, [
      identical('anna', { openTaskCount: 4, committedHours: 16 }),
      identical('bo', { openTaskCount: 2, committedHours: 16 }),
    ], { now: NOW, policy: { tieBreak: 'BALANCED_LOAD', ambiguityPolicy: 'AUTO' } });
    expect(result.selected?.coworkerId).toBe('bo');
  });

  it('rotates fairly under ROUND_ROBIN', () => {
    const result = matchTask(weldingTask, [
      identical('recent', { lastAssignedAt: new Date('2026-03-01T00:00:00Z') }),
      identical('waiting', { lastAssignedAt: new Date('2026-01-01T00:00:00Z') }),
    ], { now: NOW, policy: { tieBreak: 'ROUND_ROBIN', ambiguityPolicy: 'AUTO' } });
    expect(result.selected?.coworkerId).toBe('waiting');
    expect(result.selected?.tieBreakNote).toContain('waited longer');
  });

  it('treats a coworker who has never been assigned as waiting longest', () => {
    const result = matchTask(weldingTask, [
      identical('veteran', { lastAssignedAt: new Date('2026-01-01T00:00:00Z'), assignmentCount: 40 }),
      identical('newcomer', { lastAssignedAt: null, assignmentCount: 0 }),
    ], { now: NOW, policy: { tieBreak: 'ROUND_ROBIN', ambiguityPolicy: 'AUTO' } });
    expect(result.selected?.coworkerId).toBe('newcomer');
  });

  it('refuses to guess under BEST_MATCH + STRICT and asks a human instead', () => {
    const result = matchTask(weldingTask, [identical('anna'), identical('bo')], {
      now: NOW,
      policy: { tieBreak: 'BEST_MATCH', ambiguityPolicy: 'STRICT' },
    });
    expect(result.outcome).toBe('AMBIGUOUS_TIE');
    expect(result.selected).toBeNull();
    expect(result.autoAssignable).toBe(false);
    expect(result.tiedCandidates.map((c) => c.coworkerId).sort()).toEqual(['anna', 'bo']);
  });

  it('does assign under BEST_MATCH + AUTO', () => {
    const result = matchTask(weldingTask, [identical('anna'), identical('bo')], {
      now: NOW,
      policy: { tieBreak: 'BEST_MATCH', ambiguityPolicy: 'AUTO' },
    });
    expect(result.outcome).toBe('ASSIGNED');
    expect(result.selected).not.toBeNull();
  });

  it('is not treated as a tie when the scores are genuinely apart', () => {
    const result = matchTask(weldingTask, [
      identical('anna'),
      coworker('weak', { skills: [skill('welding', 3)] }),
    ], { now: NOW, policy: { tieBreak: 'BEST_MATCH', ambiguityPolicy: 'STRICT' } });
    expect(result.outcome).toBe('ASSIGNED');
    expect(result.selected?.coworkerId).toBe('anna');
  });
});

describe('determinism', () => {
  const pool = [
    coworker('anna', { skills: [skill('welding', 4, { verified: true })], openTaskCount: 2 }),
    coworker('bo', { skills: [skill('welding', 4, { verified: true })], openTaskCount: 2 }),
    coworker('cara', { skills: [skill('welding', 5)], openTaskCount: 2 }),
    coworker('dan', { skills: [skill('welding', 4, { verified: true })], openTaskCount: 2 }),
  ];

  it('produces the same ranking regardless of the order candidates arrive in', () => {
    const orders = [
      pool,
      [...pool].reverse(),
      [pool[2], pool[0], pool[3], pool[1]],
      [pool[1], pool[3], pool[2], pool[0]],
    ];
    const rankings = orders.map((order) =>
      matchTask(weldingTask, order, { now: NOW, policy: { ambiguityPolicy: 'AUTO' } })
        .candidates.filter((c) => c.eligible)
        .map((c) => c.coworkerId),
    );
    for (const ranking of rankings) {
      expect(ranking).toEqual(rankings[0]);
    }
  });

  it('produces the same selection when run repeatedly', () => {
    const picks = new Set(
      Array.from({ length: 25 }, () =>
        matchTask(weldingTask, pool, { now: NOW, policy: { ambiguityPolicy: 'AUTO' } }).selected
          ?.coworkerId,
      ),
    );
    expect(picks.size).toBe(1);
  });

  it('gives every eligible candidate a distinct rank', () => {
    const result = matchTask(weldingTask, pool, { now: NOW, policy: { ambiguityPolicy: 'AUTO' } });
    const ranks = result.candidates.filter((c) => c.eligible).map((c) => c.rank);
    expect(ranks).toEqual([1, 2, 3, 4]);
  });
});

describe('folder policy decides what happens next', () => {
  const good = [coworker('anna', { skills: [skill('welding', 5, { verified: true })] })];

  it('PROPOSE_ONLY never auto-assigns', () => {
    const result = matchTask(weldingTask, good, {
      now: NOW,
      policy: { routingMode: 'PROPOSE_ONLY' },
    });
    expect(result.outcome).toBe('PROPOSED');
    expect(result.selected?.coworkerId).toBe('anna');
    expect(result.autoAssignable).toBe(false);
  });

  it('AUTO_ASSIGN assigns the best candidate', () => {
    const result = matchTask(weldingTask, good, { now: NOW, policy: { routingMode: 'AUTO_ASSIGN' } });
    expect(result.outcome).toBe('ASSIGNED');
    expect(result.autoAssignable).toBe(true);
  });

  it('holds back a qualified but weak match below the folder minimum', () => {
    const result = matchTask(weldingTask, good, { now: NOW, policy: { minimumScore: 0.99 } });
    expect(result.outcome).toBe('BELOW_MINIMUM');
    expect(result.autoAssignable).toBe(false);
    expect(result.selected?.coworkerId).toBe('anna'); // still shown as the best option
  });

  it('records the policy that was in force on the result', () => {
    const result = matchTask(weldingTask, good, {
      now: NOW,
      policy: { tieEpsilon: 0.05, minimumScore: 0.4 },
    });
    expect(result.policy.tieEpsilon).toBe(0.05);
    expect(result.policy.minimumScore).toBe(0.4);
    expect(result.engineVersion).toBe('1.0.0');
  });
});

describe('the result explains itself', () => {
  it('writes a rationale naming the person and the score', () => {
    const result = matchTask(weldingTask, [
      coworker('anna', { fullName: 'Anna Holm', skills: [skill('welding', 5, { verified: true })] }),
    ], { now: NOW });
    expect(result.rationale).toContain('Anna Holm');
    expect(result.rationale).toMatch(/\d+%/);
  });

  it('lists rejected candidates after the ranked ones', () => {
    const result = matchTask(weldingTask, [
      coworker('zoe', { skills: [skill('welding', 1)] }),
      coworker('anna', { skills: [skill('welding', 4)] }),
    ], { now: NOW });
    expect(result.candidates[0].coworkerId).toBe('anna');
    expect(result.candidates[1].coworkerId).toBe('zoe');
    expect(result.candidates[1].rank).toBeNull();
  });

  it('handles an empty pool without crashing', () => {
    const result = matchTask(weldingTask, [], { now: NOW });
    expect(result.outcome).toBe('NO_ELIGIBLE_CANDIDATE');
    expect(result.candidateCount).toBe(0);
    expect(result.summary).toContain('No coworkers');
  });

  it('handles a task with no requirements at all', () => {
    const result = matchTask(task(), [coworker('anna')], { now: NOW });
    expect(result.outcome).toBe('ASSIGNED');
    expect(result.selected?.coworkerId).toBe('anna');
  });
});
