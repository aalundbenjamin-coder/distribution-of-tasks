'use client';

/**
 * The buttons a head of distribution presses on a task: re-run distribution,
 * confirm a proposal, or hand it to someone by name.
 *
 * The override path is deliberately awkward. Assigning to someone the gate
 * rejected requires ticking an acknowledgement and writing a reason, because
 * that reason is what ends up in the audit trail next to their name.
 */

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmProposalAction, redistributeTaskAction, updateTaskProgressAction } from '@/app/actions/tasks';
import type { ActionState } from '@/app/actions/catalogue';
import { AlertIcon, CheckIcon, HistoryIcon } from './icons';

const INITIAL: ActionState = { ok: false };

export function RedistributeButton({
  taskId,
  labels,
}: {
  taskId: string;
  labels: { run: string; running: string };
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await redistributeTaskAction(taskId);
            setMessage(result.error ?? result.message ?? null);
            router.refresh();
          })
        }
      >
        {pending ? (
          <><span className="spin" /> {labels.running}</>
        ) : (
          <><HistoryIcon size={15} /> {labels.run}</>
        )}
      </button>
      {message && <span className="tiny muted">{message}</span>}
    </div>
  );
}

export function ProgressButtons({
  taskId,
  status,
  labels,
}: {
  taskId: string;
  status: string;
  labels: { start: string; complete: string; completed: string };
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function move(next: 'IN_PROGRESS' | 'COMPLETED') {
    start(async () => {
      await updateTaskProgressAction(taskId, next);
      router.refresh();
    });
  }

  if (status === 'COMPLETED') {
    return <span className="badge badge-ok"><CheckIcon size={12} /> {labels.completed}</span>;
  }

  return (
    <div className="row" style={{ gap: 9, flexWrap: 'wrap' }}>
      {status !== 'IN_PROGRESS' && (
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => move('IN_PROGRESS')}>
          {labels.start}
        </button>
      )}
      <button
        type="button"
        className="btn btn-sm btn-primary"
        disabled={pending}
        onClick={() => move('COMPLETED')}
      >
        <CheckIcon size={14} /> {labels.complete}
      </button>
    </div>
  );
}

export function AssignForm({
  taskId,
  candidates,
  labels,
}: {
  taskId: string;
  candidates: { coworkerId: string; fullName: string; eligible: boolean; score: number }[];
  labels: {
    assignTo: string;
    reason: string;
    reasonPlaceholder: string;
    reasonHint: string;
    qualified: string;
    unqualified: string;
    notQualified: string;
    doesNotMeet: string;
    acknowledge: string;
    submit: string;
    submitting: string;
  };
}) {
  const [state, action, pending] = useActionState(confirmProposalAction, INITIAL);
  const [coworkerId, setCoworkerId] = useState(
    candidates.find((c) => c.eligible)?.coworkerId ?? candidates[0]?.coworkerId ?? '',
  );

  const chosen = candidates.find((c) => c.coworkerId === coworkerId);
  const needsAcknowledgement = chosen !== undefined && !chosen.eligible;

  return (
    <form action={action} className="stack" style={{ gap: 13 }}>
      <input type="hidden" name="taskId" value={taskId} />

      {state.error && (
        <div className="notice notice-danger" role="alert">{state.error}</div>
      )}
      {state.ok && state.message && (
        <div className="notice notice-ok">{state.message}</div>
      )}

      <div className="field">
        <label className="label" htmlFor="assign-who">{labels.assignTo}</label>
        <select
          id="assign-who"
          name="coworkerId"
          className="select"
          value={coworkerId}
          onChange={(e) => setCoworkerId(e.target.value)}
          required
        >
          <optgroup label={labels.qualified}>
            {candidates
              .filter((c) => c.eligible)
              .map((c) => (
                <option key={c.coworkerId} value={c.coworkerId}>
                  {c.fullName} — {Math.round(c.score * 100)}%
                </option>
              ))}
          </optgroup>
          {candidates.some((c) => !c.eligible) && (
            <optgroup label={labels.unqualified}>
              {candidates
                .filter((c) => !c.eligible)
                .map((c) => (
                  <option key={c.coworkerId} value={c.coworkerId}>
                    {c.fullName} — {labels.notQualified}
                  </option>
                ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="assign-reason">{labels.reason}</label>
        <input
          id="assign-reason"
          name="reason"
          className="input"
          placeholder={labels.reasonPlaceholder}
          required={needsAcknowledgement}
        />
        <span className="hint">{labels.reasonHint}</span>
      </div>

      {needsAcknowledgement && (
        <label className="checkline" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' }}>
          <input type="checkbox" name="acknowledgeUnqualified" required />
          <span>
            <span className="row" style={{ gap: 7, fontWeight: 620, fontSize: 13.5, color: 'var(--danger)' }}>
              <AlertIcon size={15} />
              {labels.doesNotMeet.replace('{name}', chosen?.fullName ?? '')}
            </span>
            <span className="hint" style={{ display: 'block', marginTop: 3 }}>
              {labels.acknowledge}
            </span>
          </span>
        </label>
      )}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <><span className="spin" /> {labels.submitting}</> : labels.submit}
      </button>
    </form>
  );
}
