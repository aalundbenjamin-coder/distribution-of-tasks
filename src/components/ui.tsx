/**
 * Small presentational pieces shared across the app.
 *
 * All server components — none of them hold state — so they can be used inside
 * pages without pulling anything extra to the client.
 */

import type { ReactNode } from 'react';
import {
  AVAILABILITY_LABELS,
  MATCH_OUTCOME_LABELS,
  SKILL_LEVEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Availability,
  type MatchOutcome,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/domain/enums';

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

const TONE_CLASS: Record<Tone, string> = {
  neutral: '',
  ok: 'badge-ok',
  warn: 'badge-warn',
  danger: 'badge-danger',
  info: 'badge-info',
  accent: 'badge-accent',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function Avatar({
  name,
  colour,
  large = false,
}: {
  name: string;
  colour: string;
  large?: boolean;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={large ? 'avatar avatar-lg' : 'avatar'}
      style={{ background: colour }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

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

export function TaskStatusBadge({ status }: { status: string }) {
  const key = (status as TaskStatus) in TASK_STATUS_LABELS ? (status as TaskStatus) : 'DRAFT';
  return (
    <Badge tone={TASK_STATUS_TONE[key]} dot>
      {TASK_STATUS_LABELS[key]}
    </Badge>
  );
}

const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  HIGH: 'warn',
  CRITICAL: 'danger',
};

export function PriorityBadge({ priority }: { priority: string }) {
  const key = (priority as TaskPriority) in TASK_PRIORITY_LABELS ? (priority as TaskPriority) : 'NORMAL';
  if (key === 'LOW' || key === 'NORMAL') {
    return <span className="tiny subtle">{TASK_PRIORITY_LABELS[key]} priority</span>;
  }
  return <Badge tone={PRIORITY_TONE[key]}>{TASK_PRIORITY_LABELS[key]}</Badge>;
}

const AVAILABILITY_TONE: Record<Availability, Tone> = {
  ACTIVE: 'ok',
  ON_LEAVE: 'warn',
  UNAVAILABLE: 'warn',
  OFFBOARDED: 'neutral',
};

export function AvailabilityBadge({ availability }: { availability: string }) {
  const key =
    (availability as Availability) in AVAILABILITY_LABELS ? (availability as Availability) : 'ACTIVE';
  return (
    <Badge tone={AVAILABILITY_TONE[key]} dot>
      {AVAILABILITY_LABELS[key]}
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

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const key = (outcome as MatchOutcome) in MATCH_OUTCOME_LABELS ? (outcome as MatchOutcome) : 'PROPOSED';
  return <Badge tone={OUTCOME_TONE[key]}>{MATCH_OUTCOME_LABELS[key]}</Badge>;
}

/**
 * A 0-5 capability level drawn as five pips, with the required level marked.
 * Reading "has 4, needs 3" off a picture is faster than reading two numbers.
 */
export function LevelPips({
  level,
  required,
  label = true,
}: {
  level: number;
  required?: number;
  label?: boolean;
}) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="level-pips" role="img" aria-label={`Level ${level} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <i
            key={n}
            className={`${n <= level ? 'on' : ''} ${required !== undefined && n === required ? 'req' : ''}`}
          />
        ))}
      </span>
      {label && (
        <span className="tiny muted">
          {SKILL_LEVEL_LABELS[level] ?? level}
          {required !== undefined && ` · needs ${required}`}
        </span>
      )}
    </span>
  );
}

export function ScoreBar({ score, tone }: { score: number; tone?: 'ok' | 'warn' }) {
  const pct = Math.round(score * 100);
  return (
    <span className="row" style={{ gap: 9 }}>
      <span
        className={`meter ${tone === 'ok' ? 'meter-ok' : tone === 'warn' ? 'meter-warn' : ''}`}
        style={{ width: 74 }}
      >
        <span style={{ width: `${pct}%` }} />
      </span>
      <strong className="num small" style={{ minWidth: 34 }}>
        {pct}%
      </strong>
    </span>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-header">
          <div>
            {title && <div className="card-title">{title}</div>}
            {subtitle && <div className="card-sub">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'card-pad' : undefined}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: ReactNode;
  title: string;
  lede?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
        marginBottom: 22,
      }}
    >
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 7 }}>{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {action}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'ok' | 'warn' | 'danger';
}) {
  const colour =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--text)';
  return (
    <div className="card card-pad">
      <div className="eyebrow">{label}</div>
      <div
        className="num"
        style={{ fontSize: 30, fontWeight: 660, letterSpacing: '-0.03em', marginTop: 6, color: colour }}
      >
        {value}
      </div>
      {hint && <div className="tiny muted" style={{ marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

/** Formats a date the same way everywhere: "12 Mar 2026". */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "3 days ago" / "in 2 days". Used where the exact timestamp is noise. */
export function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}
