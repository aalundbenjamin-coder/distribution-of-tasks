/**
 * The presentation scenario, run through the REAL matching engine.
 *
 * Nothing here is invented: the team and the two tasks are defined as ordinary
 * engine inputs, handed to `matchTask`, and whatever it returns is what the
 * mockup displays. If the engine changes, the presentation changes with it.
 */

import { matchTask } from '../../src/lib/matching/engine';
import type { CandidateInput, TaskInput } from '../../src/lib/matching/types';

const NOW = new Date('2026-08-26T09:00:00.000Z');

const LOCALE = (process.argv[2] === 'da' ? 'da' : 'en') as 'da' | 'en';

/**
 * The demo's own vocabulary. The engine translates its sentences; the names of
 * the capabilities and the tasks are data, so they are supplied per language
 * here — otherwise the Danish page would be Danish prose about English skills.
 */
const NAMES = {
  en: {
    faultFinding: 'Electrical fault-finding',
    lvPermit: 'Low-voltage work permit',
    handover: 'Customer handover',
    reportWriting: 'Technical report writing',
    dataAnalysis: 'Data analysis',
    taskATitle: 'Intermittent trip on the packing line feeder',
    taskBTitle: 'Quarterly reliability report — Aarhus site',
    posElec: 'Senior Electrical Technician',
    posService: 'Field Service Engineer',
    posAuto: 'Automation Engineer',
    posData: 'Reliability Data Engineer',
    posMech: 'Senior Mechanical Technician',
    deptField: 'Field Service',
    deptAuto: 'Automation',
    deptWorkshop: 'Workshop',
  },
  da: {
    faultFinding: 'Elektrisk fejlfinding',
    lvPermit: 'L-AUS-bevis',
    handover: 'Kundeoverdragelse',
    reportWriting: 'Teknisk rapportskrivning',
    dataAnalysis: 'Dataanalyse',
    taskATitle: 'Uregelmæssigt udfald på pakkelinjens indfødning',
    taskBTitle: 'Kvartalsrapport om driftssikkerhed — Aarhus',
    posElec: 'Erfaren eltekniker',
    posService: 'Servicetekniker',
    posAuto: 'Automationsingeniør',
    posData: 'Dataingeniør, driftssikkerhed',
    posMech: 'Erfaren maskintekniker',
    deptField: 'Service',
    deptAuto: 'Automation',
    deptWorkshop: 'Værksted',
  },
}[process.argv[2] === 'da' ? 'da' : 'en'];
const d = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------
// The five coworkers — five different educations, five different fields
// ---------------------------------------------------------------------------

