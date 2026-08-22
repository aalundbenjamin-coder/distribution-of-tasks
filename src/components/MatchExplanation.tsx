/**
 * The "why" view.
 *
 * This is the screen the whole product is accountable to. It shows, for one
 * task: who was qualified, in what order, what each of the seven ranking
 * factors contributed, which rule broke a tie — and, just as importantly, every
 * coworker who was *not* qualified and the exact requirement they failed.
 *
 * Showing the rejections is not an afterthought. "Anna did not get this" is
 * only defensible if you can say why in one sentence.
 */

import type { EvaluatedCandidate, MatchResult } from '@/lib/matching/types';
import { FACTOR_DESCRIPTIONS } from '@/lib/matching/scoring';
import type { FactorKey } from '@/lib/matching/types';
import { Badge, LevelPips, ScoreBar } from './ui';
import { AlertIcon, CheckIcon, ScaleIcon, ShieldIcon, XIcon } from './icons';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function MatchOutcomeNotice({ result }: { result: MatchResult }) {
  const tone =
    result.outcome === 'ASSIGNED'
      ? 'notice-ok'
      : result.outcome === 'NO_ELIGIBLE_CANDIDATE'
        ? 'notice-danger'
        : result.outcome === 'PROPOSED'
          ? 'notice-accent'
          : 'notice-warn';

  const Icon =
    result.outcome === 'ASSIGNED' ? CheckIcon : result.outcome === 'PROPOSED' ? ScaleIcon : AlertIcon;

  return (
    <div className={`notice ${tone}`} role="status">
      <Icon size={18} style={{ flex: 'none', marginTop: 1 }} />
      <span>
        <strong>{result.summary}</strong>
        {result.rationale && (
          <span style={{ display: 'block', marginTop: 4, opacity: 0.9 }}>{result.rationale}</span>
        )}
      </span>
    </div>
  );
}

