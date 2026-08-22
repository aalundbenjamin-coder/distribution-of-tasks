/**
 * The distribution engine.
 *
 *   gate  →  score  →  rank  →  decide
 *
 * Two properties matter more than anything else here:
 *
 *  1. **Nobody unqualified is ever selected.** Selection only ever happens from
 *     `eligible`, which is produced by `evaluateGate` and cannot be influenced
 *     by any score.
 *
 *  2. **The same inputs always produce the same answer.** There is no randomness
 *     and no reliance on database row order: ties fall through a fixed cascade
 *     that ends at the coworker id, which is unique. Two coworkers with
 *     identical capabilities therefore resolve to a stated, repeatable reason —
 *     never to whoever happened to be listed first.
 *
 * When the top candidates really are indistinguishable and the folder is set to
 * STRICT, the engine refuses to guess and hands the decision to a human instead.
 * That refusal is the feature, not a failure.
 */

import { evaluateGate } from './eligibility';
import { ENGINE_VERSION, describeScore, poolStats, scoreCandidate } from './scoring';
import {
  DEFAULT_POLICY,
  type CandidateInput,
  type EvaluatedCandidate,
  type MatchPolicy,
  type MatchResult,
  type TaskInput,
} from './types';

/** Scores are compared at this precision so float noise never decides a tie. */
const SCORE_PRECISION = 6;

