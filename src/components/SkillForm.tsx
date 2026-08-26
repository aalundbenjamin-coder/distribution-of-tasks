'use client';

import { useActionState, useState } from 'react';
import { createSkillAction, type ActionState } from '@/app/actions/catalogue';
import type { Dictionary } from '@/lib/i18n/dictionary';

const INITIAL: ActionState = { ok: false };

/**
 * Adding a capability to the catalogue.
 *
 * The graded/certification split is the important choice on this form, because
 * the two are checked differently: a graded capability is compared against a
 * minimum level, a certification is either held and current or it is not.
 */
export default function SkillForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState(createSkillAction, INITIAL);
  const [kind, setKind] = useState<'GRADED' | 'CERTIFICATION'>('GRADED');

  return (
    <form action={action} className="stack" style={{ gap: 14 }} key={state.createdId ?? 'new'}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div className="field">
        <label className="label" htmlFor="s-name">{t.skills.name}</label>
        <input
          id="s-name"
          name="name"
          className={`input ${state.field === 'name' ? 'input-error' : ''}`}
          required
          placeholder={t.skills.namePlaceholder}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="s-category">{t.skills.category}</label>
        <input id="s-category" name="category" className="input" placeholder={t.skills.categoryPlaceholder} />
        <span className="hint">{t.skills.categoryHint}</span>
      </div>

      <div className="field">
        <label className="label" htmlFor="s-kind">{t.skills.kind}</label>
        <select
          id="s-kind"
          name="kind"
          className="select"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'GRADED' | 'CERTIFICATION')}
        >
          <option value="GRADED">{t.skills.kindGraded}</option>
          <option value="CERTIFICATION">{t.skills.kindCertification}</option>
        </select>
        <span className="hint">
          {kind === 'GRADED'
            ? t.skills.kindHintGraded
            : t.skills.kindHintCert}
        </span>
      </div>

      {kind === 'CERTIFICATION' && (
        <label className="checkline">
          <input type="checkbox" name="expires" defaultChecked />
          <span>
            <span style={{ fontWeight: 580, fontSize: 13.5 }}>{t.skills.expiresLabel}</span>
            <span className="hint" style={{ display: 'block', marginTop: 2 }}>
              {t.skills.expiresHint}
            </span>
          </span>
        </label>
      )}

      <div className="field">
        <label className="label" htmlFor="s-desc">{t.skills.description}</label>
        <textarea
          id="s-desc"
          name="description"
          className="textarea"
          style={{ minHeight: 68 }}
          placeholder={t.skills.descriptionPlaceholder}
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <><span className="spin" /> {t.common.saving}</> : t.skills.addToCatalogue}
      </button>
    </form>
  );
}
