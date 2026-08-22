'use client';

/**
 * Editing a coworker's profile and their capabilities.
 *
 * Whether the "verified" control is even rendered depends on who is looking:
 * a coworker describing their own capabilities cannot sign them off, because a
 * verification that anyone can grant themselves would tell the ranking nothing.
 */

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  removeCoworkerSkillAction,
  updateCoworkerProfileAction,
  upsertCoworkerSkillAction,
} from '@/app/actions/coworkers';
import type { ActionState } from '@/app/actions/catalogue';
import {
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  SKILL_LEVEL_LABELS,
} from '@/lib/domain/enums';
import { ShieldIcon, XIcon } from './icons';

const INITIAL: ActionState = { ok: false };

export interface SkillChoice {
  id: string;
  name: string;
  category: string;
  kind: string;
  expires: boolean;
}

export function ProfileForm({
  coworkerId,
  positions,
  values,
}: {
  coworkerId: string;
  positions: { id: string; title: string }[];
  values: {
    positionId: string | null;
    department: string;
    availability: string;
    weeklyCapacityHours: number;
    languages: string;
    timezone: string;
    notes: string | null;
    employeeNumber: string | null;
    availableFrom: string | null;
    availableUntil: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateCoworkerProfileAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="coworkerId" value={coworkerId} />
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="c-position">Position</label>
          <select id="c-position" name="positionId" className="select" defaultValue={values.positionId ?? ''}>
            <option value="">No position</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-dept">Department</label>
          <input id="c-dept" name="department" className="input" defaultValue={values.department} />
        </div>

        <div className="field">
          <label className="label" htmlFor="c-avail">Availability</label>
          <select id="c-avail" name="availability" className="select" defaultValue={values.availability}>
            {AVAILABILITIES.map((a) => (
              <option key={a} value={a}>{AVAILABILITY_LABELS[a]}</option>
            ))}
          </select>
          <span className="hint">Only &ldquo;available&rdquo; can receive work.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-capacity">Weekly capacity (hours)</label>
          <input
            id="c-capacity"
            name="weeklyCapacityHours"
            type="number"
            min="0"
            max="80"
            step="0.5"
            className="input"
            defaultValue={values.weeklyCapacityHours}
          />
          <span className="hint">A task that does not fit is not offered.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-langs">Languages</label>
          <input id="c-langs" name="languages" className="input" defaultValue={values.languages} placeholder="da, en" />
          <span className="hint">Comma-separated ISO codes.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-tz">Time zone</label>
          <input id="c-tz" name="timezone" className="input" defaultValue={values.timezone} />
        </div>

        <div className="field">
          <label className="label" htmlFor="c-from">Available from</label>
          <input id="c-from" name="availableFrom" type="date" className="input" defaultValue={values.availableFrom ?? ''} />
        </div>

        <div className="field">
          <label className="label" htmlFor="c-until">Available until</label>
          <input id="c-until" name="availableUntil" type="date" className="input" defaultValue={values.availableUntil ?? ''} />
          <span className="hint">Blocks work due after this date.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-empno">Employee number</label>
          <input id="c-empno" name="employeeNumber" className="input" defaultValue={values.employeeNumber ?? ''} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="c-notes">Notes</label>
        <textarea
          id="c-notes"
          name="notes"
          className="textarea"
          defaultValue={values.notes ?? ''}
          placeholder="Anything the structured fields do not capture — site restrictions, shift pattern, equipment they are checked out on."
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> Saving…</> : 'Save the profile'}
      </button>
    </form>
  );
}

export function SkillEditor({
  coworkerId,
  skills,
  held,
  canVerify,
}: {
  coworkerId: string;
  skills: SkillChoice[];
  held: string[];
  canVerify: boolean;
}) {
  const [state, action, pending] = useActionState(upsertCoworkerSkillAction, INITIAL);
  const [skillId, setSkillId] = useState('');

  const chosen = skills.find((s) => s.id === skillId);
  const isCertification = chosen?.kind === 'CERTIFICATION';
  const available = skills.filter((s) => !held.includes(s.id) || s.id === skillId);

  return (
    <form action={action} className="stack" style={{ gap: 13 }} key={state.ok ? Math.random() : 'form'}>
      <input type="hidden" name="coworkerId" value={coworkerId} />
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div className="field">
        <label className="label" htmlFor="cs-skill">Capability</label>
        <select
          id="cs-skill"
          name="skillId"
          className="select"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          required
        >
          <option value="">Choose…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.kind === 'CERTIFICATION' ? ' (certification)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="cs-level">{isCertification ? 'Status' : 'Level'}</label>
          <select id="cs-level" name="level" className="select" defaultValue={isCertification ? 5 : 3}>
            {isCertification ? (
              <option value={5}>Holds it</option>
            ) : (
              [1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} · {SKILL_LEVEL_LABELS[n]}</option>
              ))
            )}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="cs-years">Years of experience</label>
          <input
            id="cs-years"
            name="yearsExperience"
            type="number"
            min="0"
            max="60"
            step="0.5"
            className="input"
            defaultValue="0"
          />
        </div>

        {(isCertification || chosen?.expires) && (
          <div className="field">
            <label className="label" htmlFor="cs-expiry">Valid until</label>
            <input
              id="cs-expiry"
              name="expiresAt"
              type="date"
              className={`input ${state.field === 'expiresAt' ? 'input-error' : ''}`}
              required={chosen?.expires}
            />
          </div>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="cs-evidence">Evidence</label>
        <input
          id="cs-evidence"
          name="evidence"
          className="input"
          placeholder="Certificate number, course, or who observed it"
        />
      </div>

      {canVerify ? (
        <label className="checkline">
          <input type="checkbox" name="verified" />
          <span>
            <span className="row" style={{ gap: 7, fontWeight: 580, fontSize: 13.5 }}>
              <ShieldIcon size={14} /> Verified by me as a lead
            </span>
            <span className="hint" style={{ display: 'block', marginTop: 2 }}>
              Verified capabilities rank above self-declared ones. Only tick this if you have
              actually seen the work or the certificate.
            </span>
          </span>
        </label>
      ) : (
        <p className="tiny muted">
          Capabilities you record yourself count for matching, but rank below ones a lead has signed
          off. Ask your lead to verify them.
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={pending || !skillId}>
        {pending ? <><span className="spin" /> Saving…</> : 'Save this capability'}
      </button>
    </form>
  );
}

export function RemoveSkillButton({
  coworkerId,
  skillId,
  skillName,
}: {
  coworkerId: string;
  skillId: string;
  skillName: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{ padding: 5, color: 'var(--text-subtle)' }}
      aria-label={`Remove ${skillName}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeCoworkerSkillAction(coworkerId, skillId);
          router.refresh();
        })
      }
    >
      <XIcon size={14} />
    </button>
  );
}
