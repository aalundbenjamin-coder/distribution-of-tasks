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
import {
  AMBIGUITY_POLICY_LABELS,
  ROUTING_MODE_LABELS,
  ROUTING_MODES,
  TIE_BREAKS,
  TIE_BREAK_LABELS,
  AMBIGUITY_POLICIES,
} from '@/lib/domain/enums';

const INITIAL: ActionState = { ok: false };

export interface PolicyValues {
  routingMode: string;
  tieBreak: string;
  ambiguityPolicy: string;
  tieEpsilon: number;
  minimumScore: number;
}

function PolicyFields({ values }: { values: PolicyValues }) {
  return (
    <div className="stack" style={{ gap: 15 }}>
      <div className="field">
        <label className="label" htmlFor="f-routing">When a task arrives</label>
        <select id="f-routing" name="routingMode" className="select" defaultValue={values.routingMode}>
          {ROUTING_MODES.map((mode) => (
            <option key={mode} value={mode}>{ROUTING_MODE_LABELS[mode]}</option>
          ))}
        </select>
        <span className="hint">
          Auto-assign is what saves the time. Propose-only is for work where a person should always
          have the last word.
        </span>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-tie">When two coworkers score the same</label>
        <select id="f-tie" name="tieBreak" className="select" defaultValue={values.tieBreak}>
          {TIE_BREAKS.map((mode) => (
            <option key={mode} value={mode}>{TIE_BREAK_LABELS[mode]}</option>
          ))}
        </select>
        <span className="hint">
          Load balancing and round-robin are what stop one strong coworker absorbing everything.
        </span>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-ambiguity">When they are too close to separate</label>
        <select
          id="f-ambiguity"
          name="ambiguityPolicy"
          className="select"
          defaultValue={values.ambiguityPolicy}
        >
          {AMBIGUITY_POLICIES.map((mode) => (
            <option key={mode} value={mode}>{AMBIGUITY_POLICY_LABELS[mode]}</option>
          ))}
        </select>
        <span className="hint">
          Strict is the safe setting: the task goes to your review queue instead of being guessed at.
        </span>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="field">
          <label className="label" htmlFor="f-epsilon">Tie band</label>
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
          <span className="hint">Scores within this of the leader count as tied.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-minimum">Minimum score to auto-assign</label>
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
          <span className="hint">A weaker best match waits for you instead.</span>
        </div>
      </div>
    </div>
  );
}

export function NewFolderForm({
  positions,
}: {
  positions: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(createFolderAction, INITIAL);

  if (state.ok && state.createdId) {
    return (
      <div className="card card-pad stack" style={{ gap: 14 }}>
        <div className="notice notice-ok">{state.message}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/folders/${state.createdId}`} className="btn btn-primary">Open the folder</Link>
          <Link href={`/tasks/new?folder=${state.createdId}`} className="btn">Send it a task</Link>
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
            <div className="card-title">The folder</div>
            <div className="card-sub">One folder per kind of work that routes the same way.</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 15 }}>
          <div className="field">
            <label className="label" htmlFor="f-name">Name</label>
            <input
              id="f-name"
              name="name"
              className={`input ${state.field === 'name' ? 'input-error' : ''}`}
              required
              autoFocus
              placeholder="Electrical callouts"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="f-desc">What belongs in here</label>
            <textarea
              id="f-desc"
              name="description"
              className="textarea"
              placeholder="Unplanned electrical work on customer sites, up to a day."
            />
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="f-dept">Department</label>
              <input id="f-dept" name="department" className="input" placeholder="Field Service" />
            </div>
            <div className="field">
              <label className="label" htmlFor="f-position">Default position</label>
              <select id="f-position" name="defaultPositionId" className="select" defaultValue="">
                <option value="">No default</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <span className="hint">Applied to tasks that do not name their own.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">Routing policy</div>
            <div className="card-sub">How this folder behaves when it has to make a judgement call.</div>
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
          />
        </div>
      </section>

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> Creating…</> : 'Create the folder'}
      </button>
    </form>
  );
}

export function FolderPolicyForm({
  folderId,
  values,
}: {
  folderId: string;
  values: PolicyValues;
}) {
  const [state, action, pending] = useActionState(updateFolderPolicyAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 15 }}>
      <input type="hidden" name="folderId" value={folderId} />
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}
      <PolicyFields values={values} />
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> Saving…</> : 'Save the policy'}
      </button>
    </form>
  );
}
