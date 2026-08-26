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
import type { Dictionary } from '@/lib/i18n/dictionary';

const INITIAL: ActionState = { ok: false };

export default function PositionForm({ skills, t }: { skills: SkillOption[]; t: Dictionary }) {
  const [state, action, pending] = useActionState(createPositionAction, INITIAL);

  if (state.ok && state.createdId) {
    return (
      <div className="card card-pad stack" style={{ gap: 14 }}>
        <div className="notice notice-ok">{state.message}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link href="/positions" className="btn btn-primary">{t.positions.backToPositions}</Link>
          <Link href="/coworkers" className="btn">{t.positions.assignSomeone}</Link>
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
            <div className="card-title">{t.positions.thePosition}</div>
            <div className="card-sub">{t.positions.thePositionSub}</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 15 }}>
          <div className="field">
            <label className="label" htmlFor="p-title">{t.positions.positionTitle}</label>
            <input
              id="p-title"
              name="title"
              className={`input ${state.field === 'title' ? 'input-error' : ''}`}
              required
              autoFocus
              placeholder={t.positions.titlePlaceholder}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="p-desc">{t.positions.whatRoleDoes}</label>
            <textarea
              id="p-desc"
              name="description"
              className="textarea"
              placeholder={t.positions.rolePlaceholder}
            />
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="p-dept">{t.coworkers.department}</label>
              <input id="p-dept" name="department" className="input" placeholder="" />
            </div>
            <div className="field">
              <label className="label" htmlFor="p-seniority">{t.positions.seniorityLabel}</label>
              <select id="p-seniority" name="seniority" className="select" defaultValue="3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">{t.positions.baseline}</div>
            <div className="card-sub">{t.positions.baselineSub}</div>
          </div>
        </header>
        <div className="card-pad">
          {skills.length === 0 ? (
            <div className="notice notice-warn">
              <BadgeIcon size={17} style={{ flex: 'none', marginTop: 1 }} />
              <span>
                {t.positions.catalogueEmpty}{' '}
                <Link href="/skills" style={{ textDecoration: 'underline' }}>
                  {t.positions.addFirst}
                </Link>.
              </span>
            </div>
          ) : (
            <RequirementBuilder skills={skills} showWeight={false} initialRows={2} t={t} />
          )}
        </div>
      </section>

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> {t.common.creating}</> : t.positions.createPosition}
      </button>
    </form>
  );
}
