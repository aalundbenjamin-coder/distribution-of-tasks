'use client';

import { useActionState, useState } from 'react';
import { createSkillAction, type ActionState } from '@/app/actions/catalogue';

const INITIAL: ActionState = { ok: false };

/**
 * Adding a capability to the catalogue.
 *
 * The graded/certification split is the important choice on this form, because
 * the two are checked differently: a graded capability is compared against a
 * minimum level, a certification is either held and current or it is not.
 */
export default function SkillForm() {
  const [state, action, pending] = useActionState(createSkillAction, INITIAL);
  const [kind, setKind] = useState<'GRADED' | 'CERTIFICATION'>('GRADED');

  return (
    <form action={action} className="stack" style={{ gap: 14 }} key={state.createdId ?? 'new'}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div className="field">
        <label className="label" htmlFor="s-name">Name</label>
        <input
          id="s-name"
          name="name"
          className={`input ${state.field === 'name' ? 'input-error' : ''}`}
          required
          placeholder="High-voltage switching"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="s-category">Category</label>
        <input id="s-category" name="category" className="input" placeholder="Electrical" />
        <span className="hint">Used to group the list. Anything sensible works.</span>
      </div>

      <div className="field">
        <label className="label" htmlFor="s-kind">Kind</label>
        <select
          id="s-kind"
          name="kind"
          className="select"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'GRADED' | 'CERTIFICATION')}
        >
          <option value="GRADED">Graded — a level from 0 to 5</option>
          <option value="CERTIFICATION">Certification — held or not held</option>
        </select>
        <span className="hint">
          {kind === 'GRADED'
            ? 'A task asks for a minimum level; anyone below it is removed from consideration.'
            : 'A task asks for the certification outright. A lapsed one counts as not held.'}
        </span>
      </div>

      {kind === 'CERTIFICATION' && (
        <label className="checkline">
          <input type="checkbox" name="expires" defaultChecked />
          <span>
            <span style={{ fontWeight: 580, fontSize: 13.5 }}>This certification expires</span>
            <span className="hint" style={{ display: 'block', marginTop: 2 }}>
              Anyone holding it must record a valid-until date, and it stops counting the day it
              lapses.
            </span>
          </span>
        </label>
      )}

      <div className="field">
        <label className="label" htmlFor="s-desc">Description</label>
        <textarea
          id="s-desc"
          name="description"
          className="textarea"
          style={{ minHeight: 68 }}
          placeholder="What someone holding this can actually do."
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <><span className="spin" /> Adding…</> : 'Add to the catalogue'}
      </button>
    </form>
  );
}
