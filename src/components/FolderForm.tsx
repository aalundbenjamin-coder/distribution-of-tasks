'use client';

/**
 * Creating a folder, and editing the policy of one that exists.
 *
 * The policy fields are the ones worth care: they decide what happens when the
 * system is not certain. Each is presented with what it actually does, not just
 * its name — "asks a person when candidates are too close" is a promise about
 * behaviour, and someone setting it up should be able to read it as one.
 */

import { useActionState } from 'react';
import Link from 'next/link';
import { createFolderAction, updateFolderPolicyAction } from '@/app/actions/folders';
import type { ActionState } from '@/app/actions/catalogue';
import { ROUTING_MODES, TIE_BREAKS, AMBIGUITY_POLICIES } from '@/lib/domain/enums';
import type { Dictionary } from '@/lib/i18n/dictionary';

const INITIAL: ActionState = { ok: false };

export interface PolicyValues {
  routingMode: string;
  tieBreak: string;
  ambiguityPolicy: string;
  tieEpsilon: number;
  minimumScore: number;
}

function PolicyFields({ values, t }: { values: PolicyValues; t: Dictionary }) {
  return (
    <div className="stack" style={{ gap: 15 }}>
      <div className="field">
        <label className="label" htmlFor="f-routing">{t.folders.whenTaskArrives}</label>
        <select id="f-routing" name="routingMode" className="select" defaultValue={values.routingMode}>
          {ROUTING_MODES.map((mode) => (
            <option key={mode} value={mode}>{t.routingMode[mode]}</option>
          ))}
        </select>
        <span className="hint">
          {t.folders.routingHint}
        </span>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-tie">{t.folders.whenSameScore}</label>
        <select id="f-tie" name="tieBreak" className="select" defaultValue={values.tieBreak}>
          {TIE_BREAKS.map((mode) => (
            <option key={mode} value={mode}>{t.tieBreak[mode]}</option>
          ))}
        </select>
        <span className="hint">
          {t.folders.tieHint}
        </span>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-ambiguity">{t.folders.whenTooClose}</label>
        <select
          id="f-ambiguity"
          name="ambiguityPolicy"
          className="select"
          defaultValue={values.ambiguityPolicy}
        >
          {AMBIGUITY_POLICIES.map((mode) => (
            <option key={mode} value={mode}>{t.ambiguity[mode]}</option>
          ))}
        </select>
        <span className="hint">
          {t.folders.ambiguityHint}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="f-epsilon">{t.folders.tieBand}</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="f-epsilon"
              name="tieEpsilon"
              type="number"
              min="0"
              max="50"
              step="1"
              className="input"
              defaultValue={Math.round(values.tieEpsilon * 100)}
            />
            <span className="muted">%</span>
          </div>
          <span className="hint">{t.folders.tieBandHint}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-minimum">{t.folders.minimumScore}</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="f-minimum"
              name="minimumScore"
              type="number"
              min="0"
              max="100"
              step="1"
              className="input"
              defaultValue={Math.round(values.minimumScore * 100)}
            />
            <span className="muted">%</span>
          </div>
          <span className="hint">{t.folders.minimumHint}</span>
        </div>
      </div>
    </div>
  );
}

export function NewFolderForm({
  positions,
  t,
}: {
  positions: { id: string; title: string }[];
  t: Dictionary;
}) {
  const [state, action, pending] = useActionState(createFolderAction, INITIAL);

  if (state.ok && state.createdId) {
    return (
      <div className="card card-pad stack" style={{ gap: 14 }}>
        <div className="notice notice-ok">{state.message}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/folders/${state.createdId}`} className="btn btn-primary">{t.folders.openFolder}</Link>
          <Link href={`/tasks/new?folder=${state.createdId}`} className="btn">{t.folders.sendTask}</Link>
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
            <div className="card-title">{t.folders.theFolder}</div>
            <div className="card-sub">{t.folders.theFolderSub}</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 15 }}>
          <div className="field">
            <label className="label" htmlFor="f-name">{t.folders.name}</label>
            <input
              id="f-name"
              name="name"
              className={`input ${state.field === 'name' ? 'input-error' : ''}`}
              required
              autoFocus
              placeholder={t.folders.namePlaceholder}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="f-desc">{t.folders.whatBelongs}</label>
            <textarea
              id="f-desc"
              name="description"
              className="textarea"
              placeholder={t.folders.whatBelongsPlaceholder}
            />
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="f-dept">{t.coworkers.department}</label>
              <input id="f-dept" name="department" className="input" placeholder="" />
            </div>
            <div className="field">
              <label className="label" htmlFor="f-position">{t.folders.defaultPosition}</label>
              <select id="f-position" name="defaultPositionId" className="select" defaultValue="">
                <option value="">{t.folders.noDefault}</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <span className="hint">{t.folders.defaultHint}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">{t.folders.routingPolicy}</div>
            <div className="card-sub">{t.folders.routingPolicySub}</div>
          </div>
        </header>
        <div className="card-pad">
          <PolicyFields
            values={{
              routingMode: 'AUTO_ASSIGN',
              tieBreak: 'BALANCED_LOAD',
              ambiguityPolicy: 'STRICT',
              tieEpsilon: 0.02,
              minimumScore: 0.5,
            }}
            t={t}
          />
        </div>
      </section>

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> {t.common.creating}</> : t.folders.createFolder}
      </button>
    </form>
  );
}

export function FolderPolicyForm({
  folderId,
  values,
  t,
}: {
  folderId: string;
  values: PolicyValues;
  t: Dictionary;
}) {
  const [state, action, pending] = useActionState(updateFolderPolicyAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 15 }}>
      <input type="hidden" name="folderId" value={folderId} />
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}
      <PolicyFields values={values} t={t} />
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> {t.common.saving}</> : t.folders.savePolicy}
      </button>
    </form>
  );
}