/** The ranked shortlist: everyone who could legitimately take this task. */
export function ShortlistTable({
  candidates,
  recommendedId,
  assignedId,
  actionColumn,
}: {
  candidates: EvaluatedCandidate[];
  /** Who the engine would pick if it ran right now. */
  recommendedId?: string | null;
  /** Who actually holds the task. Often the same person, but not always: a
   *  shortlist recomputed later reflects capability and workload changes since
   *  the assignment, so the two are shown as the distinct facts they are. */
  assignedId?: string | null;
  actionColumn?: (candidate: EvaluatedCandidate) => React.ReactNode;
}) {
  const eligible = candidates.filter((c) => c.eligible);

  if (eligible.length === 0) {
    return (
      <div className="empty">
        Nobody currently meets every requirement of this task. The table below shows what stood in
        each person&rsquo;s way.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th>Coworker</th>
            <th style={{ width: 160 }}>Match</th>
            <th style={{ width: 120 }}>Workload</th>
            <th>Why this position in the order</th>
            {actionColumn && <th style={{ width: 130 }} />}
          </tr>
        </thead>
        <tbody>
          {eligible.map((candidate) => (
            <tr
              key={candidate.coworkerId}
              className={candidate.coworkerId === (assignedId ?? recommendedId) ? 'is-winner' : ''}
            >
              <td>
                <strong className="num">{candidate.rank}</strong>
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{candidate.fullName}</div>
                <div className="row" style={{ gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  {candidate.coworkerId === assignedId && (
                    <Badge tone="ok" dot>Holds this task</Badge>
                  )}
                  {candidate.coworkerId === recommendedId && candidate.coworkerId !== assignedId && (
                    <Badge tone="accent" dot>Best match now</Badge>
                  )}
                </div>
              </td>
              <td>
                <ScoreBar score={candidate.score} tone={candidate.score >= 0.75 ? 'ok' : undefined} />
              </td>
              <td className="small muted num">
                {candidate.openTaskCount} open
                <div className="tiny subtle">
                  {Math.round(candidate.committedHours)}/{Math.round(candidate.weeklyCapacityHours)} h
                </div>
              </td>
              <td>
                <FactorSummary candidate={candidate} />
              </td>
              {actionColumn && <td>{actionColumn(candidate)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorSummary({ candidate }: { candidate: EvaluatedCandidate }) {
  const applicable = candidate.factors.filter((f) => f.applicable);
  const total = applicable.reduce((sum, f) => sum + f.weight, 0) || 1;
  const top = [...applicable]
    .sort((a, b) => (b.value * b.weight) / total - (a.value * a.weight) / total)
    .slice(0, 3);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {top.map((factor) => (
          <span key={factor.key} className="badge" title={FACTOR_DESCRIPTIONS[factor.key as FactorKey]}>
            {factor.label} {pct(factor.value)}
          </span>
        ))}
      </div>
      {candidate.tieBreakNote && (
        <div
          className="tiny"
          style={{
            color: 'var(--warn)',
            borderLeft: '2px solid var(--warn-border)',
            paddingLeft: 8,
          }}
        >
          {candidate.tieBreakNote}
        </div>
      )}
      <details>
        <summary
          className="tiny subtle"
          style={{ cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}
        >
          Full breakdown
        </summary>
        <div style={{ marginTop: 8 }}>
          <FactorTable candidate={candidate} />
        </div>
      </details>
    </div>
  );
}

function FactorTable({ candidate }: { candidate: EvaluatedCandidate }) {
  const applicable = candidate.factors.filter((f) => f.applicable);
  const totalWeight = applicable.reduce((sum, f) => sum + f.weight, 0) || 1;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <table className="data" style={{ fontSize: 12.5 }}>
        <thead>
          <tr>
            <th>Factor</th>
            <th style={{ width: 90 }}>Value</th>
            <th style={{ width: 80 }}>Weight</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {candidate.factors.map((factor) => (
            <tr key={factor.key} style={factor.applicable ? undefined : { opacity: 0.5 }}>
              <td style={{ fontWeight: 560 }}>{factor.label}</td>
              <td className="num">{factor.applicable ? pct(factor.value) : '—'}</td>
              <td className="num subtle">
                {factor.applicable ? pct(factor.weight / totalWeight) : 'n/a'}
              </td>
              <td className="muted">{factor.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {candidate.requirementFindings.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Requirement by requirement</div>
          <div className="stack" style={{ gap: 5 }}>
            {candidate.requirementFindings.map((finding) => (
              <div
                key={finding.skillId}
                className="row"
                style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}
              >
                <span className="row" style={{ gap: 8 }}>
                  <span style={{ color: finding.met ? 'var(--ok)' : 'var(--danger)', display: 'flex' }}>
                    {finding.met ? <CheckIcon size={13} /> : <XIcon size={13} />}
                  </span>
                  <span className="small">{finding.skillName}</span>
                  {finding.necessity === 'PREFERRED' && <span className="badge">Preferred</span>}
                  {finding.verified && (
                    <span className="badge badge-ok">
                      <ShieldIcon size={11} /> Verified
                    </span>
                  )}
                </span>
                <span className="row" style={{ gap: 10 }}>
                  <LevelPips level={finding.held ?? 0} required={finding.required} label={false} />
                  <span className="tiny muted">{finding.note}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Everyone the gate removed, and the reason. */
export function BlockedTable({ candidates }: { candidates: EvaluatedCandidate[] }) {
  const blocked = candidates.filter((c) => !c.eligible);
  if (blocked.length === 0) {
    return <div className="empty">Every coworker considered was qualified for this task.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Coworker</th>
            <th>Why they were not considered</th>
          </tr>
        </thead>
        <tbody>
          {blocked.map((candidate) => (
            <tr key={candidate.coworkerId} className="is-blocked">
              <td style={{ fontWeight: 560 }}>{candidate.fullName}</td>
              <td>
                <ul className="stack" style={{ gap: 5, margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                  {candidate.blockers.map((blocker, i) => (
                    <li key={i} className="row small" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          color: blocker.code === 'NO_CAPACITY' ? 'var(--warn)' : 'var(--danger)',
                          display: 'flex',
                          marginTop: 2,
                        }}
                      >
                        {blocker.code === 'NO_CAPACITY' ? <AlertIcon size={13} /> : <XIcon size={13} />}
                      </span>
                      <span className="muted">{blocker.message}</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
