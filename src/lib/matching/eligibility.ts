/**
 * The hard gate.
 *
 * This is the part of the system that guarantees an unqualified coworker never
 * receives a task. It is intentionally separate from scoring: a candidate that
 * fails any check here is removed from consideration entirely and can never be
 * rescued by a high score somewhere else.
 *
 * Every check collects a reason instead of returning early, so the UI can tell
 * a head of distribution *everything* that stands in the way, not just the
 * first problem.
 */

import { ASSIGNABLE_AVAILABILITIES } from '@/lib/domain/enums';
import type { Availability } from '@/lib/domain/enums';
import { EN_MESSAGES, type EngineMessages } from './messages';
import type {
  Blocker,
  CandidateInput,
  HeldSkillInput,
  RequirementFinding,
  TaskInput,
} from './types';

export interface GateResult {
  eligible: boolean;
  blockers: Blocker[];
  findings: RequirementFinding[];
  /** Hours left in the week once this task is taken on. Negative = overloaded. */
  remainingHoursAfterTask: number;
}

function skillOf(candidate: CandidateInput, skillId: string): HeldSkillInput | undefined {
  return candidate.skills.find((s) => s.skillId === skillId);
}



/**
 * Decide whether `candidate` may receive `task` at all.
 *
 * @param now Injected clock, so results are reproducible in tests and audits.
 */
