'use client';

import { useActionState } from 'react';
import { createCoworkerProfileAction } from '@/app/actions/coworkers';
import type { ActionState } from '@/app/actions/catalogue';

const INITIAL: ActionState = { ok: false };

/** Puts an existing account into the distribution pool. */
export function CreateCoworkerForm({
  users,
  positions,
}: {
  users: { id: string; label: string }[];
  positions: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(createCoworkerProfileAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="nc-user">Account</label>
          <select id="nc-user" name="userId" className="select" required defaultValue="">
            <option value="">Choose…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-position">Position</label>
          <select id="nc-position" name="positionId" className="select" defaultValue="">
            <option value="">No position</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <span className="hint">Seeds their capability baseline.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-dept">Department</label>
          <input id="nc-dept" name="department" className="input" placeholder="From the position" />
        </div>

        <div className="field">
          <label className="label" htmlFor="nc-capacity">Weekly hours</label>
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
          <label className="label" htmlFor="nc-langs">Languages</label>
          <input id="nc-langs" name="languages" className="input" defaultValue="da,en" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary btn-sm" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> Adding…</> : 'Add to the distribution pool'}
      </button>
    </form>
  );
}
