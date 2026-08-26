'use client';

import { useActionState } from 'react';
import { createCoworkerProfileAction } from '@/app/actions/coworkers';
import type { ActionState } from '@/app/actions/catalogue';

const INITIAL: ActionState = { ok: false };

/** Puts an existing account into the distribution pool. */
export function CreateCoworkerForm({
  users,
  positions,
  labels,
}: {
  users: { id: string; label: string }[];
  positions: { id: string; title: string }[];
  labels: {
    account: string; choose: string; position: string; noPosition: string;
    seedsBaseline: string; department: string; fromPosition: string;
    weeklyHours: string; languages: string; submit: string; submitting: string;
  };
}) {
  const [state, action, pending] = useActionState(createCoworkerProfileAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="nc-user">{labels.account}</label>
          <select id="nc-user" name="userId" className="select" required defaultValue="">
            <option value="">{labels.choose}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-position">{labels.position}</label>
          <select id="nc-position" name="positionId" className="select" defaultValue="">
            <option value="">{labels.noPosition}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <span className="hint">{labels.seedsBaseline}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-dept">{labels.department}</label>
          <input id="nc-dept" name="department" className="input" placeholder={labels.fromPosition} />
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-capacity">{labels.weeklyHours}</label>
          <input
            id="nc-capacity"
            name="weeklyCapacityHours"
            type="number"
            min="0"
            max="80"
            step="0.5"
            className="input"
            defaultValue="37"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-langs">{labels.languages}</label>
          <input id="nc-langs" name="languages" className="input" defaultValue="da,en" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary btn-sm" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> {labels.submitting}</> : labels.submit}
      </button>
    </form>
  );
}
