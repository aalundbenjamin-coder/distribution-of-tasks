/**
 * Small presentational pieces shared across the app.
 *
 * All server components — none of them hold state — so they can be used inside
 * pages without pulling anything extra to the client.
 */

import type { ReactNode } from 'react';

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