const TEAM: CandidateInput[] = [
  {
    coworkerId: 'sofie',
    fullName: 'Sofie Lindgren',
    positionId: 'pos-elec',
    positionTitle: NAMES.posElec,
    department: NAMES.deptField,
    availability: 'ACTIVE',
    availableFrom: null,
    availableUntil: null,
    weeklyCapacityHours: 37,
    committedHours: 12,
    openTaskCount: 2,
    languages: ['da', 'en', 'sv'],
    timezone: 'Europe/Copenhagen',
    lastAssignedAt: d('2026-08-19T00:00:00Z'),
    assignmentCount: 47,
    skills: [
      { skillId: 'fault-finding', level: 5, verified: true, yearsExperience: 8, expiresAt: null },
      { skillId: 'hv-switching', level: 4, verified: true, yearsExperience: 6, expiresAt: null },
      { skillId: 'lv-permit', level: 5, verified: true, yearsExperience: 8, expiresAt: d('2027-06-30T00:00:00Z') },
      { skillId: 'customer-handover', level: 4, verified: true, yearsExperience: 7, expiresAt: null },
      { skillId: 'report-writing', level: 3, verified: false, yearsExperience: 5, expiresAt: null },
    ],
  },
  {
    coworkerId: 'freja',
    fullName: 'Freja Nilsen',
    positionId: 'pos-service',
    positionTitle: NAMES.posService,
    department: NAMES.deptField,
    availability: 'ACTIVE',
    availableFrom: null,
    availableUntil: null,
    weeklyCapacityHours: 37,
    committedHours: 18,
    openTaskCount: 3,
    languages: ['da', 'en'],
    timezone: 'Europe/Copenhagen',
    lastAssignedAt: d('2026-08-24T00:00:00Z'),
    assignmentCount: 31,
    skills: [
      { skillId: 'fault-finding', level: 4, verified: true, yearsExperience: 5, expiresAt: null },
      { skillId: 'customer-handover', level: 5, verified: true, yearsExperience: 6, expiresAt: null },
      { skillId: 'report-writing', level: 4, verified: false, yearsExperience: 3, expiresAt: null },
      // Lapsed three weeks ago. This is the one the eye misses and the gate does not.
      { skillId: 'lv-permit', level: 5, verified: true, yearsExperience: 5, expiresAt: d('2026-08-05T00:00:00Z') },
    ],
  },
  {
    coworkerId: 'mikkel',
    fullName: 'Mikkel Dahl',
    positionId: 'pos-auto',
    positionTitle: NAMES.posAuto,
    department: NAMES.deptAuto,
    availability: 'ACTIVE',
    availableFrom: null,
    availableUntil: null,
    weeklyCapacityHours: 37,
    committedHours: 22,
    openTaskCount: 4,
    languages: ['da', 'en', 'de'],
    timezone: 'Europe/Copenhagen',
    lastAssignedAt: d('2026-08-25T00:00:00Z'),
    assignmentCount: 38,
    skills: [
      { skillId: 'plc-programming', level: 5, verified: true, yearsExperience: 9, expiresAt: null },
      { skillId: 'safety-systems', level: 4, verified: true, yearsExperience: 7, expiresAt: null },
      { skillId: 'report-writing', level: 4, verified: true, yearsExperience: 6, expiresAt: null },
      { skillId: 'data-analysis', level: 2, verified: false, yearsExperience: 2, expiresAt: null },
      // Genuinely electrically aware, but not to the level this callout needs.
      { skillId: 'fault-finding', level: 2, verified: false, yearsExperience: 1, expiresAt: null },
      { skillId: 'lv-permit', level: 5, verified: true, yearsExperience: 4, expiresAt: d('2027-03-01T00:00:00Z') },
    ],
  },
  {
    coworkerId: 'jonas',
    fullName: 'Jonas Berg',
    positionId: 'pos-data',
    positionTitle: NAMES.posData,
    department: NAMES.deptAuto,
    availability: 'ACTIVE',
    availableFrom: null,
    availableUntil: null,
    weeklyCapacityHours: 30,
    committedHours: 8,
    openTaskCount: 1,
    languages: ['da', 'en'],
    timezone: 'Europe/Copenhagen',
    lastAssignedAt: d('2026-08-12T00:00:00Z'),
    assignmentCount: 19,
    skills: [
      { skillId: 'data-analysis', level: 5, verified: true, yearsExperience: 7, expiresAt: null },
      { skillId: 'report-writing', level: 5, verified: true, yearsExperience: 7, expiresAt: null },
      { skillId: 'plc-programming', level: 3, verified: false, yearsExperience: 3, expiresAt: null },
      // No electrical capability and no permit — a data engineer, correctly.
    ],
  },
  {
    coworkerId: 'amira',
    fullName: 'Amira Haddad',
    positionId: 'pos-mech',
    positionTitle: NAMES.posMech,
    department: NAMES.deptWorkshop,
    availability: 'ON_LEAVE',
    availableFrom: d('2026-09-14T00:00:00Z'),
    availableUntil: null,
    weeklyCapacityHours: 37,
    committedHours: 0,
    openTaskCount: 0,
    languages: ['da', 'en', 'ar'],
    timezone: 'Europe/Copenhagen',
    lastAssignedAt: d('2026-08-07T00:00:00Z'),
    assignmentCount: 52,
    skills: [
      { skillId: 'hydraulics', level: 5, verified: true, yearsExperience: 11, expiresAt: null },
      { skillId: 'welding-mig', level: 4, verified: true, yearsExperience: 9, expiresAt: null },
      { skillId: 'forklift', level: 5, verified: true, yearsExperience: 9, expiresAt: d('2027-11-01T00:00:00Z') },
      { skillId: 'report-writing', level: 3, verified: false, yearsExperience: 4, expiresAt: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// Two tasks the head of distribution drops into folders
// ---------------------------------------------------------------------------

const TASK_A: TaskInput = {
  taskId: 'task-a',
  reference: 'TSK-2041',
  title: NAMES.taskATitle,
  priority: 'HIGH',
  estimatedHours: 6,
  dueAt: d('2026-08-28T15:00:00Z'),
  requiredPositionId: null,
  requiredPositionTitle: null,
  requiredLanguages: ['da'],
  requiredDepartment: '',
  requirements: [
    { skillId: 'fault-finding', skillName: NAMES.faultFinding, skillKind: 'GRADED', minLevel: 3, necessity: 'MANDATORY', weight: 5 },
    { skillId: 'lv-permit', skillName: NAMES.lvPermit, skillKind: 'CERTIFICATION', minLevel: 5, necessity: 'MANDATORY', weight: 5 },
    { skillId: 'customer-handover', skillName: NAMES.handover, skillKind: 'GRADED', minLevel: 3, necessity: 'PREFERRED', weight: 2 },
  ],
};

const TASK_B: TaskInput = {
  taskId: 'task-b',
  reference: 'TSK-2042',
  title: NAMES.taskBTitle,
  priority: 'NORMAL',
  estimatedHours: 8,
  dueAt: d('2026-09-04T15:00:00Z'),
  requiredPositionId: null,
  requiredPositionTitle: null,
  requiredLanguages: ['en'],
  requiredDepartment: '',
  requirements: [
    { skillId: 'report-writing', skillName: NAMES.reportWriting, skillKind: 'GRADED', minLevel: 3, necessity: 'MANDATORY', weight: 4 },
    { skillId: 'data-analysis', skillName: NAMES.dataAnalysis, skillKind: 'GRADED', minLevel: 3, necessity: 'PREFERRED', weight: 3 },
  ],
};

const POLICY = { tieBreak: 'BALANCED_LOAD' as const, ambiguityPolicy: 'AUTO' as const };

const locale = LOCALE;
const resultA = matchTask(TASK_A, TEAM, { now: NOW, policy: POLICY, locale });
const resultB = matchTask(TASK_B, TEAM, { now: NOW, policy: POLICY, locale });

console.log(
  JSON.stringify(
    {
      locale,
      generatedFor: NOW.toISOString(),
      taskA: { task: TASK_A, result: resultA },
      taskB: { task: TASK_B, result: resultB },
    },
    null,
    2,
  ),
);
