/**
 * Labels that depend on the reader's language.
 *
 * These are async server components: each reads the request's locale itself, so
 * the fifteen pages that show a status pill did not have to start threading a
 * dictionary through every call site.
 *
 * They live apart from `ui.tsx` on purpose. That module is imported by a client
 * component, and a module reachable from the client cannot also export async
 * server components.
 */

import { Badge } from './ui';
import { getTranslations } from '@/lib/i18n';
import { formatDateIn, formatDateTimeIn } from '@/lib/i18n/locale';
import type {
  Availability,
  MatchOutcome,
  TaskPriority,
  TaskStatus,
} from '@/lib/domain/enums';

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  DRAFT: 'neutral',
  QUEUED: 'info',
  MATCHED: 'accent',
  NEEDS_REVIEW: 'warn',
  ASSIGNED: 'ok',
  IN_PROGRESS: 'ok',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
  BLOCKED_NO_MATCH: 'danger',
};

export async function TaskStatusBadge({ status }: { status: string }) {
  const { t } = await getTranslations();
  const key = (status in t.taskStatus ? status : 'DRAFT') as TaskStatus;
  return (
    <Badge tone={TASK_STATUS_TONE[key]} dot>
      {t.taskStatus[key]}
    </Badge>
  );
}

const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  HIGH: 'warn',
  CRITICAL: 'danger',
};

export async function PriorityBadge({ priority }: { priority: string }) {
  const { t } = await getTranslations();
  const key = (priority in t.priority ? priority : 'NORMAL') as TaskPriority;
  if (key === 'LOW' || key === 'NORMAL') {
    return (
      <span className="tiny subtle">
        {t.priority[key]} {t.priority.suffix}
      </span>
    );
  }
  return <Badge tone={PRIORITY_TONE[key]}>{t.priority[key]}</Badge>;
}

const AVAILABILITY_TONE: Record<Availability, Tone> = {
  ACTIVE: 'ok',
  ON_LEAVE: 'warn',
  UNAVAILABLE: 'warn',
  OFFBOARDED: 'neutral',
};

export async function AvailabilityBadge({ availability }: { availability: string }) {
  const { t } = await getTranslations();
  const key = (availability in t.availability ? availability : 'ACTIVE') as Availability;
  return (
    <Badge tone={AVAILABILITY_TONE[key]} dot>
      {t.availability[key]}
    </Badge>
  );
}

const OUTCOME_TONE: Record<MatchOutcome, Tone> = {
  ASSIGNED: 'ok',
  PROPOSED: 'accent',
  AMBIGUOUS_TIE: 'warn',
  NO_ELIGIBLE_CANDIDATE: 'danger',
  BELOW_MINIMUM: 'warn',
};

export async function OutcomeBadge({ outcome }: { outcome: string }) {
  const { t } = await getTranslations();
  const key = (outcome in t.outcome ? outcome : 'PROPOSED') as MatchOutcome;
  return <Badge tone={OUTCOME_TONE[key]}>{t.outcome[key]}</Badge>;
}

/**
 * A 0-5 capability level drawn as five pips, with the level word and the
 * required level in the reader's language.
 */
export async function LevelPips({
  level,
  required,
  label = true,
}: {
  level: number;
  required?: number;
  label?: boolean;
}) {
  const { t } = await getTranslations();
  const levelWord = t.levels[level as 0 | 1 | 2 | 3 | 4 | 5] ?? String(level);
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="level-pips" role="img" aria-label={`${levelWord} (${level}/5)`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <i
            key={n}
            className={`${n <= level ? 'on' : ''} ${required !== undefined && n === required ? 'req' : ''}`}
          />
        ))}
      </span>
      {label && (
        <span className="tiny muted">
          {levelWord}
          {required !== undefined && ` · ${t.tasks.colMinimum.toLowerCase()} ${required}`}
        </span>
      )}
    </span>
  );
}

/** A date written the way the reader's language writes dates. */
export async function LocalDate({ value }: { value: Date | string | null | undefined }) {
  const { locale } = await getTranslations();
  return <>{formatDateIn(locale, value)}</>;
}

export async function LocalDateTime({ value }: { value: Date | string | null | undefined }) {
  const { locale } = await getTranslations();
  return <>{formatDateTimeIn(locale, value)}</>;
}

/** "3 dage siden" / "3 days ago", via Intl rather than hand-built strings. */
export async function RelativeTime({ value }: { value: Date | string }) {
  const { locale } = await getTranslations();
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === 'da' ? 'da-DK' : 'en-GB', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return <>{rtf.format(Math.round(diff / ms), unit)}</>;
  }
  return <>{locale === 'da' ? 'lige nu' : 'just now'}</>;
}
