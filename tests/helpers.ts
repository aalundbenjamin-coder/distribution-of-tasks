import type { CandidateInput, RequirementInput, TaskInput } from '@/lib/matching/types';

export const NOW = new Date('2026-03-02T09:00:00.000Z'); // a Monday

export function req(overrides: Partial<RequirementInput> & { skillId: string }): RequirementInput {
  return {
    skillName: overrides.skillId,
    skillKind: 'GRADED',
    minLevel: 3,
    necessity: 'MANDATORY',
    weight: 3,
    ...overrides,
  };
}

export function task(overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    taskId: 'task-1',
    reference: 'TSK-1',
    title: 'Test task',
    priority: 'NORMAL',
    estimatedHours: 4,
    dueAt: null,
    requirements: [],
    requiredPositionId: null,
    requiredPositionTitle: null,
    requiredLanguages: [],
    requiredDepartment: '',
    ...overrides,
  };
}

export function coworker(
  id: string,
  overrides: Partial<CandidateInput> = {},
): CandidateInput {
  return {
    coworkerId: id,
    fullName: id,
    positionId: null,
    positionTitle: null,
    department: 'General',
    availability: 'ACTIVE',
    availableFrom: null,
    availableUntil: null,
    weeklyCapacityHours: 37,
    committedHours: 0,
    openTaskCount: 0,
    languages: ['en'],
    timezone: 'Europe/Copenhagen',
    skills: [],
    lastAssignedAt: null,
    assignmentCount: 0,
    exclusionReason: null,
    ...overrides,
  };
}

export function skill(
  skillId: string,
  level: number,
  overrides: Partial<{ verified: boolean; yearsExperience: number; expiresAt: Date | null }> = {},
) {
  return {
    skillId,
    level,
    verified: false,
    yearsExperience: 0,
    expiresAt: null,
    ...overrides,
  };
}