export function evaluateGate(
  task: TaskInput,
  candidate: CandidateInput,
  now: Date,
  m: EngineMessages = EN_MESSAGES,
): GateResult {
  const blockers: Blocker[] = [];
  const findings: RequirementFinding[] = [];
  const fmtDate = (d: Date) => m.formatDate(d);

  // 1. Employment / availability state -------------------------------------
  if (!ASSIGNABLE_AVAILABILITIES.includes(candidate.availability as Availability)) {
    blockers.push({
      code: 'NOT_AVAILABLE',
      message: m.notAvailable(
        m.availabilityLabels[candidate.availability] ?? candidate.availability,
      ),
    });
  }

  // 2. Availability window --------------------------------------------------
  // The coworker must be available now, and — when the task has a deadline —
  // still be available when the work has to happen.
  const windowRef = task.dueAt && task.dueAt > now ? now : now;
  if (candidate.availableFrom && candidate.availableFrom > windowRef) {
    blockers.push({
      code: 'OUTSIDE_AVAILABILITY_WINDOW',
      message: m.notAvailableUntil(fmtDate(candidate.availableFrom)),
    });
  }
  if (candidate.availableUntil) {
    const mustCoverUntil = task.dueAt ?? now;
    if (candidate.availableUntil < mustCoverUntil) {
      blockers.push({
        code: 'OUTSIDE_AVAILABILITY_WINDOW',
        message: task.dueAt
          ? m.availableOnlyUntil(fmtDate(candidate.availableUntil), fmtDate(task.dueAt))
          : m.availabilityEnded(fmtDate(candidate.availableUntil)),
      });
    }
  }

  // 3. Explicit exclusion ---------------------------------------------------
  if (candidate.exclusionReason) {
    blockers.push({
      code: 'EXPLICITLY_EXCLUDED',
      message: m.excluded(candidate.exclusionReason),
    });
  }

  // 4. Position -------------------------------------------------------------
  if (task.requiredPositionId && candidate.positionId !== task.requiredPositionId) {
    blockers.push({
      code: 'WRONG_POSITION',
      message: m.wrongPosition(
        task.requiredPositionTitle ?? m.noPosition,
        candidate.positionTitle ?? m.noPosition,
      ),
    });
  }

  // 5. Department -----------------------------------------------------------
  if (
    task.requiredDepartment &&
    task.requiredDepartment.trim() !== '' &&
    candidate.department.trim().toLowerCase() !== task.requiredDepartment.trim().toLowerCase()
  ) {
    blockers.push({
      code: 'WRONG_DEPARTMENT',
      message: m.wrongDepartment(task.requiredDepartment, candidate.department),
    });
  }

  // 6. Languages — every requested language must be spoken -------------------
  const spoken = new Set(candidate.languages.map((l) => l.trim().toLowerCase()).filter(Boolean));
  for (const raw of task.requiredLanguages) {
    const lang = raw.trim().toLowerCase();
    if (!lang) continue;
    if (!spoken.has(lang)) {
      blockers.push({
        code: 'MISSING_LANGUAGE',
        message: m.missingLanguage(raw.toUpperCase()),
      });
    }
  }

  // 7. Capabilities ---------------------------------------------------------
  // Mandatory requirements are hard blockers. Preferred requirements are still
  // recorded as findings so the ranking and the UI can use them, but never
  // block.
  for (const req of task.requirements) {
    const held = skillOf(candidate, req.skillId);
    const isCertification = req.skillKind === 'CERTIFICATION';
    const mandatory = req.necessity === 'MANDATORY';

    if (!held || held.level <= 0) {
      if (mandatory) {
        blockers.push({
          code: isCertification ? 'CERTIFICATION_MISSING' : 'MISSING_SKILL',
          message: isCertification
            ? m.certificationMissing(req.skillName)
            : m.missingSkill(req.skillName),
          skillId: req.skillId,
        });
      }
      findings.push({
        skillId: req.skillId,
        skillName: req.skillName,
        necessity: req.necessity,
        required: isCertification ? 1 : req.minLevel,
        held: held ? held.level : null,
        met: false,
        verified: false,
        note: isCertification ? m.findingCertificationNotHeld : m.findingSkillNotRegistered,
      });
      continue;
    }

    // A lapsed certification is treated as not held.
    if (isCertification && held.expiresAt && held.expiresAt < now) {
      if (mandatory) {
        blockers.push({
          code: 'CERTIFICATION_EXPIRED',
          message: m.certificationExpired(req.skillName, fmtDate(held.expiresAt)),
          skillId: req.skillId,
        });
      }
      findings.push({
        skillId: req.skillId,
        skillName: req.skillName,
        necessity: req.necessity,
        required: 1,
        held: held.level,
        met: false,
        verified: held.verified,
        note: m.findingExpired(fmtDate(held.expiresAt)),
      });
      continue;
    }

    if (!isCertification && held.level < req.minLevel) {
      if (mandatory) {
        blockers.push({
          code: 'SKILL_LEVEL_TOO_LOW',
          message: m.levelTooLow(
            req.skillName,
            m.levelLabels[req.minLevel] ?? String(req.minLevel),
            req.minLevel,
            m.levelLabels[held.level] ?? String(held.level),
            held.level,
          ),
          skillId: req.skillId,
        });
      }
      findings.push({
        skillId: req.skillId,
        skillName: req.skillName,
        necessity: req.necessity,
        required: req.minLevel,
        held: held.level,
        met: false,
        verified: held.verified,
        note: m.findingBelowLevel(held.level, req.minLevel),
      });
      continue;
    }

    findings.push({
      skillId: req.skillId,
      skillName: req.skillName,
      necessity: req.necessity,
      required: isCertification ? 1 : req.minLevel,
      held: held.level,
      met: true,
      verified: held.verified,
      note: isCertification
        ? held.expiresAt
          ? m.findingValidUntil(fmtDate(held.expiresAt))
          : m.findingHeld
        : m.findingLevel(held.level, held.level - req.minLevel, held.verified),
    });
  }

  // 8. Capacity -------------------------------------------------------------
  // Someone with no room left is not a qualified recipient of more work. This
  // blocks rather than merely lowering the score, and it reads differently in
  // the UI from "not qualified" so a head of distribution can act on it.
  const remainingHoursAfterTask =
    candidate.weeklyCapacityHours - candidate.committedHours - task.estimatedHours;
  if (remainingHoursAfterTask < 0) {
    const free = Math.max(0, candidate.weeklyCapacityHours - candidate.committedHours);
    blockers.push({
      code: 'NO_CAPACITY',
      message: m.noCapacity(task.estimatedHours, round1(free), round1(candidate.weeklyCapacityHours)),
    });
  }

  return { eligible: blockers.length === 0, blockers, findings, remainingHoursAfterTask };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