function quantise(score: number): number {
  const f = 10 ** SCORE_PRECISION;
  return Math.round(score * f) / f;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * The deterministic ordering used for eligible candidates.
 *
 * Returns < 0 when `a` should be ranked above `b`. Every step is total and the
 * final step compares unique ids, so the ordering is a strict total order: no
 * two distinct candidates can ever compare equal.
 */
export function compareCandidates(
  a: EvaluatedCandidate,
  b: EvaluatedCandidate,
  ca: CandidateInput,
  cb: CandidateInput,
  policy: MatchPolicy,
): number {
  // 1. Score, quantised.
  const scoreDiff = quantise(b.score) - quantise(a.score);
  if (scoreDiff !== 0) return scoreDiff;

  // 2. Policy-specific fairness rules, in the order the policy cares about.
  //
  // Both fairness policies consult *both* signals — current load and rotation
  // history — differing only in which they weigh first. Using every fair signal
  // available before falling through to an arbitrary identifier is the whole
  // point: "we picked Anna because her id sorts first" is a much worse answer
  // than "we picked Bo because he has waited three weeks and Anna two days",
  // and the second answer is available whenever the bookkeeping is.
  const load = (): number => {
    if (ca.openTaskCount !== cb.openTaskCount) return ca.openTaskCount - cb.openTaskCount;
    if (ca.committedHours !== cb.committedHours) return ca.committedHours - cb.committedHours;
    return 0;
  };
  const rotation = (): number => {
    // Never assigned counts as waiting the longest.
    const ta = ca.lastAssignedAt ? ca.lastAssignedAt.getTime() : -Infinity;
    const tb = cb.lastAssignedAt ? cb.lastAssignedAt.getTime() : -Infinity;
    if (ta !== tb) return ta - tb;
    if (ca.assignmentCount !== cb.assignmentCount) return ca.assignmentCount - cb.assignmentCount;
    return 0;
  };

  if (policy.tieBreak === 'BALANCED_LOAD') {
    const byLoad = load();
    if (byLoad !== 0) return byLoad;
    const byRotation = rotation();
    if (byRotation !== 0) return byRotation;
  } else if (policy.tieBreak === 'ROUND_ROBIN') {
    const byRotation = rotation();
    if (byRotation !== 0) return byRotation;
    const byLoad = load();
    if (byLoad !== 0) return byLoad;
  }

  // 3. More of the required capabilities signed off by a lead.
  const va = a.requirementFindings.filter((f) => f.necessity === 'MANDATORY' && f.verified).length;
  const vb = b.requirementFindings.filter((f) => f.necessity === 'MANDATORY' && f.verified).length;
  if (va !== vb) return vb - va;

  // 4. Higher total capability level across the required skills.
  const la = a.requirementFindings.reduce((s, f) => s + (f.held ?? 0), 0);
  const lb = b.requirementFindings.reduce((s, f) => s + (f.held ?? 0), 0);
  if (la !== lb) return lb - la;

  // 5. Absolute determinism. Ids are unique, so this never returns 0.
  return ca.coworkerId < cb.coworkerId ? -1 : ca.coworkerId > cb.coworkerId ? 1 : 0;
}

/** Human-readable explanation of which tie-break rule separated two candidates. */
function tieBreakReason(
  winner: CandidateInput,
  runnerUp: CandidateInput,
  winnerEval: EvaluatedCandidate,
  runnerUpEval: EvaluatedCandidate,
  policy: MatchPolicy,
  now: Date,
): string | undefined {
  if (quantise(winnerEval.score) !== quantise(runnerUpEval.score)) return undefined;

  const loadReason = (): string | undefined => {
    if (winner.openTaskCount !== runnerUp.openTaskCount) {
      return `Same score as ${runnerUp.fullName}; chosen because they carry ${winner.openTaskCount} open task${winner.openTaskCount === 1 ? '' : 's'} against ${runnerUp.openTaskCount}.`;
    }
    if (winner.committedHours !== runnerUp.committedHours) {
      return `Same score and task count as ${runnerUp.fullName}; chosen on the lighter committed load (${winner.committedHours} h against ${runnerUp.committedHours} h).`;
    }
    return undefined;
  };

  const rotationReason = (): string | undefined => {
    if ((winner.lastAssignedAt?.getTime() ?? -1) !== (runnerUp.lastAssignedAt?.getTime() ?? -1)) {
      if (!winner.lastAssignedAt) {
        return `Same score as ${runnerUp.fullName}; chosen because they have not been assigned a task yet.`;
      }
      const days = Math.round((now.getTime() - winner.lastAssignedAt.getTime()) / 86_400_000);
      return `Same score as ${runnerUp.fullName}; chosen because they have waited longer since their last task (${days} day${days === 1 ? '' : 's'}, against ${runnerUp.lastAssignedAt ? Math.round((now.getTime() - runnerUp.lastAssignedAt.getTime()) / 86_400_000) : 0}).`;
    }
    if (winner.assignmentCount !== runnerUp.assignmentCount) {
      return `Same score as ${runnerUp.fullName}; chosen on the lower lifetime assignment count (${winner.assignmentCount} against ${runnerUp.assignmentCount}).`;
    }
    return undefined;
  };

  if (policy.tieBreak === 'BALANCED_LOAD') {
    const reason = loadReason() ?? rotationReason();
    if (reason) return reason;
  }
  if (policy.tieBreak === 'ROUND_ROBIN') {
    const reason = rotationReason() ?? loadReason();
    if (reason) return reason;
  }

  const vw = winnerEval.requirementFindings.filter((f) => f.necessity === 'MANDATORY' && f.verified).length;
  const vr = runnerUpEval.requirementFindings.filter((f) => f.necessity === 'MANDATORY' && f.verified).length;
  if (vw !== vr) {
    return `Same score as ${runnerUp.fullName}; chosen on more lead-verified capabilities (${vw} against ${vr}).`;
  }

  const lw = winnerEval.requirementFindings.reduce((s, f) => s + (f.held ?? 0), 0);
  const lr = runnerUpEval.requirementFindings.reduce((s, f) => s + (f.held ?? 0), 0);
  if (lw !== lr) {
    return `Same score as ${runnerUp.fullName}; chosen on the higher combined capability level (${lw} against ${lr}).`;
  }

  return `Indistinguishable from ${runnerUp.fullName} on every ranking rule; separated only by a stable identifier tie-break.`;
}

export interface MatchOptions {
  now?: Date;
  policy?: Partial<MatchPolicy>;
}

/**
 * Run the full distribution decision for one task against a set of coworkers.
 *
 * The result is complete: it lists every candidate that was looked at, whether
 * they were eligible, and — for the ones that were not — exactly what stood in
 * the way.
 */
export function matchTask(
  task: TaskInput,
  candidates: CandidateInput[],
  options: MatchOptions = {},
): MatchResult {
  const now = options.now ?? new Date();
  const policy: MatchPolicy = { ...DEFAULT_POLICY, ...options.policy };

  // --- 1. Hard gate --------------------------------------------------------
  const gated = candidates.map((candidate) => ({
    candidate,
    gate: evaluateGate(task, candidate, now),
  }));

  const eligibleInputs = gated.filter((g) => g.gate.eligible).map((g) => g.candidate);
  const stats = poolStats(eligibleInputs);

  // --- 2. Score the survivors ---------------------------------------------
  const evaluated: { input: CandidateInput; result: EvaluatedCandidate }[] = gated.map(
    ({ candidate, gate }) => {
      const base: EvaluatedCandidate = {
        coworkerId: candidate.coworkerId,
        fullName: candidate.fullName,
        eligible: gate.eligible,
        blockers: gate.blockers,
        score: 0,
        factors: [],
        rank: null,
        requirementFindings: gate.findings,
        openTaskCount: candidate.openTaskCount,
        committedHours: candidate.committedHours,
        weeklyCapacityHours: candidate.weeklyCapacityHours,
      };

      if (!gate.eligible) return { input: candidate, result: base };

      const { score, factors } = scoreCandidate(
        task,
        candidate,
        gate.findings,
        gate.remainingHoursAfterTask,
        stats,
        now,
      );
      return { input: candidate, result: { ...base, score, factors } };
    },
  );

  // --- 3. Rank -------------------------------------------------------------
  const eligible = evaluated.filter((e) => e.result.eligible);
  eligible.sort((a, b) => compareCandidates(a.result, b.result, a.input, b.input, policy));
  eligible.forEach((e, index) => {
    e.result.rank = index + 1;
  });

  for (let i = 0; i < eligible.length - 1; i += 1) {
    const note = tieBreakReason(
      eligible[i].input,
      eligible[i + 1].input,
      eligible[i].result,
      eligible[i + 1].result,
      policy,
      now,
    );
    if (note) eligible[i].result.tieBreakNote = note;
  }

  const rejected = evaluated
    .filter((e) => !e.result.eligible)
    .sort((a, b) => a.result.fullName.localeCompare(b.result.fullName));

  const orderedCandidates = [...eligible.map((e) => e.result), ...rejected.map((e) => e.result)];

  // --- 4. Decide -----------------------------------------------------------
  const best = eligible[0]?.result ?? null;
  const runnerUp = eligible[1]?.result ?? null;

  if (!best) {
    const capacityOnly = rejected.filter(
      (r) => r.result.blockers.length > 0 && r.result.blockers.every((b) => b.code === 'NO_CAPACITY'),
    ).length;
    const summary =
      candidates.length === 0
        ? 'No coworkers were available to consider for this task.'
        : capacityOnly > 0
          ? `No coworker can take this task. ${capacityOnly} qualified coworker${capacityOnly === 1 ? ' is' : 's are'} at full capacity this week; the rest do not meet the requirements.`
          : `No coworker meets every requirement of this task. ${candidates.length} profile${candidates.length === 1 ? ' was' : 's were'} checked.`;
    return {
      outcome: 'NO_ELIGIBLE_CANDIDATE',
      summary,
      candidates: orderedCandidates,
      selected: null,
      tiedCandidates: [],
      autoAssignable: false,
      eligibleCount: 0,
      candidateCount: candidates.length,
      policy,
      engineVersion: ENGINE_VERSION,
      rationale: '',
    };
  }

  // Everyone within `tieEpsilon` of the leader is, for practical purposes,
  // equally qualified.
  const tied = eligible
    .filter((e) => quantise(best.score) - quantise(e.result.score) <= policy.tieEpsilon)
    .map((e) => e.result);

  const rationale = buildRationale(best, task, tied.length);

  if (best.score < policy.minimumScore) {
    return {
      outcome: 'BELOW_MINIMUM',
      summary: `The strongest qualified coworker, ${best.fullName}, scores ${pct(best.score)}, below this folder's ${pct(policy.minimumScore)} threshold. A head of distribution should confirm before the task goes out.`,
      candidates: orderedCandidates,
      selected: best,
      tiedCandidates: tied.length > 1 ? tied : [],
      autoAssignable: false,
      eligibleCount: eligible.length,
      candidateCount: candidates.length,
      policy,
      engineVersion: ENGINE_VERSION,
      rationale,
    };
  }

  if (policy.ambiguityPolicy === 'STRICT' && runnerUp && tied.length > 1 && policy.tieBreak === 'BEST_MATCH') {
    // Under BEST_MATCH there is no fairness rule to separate equals, so a
    // near-tie has no defensible winner. Ask a human rather than guess.
    return {
      outcome: 'AMBIGUOUS_TIE',
      summary: `${tied.length} coworkers are equally qualified for this task (within ${pct(policy.tieEpsilon)} of each other). This folder is set to ask a person rather than pick one.`,
      candidates: orderedCandidates,
      selected: null,
      tiedCandidates: tied,
      autoAssignable: false,
      eligibleCount: eligible.length,
      candidateCount: candidates.length,
      policy,
      engineVersion: ENGINE_VERSION,
      rationale,
    };
  }

  if (policy.routingMode === 'PROPOSE_ONLY') {
    return {
      outcome: 'PROPOSED',
      summary: `${best.fullName} is the strongest match at ${pct(best.score)}. This folder proposes rather than assigns, so a head of distribution confirms.`,
      candidates: orderedCandidates,
      selected: best,
      tiedCandidates: tied.length > 1 ? tied : [],
      autoAssignable: false,
      eligibleCount: eligible.length,
      candidateCount: candidates.length,
      policy,
      engineVersion: ENGINE_VERSION,
      rationale,
    };
  }

  return {
    outcome: 'ASSIGNED',
    summary: `${best.fullName} matched at ${pct(best.score)} out of ${eligible.length} qualified coworker${eligible.length === 1 ? '' : 's'}.`,
    candidates: orderedCandidates,
    selected: best,
    tiedCandidates: tied.length > 1 ? tied : [],
    autoAssignable: true,
    eligibleCount: eligible.length,
    candidateCount: candidates.length,
    policy,
    engineVersion: ENGINE_VERSION,
    rationale,
  };
}

function buildRationale(best: EvaluatedCandidate, task: TaskInput, tiedCount: number): string {
  const met = best.requirementFindings.filter((f) => f.met).length;
  const total = task.requirements.length;
  const parts = [
    `${best.fullName} scored ${pct(best.score)}`,
    total > 0 ? `meeting ${met} of ${total} listed capabilities` : 'with no capability requirements to check',
    describeScore(best.factors),
  ];
  let text = `${parts.join(', ')}.`;
  if (best.tieBreakNote) text += ` ${best.tieBreakNote}`;
  else if (tiedCount > 1) text += ` ${tiedCount - 1} other coworker${tiedCount - 1 === 1 ? ' was' : 's were'} within the tie band.`;
  return text;
}

export { ENGINE_VERSION };
