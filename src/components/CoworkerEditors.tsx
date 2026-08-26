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
import { AVAILABILITIES } from '@/lib/domain/enums';
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
  labels,
}: {
  labels: {
    position: string; noPosition: string; department: string; availability: string;
    availabilityHint: string; availabilityLabels: Record<string, string>;
    capacity: string; capacityHint: string; languages: string; languagesHint: string;
    timezone: string; availableFrom: string; availableUntil: string; availableUntilHint: string;
    employeeNumber: string; notes: string; notesPlaceholder: string;
    submit: string; submitting: string;
  };
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
          <label className="label" htmlFor="c-position">{labels.position}</label>
          <select id="c-position" name="positionId" className="select" defaultValue={values.positionId ?? ''}>
            <option value="">{labels.noPosition}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-dept">{labels.department}</label>
          <input id="c-dept" name="department" className="input" defaultValue={values.department} />
        </div>

        <div className="field">
          <label className="label" htmlFor="c-avail">{labels.availability}</label>
          <select id="c-avail" name="availability" className="select" defaultValue={values.availability}>
            {AVAILABILITIES.map((a) => (
              <option key={a} value={a}>{labels.availabilityLabels[a]}</option>
            ))}
          </select>
          <span className="hint">{labels.availabilityHint}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-capacity">{labels.capacity}</label>
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
          <span className="hint">{labels.capacityHint}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-langs">{labels.languages}</label>
          <input id="c-langs" name="languages" className="input" defaultValue={values.languages} placeholder="da, en" />
          <span className="hint">{labels.languagesHint}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-tz">{labels.timezone}</label>
          <input id="c-tz" name="timezone" className="input" defaultValue={values.timezone} />
        </div>

        <div className="field">
          <label className="label" htmlFor="c-from">{labels.availableFrom}</label>
          <input id="c-from" name="availableFrom" type="date" className="input" defaultValue={values.availableFrom ?? ''} />
        </div>

        <div className="field">
          <label className="label" htmlFor="c-until">{labels.availableUntil}</label>
          <input id="c-until" name="availableUntil" type="date" className="input" defaultValue={values.availableUntil ?? ''} />
          <span className="hint">{labels.availableUntilHint}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="c-empno">{labels.employeeNumber}</label>
          <input id="c-empno" name="employeeNumber" className="input" defaultValue={values.employeeNumber ?? ''} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="c-notes">{labels.notes}</label>
        <textarea
          id="c-notes"
          name="notes"
          className="textarea"
          defaultValue={values.notes ?? ''}
          placeholder={labels.notesPlaceholder}
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> {labels.submitting}</> : labels.submit}
      </button>
    </form>
  );
}

export function SkillEditor({
  coworkerId,
  skills,
  held,
  canVerify,
  labels,
}: {
  coworkerId: string;
  skills: SkillChoice[];
  held: string[];
  canVerify: boolean;
  labels: {
    capability: string; choose: string; level: string; statusHeld: string; years: string;
    validUntil: string; evidence: string; evidencePlaceholder: string; verifiedByMe: string;
    verifiedHint: string; selfNote: string; submit: string; submitting: string;
    levelLabels: Record<number, string>; certification: string;
  };
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
        <label className="label" htmlFor="cs-skill">{labels.capability}</label>
        <select
          id="cs-skill"
          name="skillId"
          className="select"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          required
        >
          <option value="">{labels.choose}</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.kind === 'CERTIFICATION' ? ` (${labels.certification.toLowerCase()})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="cs-level">{labels.level}</label>
          <select id="cs-level" name="level" className="select" defaultValue={isCertification ? 5 : 3}>
            {isCertification ? (
              <option value={5}>{labels.statusHeld}</option>
            ) : (
              [1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} · {labels.levelLabels[n]}</option>
              ))
            )}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="cs-years">{labels.years}</label>
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
            <label className="label" htmlFor="cs-expiry">{labels.validUntil}</label>
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
        <label className="label" htmlFor="cs-evidence">{labels.evidence}</label>
        <input
          id="cs-evidence"
          name="evidence"
          className="input"
          placeholder={labels.evidencePlaceholder}
        />
      </div>

      {canVerify ? (
        <label className="checkline">
          <input type="checkbox" name="verified" />
          <span>
            <span className="row" style={{ gap: 7, fontWeight: 580, fontSize: 13.5 }}>
              <ShieldIcon size={14} /> {labels.verifiedByMe}
            </span>
            <span className="hint" style={{ display: 'block', marginTop: 2 }}>
              {labels.verifiedHint}
            </span>
          </span>
        </label>
      ) : (
        <p className="tiny muted">
          {labels.selfNote}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={pending || !skillId}>
        {pending ? <><span className="spin" /> {labels.submitting}</> : labels.submit}
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
