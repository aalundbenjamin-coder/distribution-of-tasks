/**
 * Ranking.
 *
 * Scoring runs only on candidates that already cleared the hard gate, so a
 * score can never let an unqualified person through. Its only job is to order
 * people who are *all* qualified, so the head of distribution can see who is
 * the strongest fit.
 *
 * Each factor produces a 0-1 value and carries a nominal weight. Factors that
 * cannot be judged for a given task (no deadline, no capability requirements)
 * are marked inapplicable and their weight is redistributed across the rest, so
 * a sparse task does not systematically score lower than a detailed one.
 */

import type {
  CandidateInput,
  FactorKey,
  RequirementFinding,
  ScoreFactor,
  TaskInput,
} from './types';
import { EN_MESSAGES, type EngineMessages } from './messages';

export const ENGINE_VERSION = '1.0.0';

/** Nominal weights. They sum to 1 before any redistribution. */
export const FACTOR_WEIGHTS: Record<FactorKey, number> = {
  skillFit: 0.4,
  verification: 0.12,
  experience: 0.1,
  capacityHeadroom: 0.12,
  workloadBalance: 0.14,
  deadlineFit: 0.07,
  contextFit: 0.05,
};

export const FACTOR_LABELS: Record<FactorKey, string> = {
  skillFit: 'Capability fit',
  verification: 'Verified capabilities',
  experience: 'Experience',
  capacityHeadroom: 'Capacity headroom',
  workloadBalance: 'Workload balance',
  deadlineFit: 'Deadline feasibility',
  contextFit: 'Position & department fit',
};

export const FACTOR_DESCRIPTIONS: Record<FactorKey, string> = {
  skillFit:
    'How far the coworker clears each required level, plus credit for preferred capabilities.',
  verification: 'Share of the required capabilities that a lead has signed off on.',
  experience: 'Years of hands-on experience in the required capabilities.',
  capacityHeadroom: 'How much of the working week is still free after taking this task.',
  workloadBalance: 'How this coworker’s open workload compares with the rest of the shortlist.',
  deadlineFit: 'Whether the free hours before the deadline comfortably cover the estimate.',
  contextFit: 'Whether the coworker’s position and department line up with the task.',
};

/** Working days a weekly capacity figure is spread over. */
const WORKING_DAYS_PER_WEEK = 5;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Fit for a single requirement, 0-1.
 *
 * Meeting the bar exactly is already a strong result (0.75); the remaining
 * quarter rewards surplus capability. Diminishing returns are deliberate — a
 * level-5 expert should win over a level-3 for a level-3 task, but not so
 * strongly that workload balance never gets a say.
 */
export function requirementFit(finding: RequirementFinding, isCertification: boolean): number {
  const held = finding.held ?? 0;
  if (isCertification) return finding.met ? 1 : 0;
  if (finding.met) {
    const room = 5 - finding.required;
    const surplus = room <= 0 ? 1 : clamp01((held - finding.required) / room);
    return 0.75 + 0.25 * surplus;
  }
  // Only reachable for PREFERRED requirements (mandatory misses are gated out).
  // Partial credit so "has some of it" beats "has none of it".
  if (held <= 0 || finding.required <= 0) return 0;
  return 0.3 * clamp01(held / finding.required);
}

interface PoolStats {
  /** Highest open-task count among eligible candidates; used to normalise balance. */
  maxOpenTaskCount: number;
  minOpenTaskCount: number;
}

export function poolStats(candidates: CandidateInput[]): PoolStats {
  if (candidates.length === 0) return { maxOpenTaskCount: 0, minOpenTaskCount: 0 };
  const counts = candidates.map((c) => c.openTaskCount);
  return { maxOpenTaskCount: Math.max(...counts), minOpenTaskCount: Math.min(...counts) };
}

export interface ScoreResult {
  score: number;
  factors: ScoreFactor[];
}

