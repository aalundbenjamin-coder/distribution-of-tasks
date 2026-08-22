'use client';

/**
 * "Send a task to a folder."
 *
 * The form is arranged in the order the decision is actually made: what the
 * work is, where it goes, what it needs, and who may be considered. The
 * requirement rows are the part that matters — everything else is context.
 */

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RequirementBuilder, { type SkillOption } from './RequirementBuilder';
import { createTaskAction, type CreateTaskState } from '@/app/actions/tasks';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from '@/lib/domain/enums';
import { ArrowRightIcon, FolderIcon } from './icons';

export interface FolderOption {
  id: string;
  name: string;
  department: string;
  routingMode: string;
  defaultPositionTitle: string | null;
}

export interface PositionOption {
  id: string;
  title: string;
  department: string;
}

const INITIAL: CreateTaskState = { ok: false };

export default function TaskForm({
  folders,
  positions,
  skills,
  defaultFolderId,
}: {
  folders: FolderOption[];
  positions: PositionOption[];
  skills: SkillOption[];
  defaultFolderId?: string;
}) {
  const [state, action, pending] = useActionState(createTaskAction, INITIAL);
  const [folderId, setFolderId] = useState(defaultFolderId ?? folders[0]?.id ?? '');
  const router = useRouter();

  const folder = folders.find((f) => f.id === folderId);

  if (state.ok && state.taskId) {
    return (
      <div className="card card-pad stack" style={{ gap: 16 }}>
        <div className="notice notice-ok">
          <span>
            <strong>{state.message}</strong>
            {state.outcomeSummary && (
              <span style={{ display: 'block', marginTop: 4 }}>{state.outcomeSummary}</span>
            )}
          </span>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/tasks/${state.taskId}`} className="btn btn-primary">
            See who it went to and why <ArrowRightIcon size={15} />
          </Link>
          <button type="button" className="btn" onClick={() => router.refresh()}>
            Create another task
          </button>
        </div>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="card card-pad">
        <div className="notice notice-warn">
          <FolderIcon size={18} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            There are no folders yet, and a task has to go into one.{' '}
            <Link href="/folders/new" style={{ textDecoration: 'underline' }}>
              Create a folder first
            </Link>
            .
          </span>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="stack" style={{ gap: 18 }}>
      {!state.ok && state.error && (
        <div className="notice notice-danger" role="alert">
          {state.error}
        </div>
      )}

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">The work</div>
            <div className="card-sub">What needs doing, and how much of it there is.</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 15 }}>
          <div className="field">
            <label className="label" htmlFor="t-title">Title</label>
            <input
              id="t-title"
              name="title"
              className={`input ${state.field === 'title' ? 'input-error' : ''}`}
              required
              autoFocus
              placeholder="Replace the pump seal on line 3"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="t-desc">Description</label>
            <textarea
              id="t-desc"
              name="description"
              className="textarea"
              placeholder="Anything the person taking this needs to know — access, parts, safety, who to speak to."
            />
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="t-priority">Priority</label>
              <select id="t-priority" name="priority" className="select" defaultValue="NORMAL">
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="t-hours">Estimated hours</label>
              <input
                id="t-hours"
                name="estimatedHours"
                type="number"
                step="0.25"
                min="0.25"
                max="400"
                defaultValue="4"
                className={`input ${state.field === 'estimatedHours' ? 'input-error' : ''}`}
                required
              />
              <span className="hint">Used to check capacity.</span>
            </div>

            <div className="field">
              <label className="label" htmlFor="t-due">Due date</label>
              <input id="t-due" name="dueAt" type="date" className="input" />
              <span className="hint">Optional.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">Where it goes</div>
            <div className="card-sub">The folder decides how this kind of work is routed.</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 14 }}>
          <div className="field">
            <label className="label" htmlFor="t-folder">Folder</label>
            <select
              id="t-folder"
              name="folderId"
              className="select"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              required
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.department}
                </option>
              ))}
            </select>
          </div>

          {folder && (
            <div className="notice">
              <FolderIcon size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-subtle)' }} />
              <span className="tiny muted">
                {folder.routingMode === 'AUTO_ASSIGN'
                  ? 'This folder assigns automatically as soon as the task is created, provided the best candidate clears the folder’s minimum score and there is no unresolvable tie.'
                  : 'This folder proposes a shortlist and waits for you to confirm. Nothing is assigned automatically.'}
                {folder.defaultPositionTitle &&
                  ` Tasks here default to ${folder.defaultPositionTitle} unless you narrow it below.`}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">What it takes</div>
            <div className="card-sub">
              Mandatory capabilities are the gate. Anyone missing one is removed from consideration
              entirely — no score can override it.
            </div>
          </div>
        </header>
        <div className="card-pad">
          {skills.length === 0 ? (
            <div className="notice notice-warn">
              <span>
                The capability catalogue is empty, so this task cannot state requirements.{' '}
                <Link href="/skills" style={{ textDecoration: 'underline' }}>
                  Add capabilities first
                </Link>
                .
              </span>
            </div>
          ) : (
            <RequirementBuilder skills={skills} />
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">Who may be considered</div>
            <div className="card-sub">Optional extra gates, on top of the capabilities above.</div>
          </div>
        </header>
        <div className="card-pad" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field">
            <label className="label" htmlFor="t-position">Restrict to a position</label>
            <select id="t-position" name="requiredPositionId" className="select" defaultValue="">
              <option value="">Any position</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="t-dept">Restrict to a department</label>
            <input
              id="t-dept"
              name="requiredDepartment"
              className="input"
              placeholder="Any department"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="t-lang">Required languages</label>
            <input id="t-lang" name="requiredLanguages" className="input" placeholder="da, en" />
            <span className="hint">Comma separated. Every one listed must be spoken.</span>
          </div>
        </div>
      </section>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button
          type="submit"
          name="intent"
          value="distribute"
          className="btn btn-primary btn-lg"
          disabled={pending}
        >
          {pending ? <><span className="spin" /> Distributing…</> : <>Send to the folder <ArrowRightIcon size={16} /></>}
        </button>
        <button type="submit" name="intent" value="draft" className="btn btn-lg" disabled={pending}>
          Save as a draft
        </button>
      </div>
    </form>
  );
}
