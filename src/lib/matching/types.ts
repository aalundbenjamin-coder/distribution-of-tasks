/**
 * Inputs and outputs of the matching engine.
 *
 * The engine is deliberately pure: it takes plain data, returns plain data, and
 * touches neither the database nor the clock. `now` is passed in. That makes
 * every routing decision reproducible — the same inputs always produce the same
 * assignment, which is what "no misdirection" requires.
 */

import type {
  AmbiguityPolicy,
  Availability,
  MatchOutcome,
  Necessity,
  RoutingMode,
  SkillKind,
  TaskPriority,
  TieBreak,
} from '@/lib/domain/enums';

/** One capability a task asks for. */
export interface RequirementInput {
  skillId: string;
  skillName: string;
  skillKind: SkillKind;
  /** Minimum graded level 0-5. Ignored for certifications (held / not held). */
  minLevel: number;
  necessity: Necessity;
  /** Relative importance inside the ranking, 1-5. */
  weight: number;
}

/** One capability a coworker holds. */
export interface HeldSkillInput {
  skillId: string;
  level: number;
  verified: boolean;
  yearsExperience: number;
  /** Certifications only. A date in the past means the certification lapsed. */
  expiresAt: Date | null;
}

export interface CandidateInput {
  coworkerId: string;
  fullName: string;
  positionId: string | null;
  positionTitle: string | null;
  department: string;
  availability: Availability;
  availableFrom: Date | null;
  availableUntil: Date | null;
  weeklyCapacityHours: number;
  /** Estimated hours already committed through open assignments. */
  committedHours: number;
  /** Number of open assignments. Used for load balancing. */
  openTaskCount: number;
  /** ISO-639-1 codes the coworker speaks. */
  languages: string[];
  timezone: string;
  skills: HeldSkillInput[];
  lastAssignedAt: Date | null;
  assignmentCount: number;
  /** Set when a TaskExclusion forbids this pairing. */
  exclusionReason?: string | null;
}

export interface TaskInput {
  taskId: string;
  reference: string;
  title: string;
  priority: TaskPriority;
  estimatedHours: number;
  dueAt: Date | null;
  requirements: RequirementInput[];
  requiredPositionId: string | null;
  requiredPositionTitle: string | null;
  requiredLanguages: string[];
  requiredDepartment: string;
}

export interface MatchPolicy {
  routingMode: RoutingMode;
  tieBreak: TieBreak;
  /** Score distance under which two candidates count as tied. */
  tieEpsilon: number;
  ambiguityPolicy: AmbiguityPolicy;
  /** A candidate scoring below this is never assigned automatically. */
  minimumScore: number;
}

export const DEFAULT_POLICY: MatchPolicy = {
  routingMode: 'AUTO_ASSIGN',
  tieBreak: 'BALANCED_LOAD',
  tieEpsilon: 0.02,
  ambiguityPolicy: 'STRICT',
  minimumScore: 0.5,
};

/** Machine-readable reason a candidate was excluded from consideration. */
export type BlockerCode =
  | 'NOT_AVAILABLE'
  | 'OUTSIDE_AVAILABILITY_WINDOW'
  | 'EXPLICITLY_EXCLUDED'
  | 'WRONG_POSITION'
  | 'WRONG_DEPARTMENT'
  | 'MISSING_LANGUAGE'
  | 'MISSING_SKILL'
  | 'SKILL_LEVEL_TOO_LOW'
  | 'CERTIFICATION_MISSING'
  | 'CERTIFICATION_EXPIRED'
  | 'NO_CAPACITY';

export interface Blocker {
  code: BlockerCode;
  /** Sentence shown in the UI, e.g. "Needs Welding level 4, has level 2." */
  message: string;
  skillId?: string;
}

/** One weighted component of a candidate's score. */
export interface ScoreFactor {
  key: FactorKey;
  label: string;
  /** 0-1 raw value for this factor. */
  value: number;
  /** Nominal weight before renormalisation. */
  weight: number;
  /** False when the factor cannot be judged (e.g. no deadline was set). */
  applicable: boolean;
  /** One line explaining the number, shown in the breakdown table. */
  detail: string;
}

export type FactorKey =
  | 'skillFit'
  | 'verification'
  | 'experience'
  | 'capacityHeadroom'
  | 'workloadBalance'
  | 'deadlineFit'
  | 'contextFit';

export interface EvaluatedCandidate {
  coworkerId: string;
  fullName: string;
  eligible: boolean;
  blockers: Blocker[];
  /** Final 0-1 score. Always 0 for ineligible candidates. */
  score: number;
  factors: ScoreFactor[];
  /** 1 = best. Null for ineligible candidates. */
  rank: number | null;
  /** Per-requirement detail, used by the "why" table in the UI. */
  requirementFindings: RequirementFinding[];
  /** Populated for ranked candidates: why they sit above the next one. */
  tieBreakNote?: string;
  /** Bookkeeping echoed back so the UI can show workload without a re-query. */
  openTaskCount: number;
  committedHours: number;
  weeklyCapacityHours: number;
}

export interface RequirementFinding {
  skillId: string;
  skillName: string;
  necessity: Necessity;
  required: number;
  held: number | null;
  met: boolean;
  verified: boolean;
  note: string;
}

export interface MatchResult {
  outcome: MatchOutcome;
  summary: string;
  /** All candidates, eligible ones first in rank order, then the rejected ones. */
  candidates: EvaluatedCandidate[];
  /** The candidate the engine recommends, if any. */
  selected: EvaluatedCandidate | null;
  /** Set when the outcome is AMBIGUOUS_TIE: everyone inside the tie band. */
  tiedCandidates: EvaluatedCandidate[];
  /** True when the caller may create an assignment without asking a human. */
  autoAssignable: boolean;
  eligibleCount: number;
  candidateCount: number;
  policy: MatchPolicy;
  engineVersion: string;
  /** Sentence explaining the pick, stored on the assignment. */
  rationale: string;
}