export function scoreCandidate(
  task: TaskInput,
  candidate: CandidateInput,
  findings: RequirementFinding[],
  remainingHoursAfterTask: number,
  stats: PoolStats,
  now: Date,
  m: EngineMessages = EN_MESSAGES,
): ScoreResult {
  const factors: ScoreFactor[] = [];
  const certById = new Map(task.requirements.map((r) => [r.skillId, r.skillKind === 'CERTIFICATION']));
  const weightById = new Map(task.requirements.map((r) => [r.skillId, r.weight]));
  const mandatory = findings.filter((f) => f.necessity === 'MANDATORY');

  // --- Capability fit ------------------------------------------------------
  if (findings.length > 0) {
    let weighted = 0;
    let totalWeight = 0;
    for (const finding of findings) {
      const isCert = certById.get(finding.skillId) ?? false;
      // Preferred requirements count, but less than mandatory ones.
      const w = (weightById.get(finding.skillId) ?? 3) * (finding.necessity === 'MANDATORY' ? 1 : 0.6);
      weighted += requirementFit(finding, isCert) * w;
      totalWeight += w;
    }
    const value = totalWeight > 0 ? clamp01(weighted / totalWeight) : 0;
    const surplusCount = findings.filter((f) => f.met && f.held !== null && f.held > f.required).length;
    factors.push({
      key: 'skillFit',
      label: m.factorLabels.skillFit,
      value,
      weight: FACTOR_WEIGHTS.skillFit,
      applicable: true,
      detail:
        surplusCount > 0
          ? m.detailSkillSurplus(surplusCount, findings.length)
          : m.detailSkillMet(findings.filter((f) => f.met).length, findings.length),
    });
  } else {
    factors.push({
      key: 'skillFit',
      label: m.factorLabels.skillFit,
      value: 0,
      weight: FACTOR_WEIGHTS.skillFit,
      applicable: false,
      detail: m.detailNoRequirements,
    });
  }

  // --- Verified capabilities ----------------------------------------------
  if (mandatory.length > 0) {
    const verified = mandatory.filter((f) => f.verified).length;
    factors.push({
      key: 'verification',
      label: m.factorLabels.verification,
      value: clamp01(verified / mandatory.length),
      weight: FACTOR_WEIGHTS.verification,
      applicable: true,
      detail: m.detailVerified(verified, mandatory.length),
    });
  } else {
    factors.push({
      key: 'verification',
      label: m.factorLabels.verification,
      value: 0,
      weight: FACTOR_WEIGHTS.verification,
      applicable: false,
      detail: m.detailNothingToVerify,
    });
  }

  // --- Experience ----------------------------------------------------------
  const requiredIds = new Set(task.requirements.map((r) => r.skillId));
  const relevant = candidate.skills.filter((s) => requiredIds.has(s.skillId));
  if (relevant.length > 0) {
    const avgYears = relevant.reduce((sum, s) => sum + s.yearsExperience, 0) / relevant.length;
    factors.push({
      key: 'experience',
      label: m.factorLabels.experience,
      value: clamp01(avgYears / 5),
      weight: FACTOR_WEIGHTS.experience,
      applicable: true,
      detail: m.detailExperience(fmtNum(round(avgYears, 1), m)),
    });
  } else {
    factors.push({
      key: 'experience',
      label: m.factorLabels.experience,
      value: 0,
      weight: FACTOR_WEIGHTS.experience,
      applicable: false,
      detail: m.detailNoOverlap,
    });
  }

  // --- Capacity headroom ---------------------------------------------------
  const capacity = candidate.weeklyCapacityHours > 0 ? candidate.weeklyCapacityHours : 1;
  const headroom = clamp01(remainingHoursAfterTask / capacity);
  factors.push({
    key: 'capacityHeadroom',
    label: m.factorLabels.capacityHeadroom,
    value: headroom,
    weight: FACTOR_WEIGHTS.capacityHeadroom,
    applicable: true,
    detail: m.detailCapacity(fmtNum(round(Math.max(0, remainingHoursAfterTask), 1), m), fmtNum(round(capacity, 1), m)),
  });

  // --- Workload balance (relative to the shortlist) ------------------------
  // Everyone on the shortlist is qualified, so spreading work evenly is a
  // legitimate way to separate them — and it is what stops one strong coworker
  // from absorbing every task.
  if (stats.maxOpenTaskCount > 0) {
    const value = clamp01(1 - candidate.openTaskCount / stats.maxOpenTaskCount);
    factors.push({
      key: 'workloadBalance',
      label: m.factorLabels.workloadBalance,
      value,
      weight: FACTOR_WEIGHTS.workloadBalance,
      applicable: true,
      detail: m.detailWorkload(candidate.openTaskCount, stats.maxOpenTaskCount),
    });
  } else {
    factors.push({
      key: 'workloadBalance',
      label: m.factorLabels.workloadBalance,
      value: 1,
      weight: FACTOR_WEIGHTS.workloadBalance,
      applicable: true,
      detail: m.detailNobodyBusy,
    });
  }

  // --- Deadline feasibility ------------------------------------------------
  if (task.dueAt) {
    const msLeft = task.dueAt.getTime() - now.getTime();
    if (msLeft <= 0) {
      factors.push({
        key: 'deadlineFit',
        label: m.factorLabels.deadlineFit,
        value: 0,
        weight: FACTOR_WEIGHTS.deadlineFit,
        applicable: true,
        detail: m.detailDeadlinePassed,
      });
    } else {
      const daysLeft = msLeft / 86_400_000;
      // Free hours per working day, projected over the working days that are
      // left. Capped at one week because the capacity figure is weekly.
      const dailyFree = Math.max(0, capacity - candidate.committedHours) / WORKING_DAYS_PER_WEEK;
      const hoursAvailable = dailyFree * Math.min(daysLeft, WORKING_DAYS_PER_WEEK);
      const feasible = task.estimatedHours <= 0 ? 1 : clamp01(hoursAvailable / task.estimatedHours);
      factors.push({
        key: 'deadlineFit',
        label: m.factorLabels.deadlineFit,
        value: feasible,
        weight: FACTOR_WEIGHTS.deadlineFit,
        applicable: true,
        detail: m.detailDeadline(fmtNum(round(hoursAvailable, 1), m), task.estimatedHours),
      });
    }
  } else {
    factors.push({
      key: 'deadlineFit',
      label: FACTOR_LABELS.deadlineFit,
      value: 0,
      weight: FACTOR_WEIGHTS.deadlineFit,
      applicable: false,
      detail: m.detailNoDeadline,
    });
  }

  // --- Position & department fit -------------------------------------------
  // Not a gate: a task without a required position can still prefer someone
  // whose position and department line up with where the work sits.
  const positionMatches = task.requiredPositionId
    ? candidate.positionId === task.requiredPositionId
    : null;
  const departmentMatches = task.requiredDepartment
    ? candidate.department.trim().toLowerCase() === task.requiredDepartment.trim().toLowerCase()
    : null;
  const signals = [positionMatches, departmentMatches].filter((v) => v !== null) as boolean[];
  if (signals.length > 0) {
    const value = signals.filter(Boolean).length / signals.length;
    factors.push({
      key: 'contextFit',
      label: m.factorLabels.contextFit,
      value,
      weight: FACTOR_WEIGHTS.contextFit,
      applicable: true,
      detail: m.detailContext(candidate.positionTitle ?? m.noPosition, candidate.department),
    });
  } else {
    factors.push({
      key: 'contextFit',
      label: m.factorLabels.contextFit,
      value: candidate.positionId ? 1 : 0.5,
      weight: FACTOR_WEIGHTS.contextFit,
      applicable: true,
      detail: candidate.positionId
        ? m.detailHoldsPosition(candidate.positionTitle ?? '')
        : m.detailNoPositionYet,
    });
  }

  // --- Combine -------------------------------------------------------------
  const applicable = factors.filter((f) => f.applicable);
  const totalWeight = applicable.reduce((sum, f) => sum + f.weight, 0);
  const score =
    totalWeight > 0
      ? round(clamp01(applicable.reduce((sum, f) => sum + f.value * f.weight, 0) / totalWeight), 6)
      : 0;

  return { score, factors };
}

/** Formats a number the way the reader's language writes it. */
function fmtNum(value: number, m: EngineMessages): string {
  return value.toLocaleString(m.locale === 'da' ? 'da-DK' : 'en-GB', { maximumFractionDigits: 1 });
}

/** Short sentence describing the biggest contributors to a score. */
export function describeScore(factors: ScoreFactor[], m: EngineMessages = EN_MESSAGES): string {
  const applicable = factors.filter((f) => f.applicable);
  const totalWeight = applicable.reduce((sum, f) => sum + f.weight, 0) || 1;
  const ranked = [...applicable]
    .map((f) => ({ ...f, contribution: (f.value * f.weight) / totalWeight }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);
  if (ranked.length === 0) return m.noComparableFactors;
  return ranked.map((f) => m.describeFactor(f.label, Math.round(f.value * 100))).join(', ');
}

export { clamp01, round, WORKING_DAYS_PER_WEEK };
