'use client';

/**
 * Creating a position.
 *
 * A position is a reusable capability baseline. Defining one well means the
 * next person hired into it starts with the right profile instead of an empty
 * one, and tasks can be restricted to it in a single click.
 */

import { useActionState } from 'react';
import Link from 'next/link';
import RequirementBuilder, { type SkillOption } from './RequirementBuilder';
import { createPositionAction } from '@/app/actions/catalogue';
import type { ActionState } from '@/app/actions/catalogue';
import { BadgeIcon } from './icons';

const INITIAL: ActionState = { ok: false };

const SENIORITY_LABELS: Record<number, string> = {
  1: '1 · Apprentice or trainee',
  2: '2 · Junior',
  3: '3 · Independent',
  4: '4 · Senior',
  5: '5 · Lead or principal',
};

export default function PositionForm({ skills }: { skills: SkillOption[] }) {
  const [state, action, pending] = useActionState(createPositionAction, INITIAL);

  if (state.ok && state.createdId) {
    return (
      <div className="card card-pad stack" style={{ gap: 14 }}>
        <div className="notice notice-ok">{state.message}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link href="/positions" className="btn btn-primary">Back to positions</Link>
          <Link href="/coworkers" className="btn">Assign someone to it</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="stack" style={{ gap: 18 }}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">The position</div>
            <div className="card-sub">What this role is called and where it sits.</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 15 }}>
          <div className="field">
            <label className="label" htmlFor="p-title">Title</label>
            <input
              id="p-title"
              name="title"
              className={`input ${state.field === 'title' ? 'input-error' : ''}`}
              required
              autoFocus
              placeholder="Senior Electrical Technician"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="p-desc">What this role does</label>
            <textarea
              id="p-desc"
              name="description"
              className="textarea"
              placeholder="Fault-finding and repair on customer installations, including live work under permit."
            />
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="p-dept">Department</label>
              <input id="p-dept" name="department" className="input" placeholder="Field Service" />
            </div>
            <div className="field">
              <label className="label" htmlFor="p-seniority">Seniority</label>
              <select id="p-seniority" name="seniority" className="select" defaultValue="3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{SENIORITY_LABELS[n]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">Capability baseline</div>
            <div className="card-sub">
              What someone in this position is expected to be able to do. New coworkers put into this
              position start with these levels, unverified, ready for a lead to sign off.
            </div>
          </div>
        </header>
        <div className="card-pad">
          {skills.length === 0 ? (
            <div className="notice notice-warn">
              <BadgeIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
              <span>
                The capability catalogue is empty.{' '}
                <Link href="/skills" style={{ textDecoration: 'underline' }}>Add capabilities first</Link>,
                then come back and build the baseline.
              </span>
            </div>
          ) : (
            <RequirementBuilder skills={skills} showWeight={false} initialRows={2} />
          )}
        </div>
      </section>

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> Creating…</> : 'Create the position'}
      </button>
    </form>
  );
}
