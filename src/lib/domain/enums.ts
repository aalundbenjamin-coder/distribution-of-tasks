/**
 * Every string-backed enum in the data model, declared once.
 *
 * The database stores plain strings (so the schema stays portable between
 * SQLite and PostgreSQL) and this module is the single place that says which
 * strings are legal. Anything that writes one of these columns validates
 * through here first.
 */

export const USER_ROLES = ['PLATFORM_ADMIN', 'HEAD_OF_DISTRIBUTION', 'COWORKER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  PLATFORM_ADMIN: 'Platform administrator',
  HEAD_OF_DISTRIBUTION: 'Head of distribution',
  COWORKER: 'Coworker',
};

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ['EMAIL_PASSWORD', 'GOOGLE', 'PHONE'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  EMAIL_PASSWORD: 'E-mail and password',
  GOOGLE: 'Google',
  PHONE: 'Phone number',
};

export const VERIFICATION_PURPOSES = ['PHONE_OTP', 'EMAIL_VERIFY', 'PASSWORD_RESET'] as const;
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number];

// --- Consent ---------------------------------------------------------------

export const CONSENT_TYPES = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'MARKETING_EMAIL',
  'MARKETING_SMS',
  'OPERATIONAL_EMAIL',
  'OPERATIONAL_SMS',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Consents that must be granted before an account can exist at all. */
export const REQUIRED_CONSENTS: ConsentType[] = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY'];

export const CONSENT_LABELS: Record<ConsentType, string> = {
  TERMS_OF_SERVICE: 'Terms of service',
  PRIVACY_POLICY: 'Privacy policy',
  MARKETING_EMAIL: 'Product news by e-mail',
  MARKETING_SMS: 'Product news by SMS',
  OPERATIONAL_EMAIL: 'Work notifications by e-mail',
  OPERATIONAL_SMS: 'Work notifications by SMS',
};

export const CONSENT_SOURCES = ['SIGNUP', 'SETTINGS', 'ADMIN', 'API'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

// --- Capabilities ----------------------------------------------------------

export const SKILL_KINDS = ['GRADED', 'CERTIFICATION'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

/** Graded capability levels. Certifications use HELD (5) or NONE (0). */
export const SKILL_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Awareness',
  2: 'Assisted',
  3: 'Independent',
  4: 'Advanced',
  5: 'Expert',
};

export const NECESSITIES = ['MANDATORY', 'PREFERRED'] as const;
export type Necessity = (typeof NECESSITIES)[number];

// --- Coworkers -------------------------------------------------------------

export const AVAILABILITIES = ['ACTIVE', 'ON_LEAVE', 'UNAVAILABLE', 'OFFBOARDED'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  ACTIVE: 'Available',
  ON_LEAVE: 'On leave',
  UNAVAILABLE: 'Temporarily unavailable',
  OFFBOARDED: 'Offboarded',
};

/** Only these availabilities may receive work. */
export const ASSIGNABLE_AVAILABILITIES: Availability[] = ['ACTIVE'];

// --- Folders ---------------------------------------------------------------

export const ROUTING_MODES = ['AUTO_ASSIGN', 'PROPOSE_ONLY'] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];

export const ROUTING_MODE_LABELS: Record<RoutingMode, string> = {
  AUTO_ASSIGN: 'Assign automatically',
  PROPOSE_ONLY: 'Propose, a human confirms',
};

export const TIE_BREAKS = ['BEST_MATCH', 'BALANCED_LOAD', 'ROUND_ROBIN'] as const;
export type TieBreak = (typeof TIE_BREAKS)[number];

export const TIE_BREAK_LABELS: Record<TieBreak, string> = {
  BEST_MATCH: 'Highest score wins',
  BALANCED_LOAD: 'Highest score, lightest workload breaks ties',
  ROUND_ROBIN: 'Highest score, longest-waiting coworker breaks ties',
};

export const AMBIGUITY_POLICIES = ['STRICT', 'AUTO'] as const;
export type AmbiguityPolicy = (typeof AMBIGUITY_POLICIES)[number];

export const AMBIGUITY_POLICY_LABELS: Record<AmbiguityPolicy, string> = {
  STRICT: 'Ask a human when candidates are too close to separate',
  AUTO: 'Always pick the top-ranked candidate',
};

// --- Tasks -----------------------------------------------------------------

export const TASK_STATUSES = [
  'DRAFT',
  'QUEUED',
  'MATCHED',
  'NEEDS_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'BLOCKED_NO_MATCH',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  DRAFT: 'Draft',
  QUEUED: 'In folder, awaiting distribution',
  MATCHED: 'Match proposed',
  NEEDS_REVIEW: 'Needs a human decision',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  BLOCKED_NO_MATCH: 'No qualified coworker',
};

/** Statuses whose assignment counts against a coworker's live workload. */
export const OPEN_TASK_STATUSES: TaskStatus[] = ['MATCHED', 'ASSIGNED', 'IN_PROGRESS'];

export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

// --- Matching --------------------------------------------------------------

export const MATCH_TRIGGERS = ['MANUAL', 'FOLDER_INTAKE', 'REQUEUE'] as const;
export type MatchTrigger = (typeof MATCH_TRIGGERS)[number];

export const MATCH_OUTCOMES = [
  'ASSIGNED',
  'PROPOSED',
  'AMBIGUOUS_TIE',
  'NO_ELIGIBLE_CANDIDATE',
  'BELOW_MINIMUM',
] as const;
export type MatchOutcome = (typeof MATCH_OUTCOMES)[number];

export const MATCH_OUTCOME_LABELS: Record<MatchOutcome, string> = {
  ASSIGNED: 'Assigned automatically',
  PROPOSED: 'Proposed for confirmation',
  AMBIGUOUS_TIE: 'Too close to call — human decision needed',
  NO_ELIGIBLE_CANDIDATE: 'Nobody qualified',
  BELOW_MINIMUM: 'Best candidate below the folder minimum',
};

export const ASSIGNMENT_METHODS = ['AUTOMATIC', 'MANUAL_OVERRIDE', 'REASSIGNMENT'] as const;
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];

export const ASSIGNMENT_STATUSES = ['PROPOSED', 'ACTIVE', 'COMPLETED', 'REVOKED', 'DECLINED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// --- Notifications ---------------------------------------------------------

export const NOTIFICATION_CATEGORIES = ['OPERATIONAL', 'MARKETING'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const DELIVERY_STATUSES = [
  'NOT_APPLICABLE',
  'SKIPPED_NO_CONSENT',
  'QUEUED',
  'SENT',
  'FAILED',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  NOT_APPLICABLE: 'Not applicable',
  SKIPPED_NO_CONSENT: 'Skipped — no consent',
  QUEUED: 'Queued',
  SENT: 'Sent',
  FAILED: 'Failed',
};

// --- Helpers ---------------------------------------------------------------

/** Narrow an unknown string to a member of `values`, or fall back. */
export function coerceEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function isEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
