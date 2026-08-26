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
import { TASK_PRIORITIES } from '@/lib/domain/enums';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { fill } from '@/lib/i18n/locale';
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
  t,
}: {
  folders: FolderOption[];
  positions: PositionOption[];
  skills: SkillOption[];
  defaultFolderId?: string;
  t: Dictionary;
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
            {t.tasks.seeWhoAndWhy} <ArrowRightIcon size={15} />
          </Link>
          <button type="button" className="btn" onClick={() => router.refresh()}>
            {t.tasks.createAnother}
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
            {t.tasks.noFoldersYet}{' '}
            <Link href="/folders/new" style={{ textDecoration: 'underline' }}>
              {t.tasks.createFolderFirst}
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
            <div className="card-title">{t.tasks.theWork}</div>
            <div className="card-sub">{t.tasks.theWorkSub}</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 15 }}>
          <div className="field">
            <label className="label" htmlFor="t-title">{t.tasks.fieldTitle}</label>
            <input
              id="t-title"
              name="title"
              className={`input ${state.field === 'title' ? 'input-error' : ''}`}
              required
              autoFocus
              placeholder={t.tasks.titlePlaceholder}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="t-desc">{t.tasks.fieldDescription}</label>
            <textarea
              id="t-desc"
              name="description"
              className="textarea"
              placeholder={t.tasks.descPlaceholder}
            />
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="field">
              <label className="label" htmlFor="t-priority">{t.tasks.priority}</label>
              <select id="t-priority" name="priority" className="select" defaultValue="NORMAL">
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{t.priority[p]}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="t-hours">{t.tasks.estimatedHours}</label>
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
              <span className="hint">{t.tasks.estimatedHint}</span>
            </div>

            <div className="field">
              <label className="label" htmlFor="t-due">{t.tasks.dueDate}</label>
              <input id="t-due" name="dueAt" type="date" className="input" />
              <span className="hint">{t.common.optional}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">{t.tasks.whereItGoes}</div>
            <div className="card-sub">{t.tasks.whereItGoesSub}</div>
          </div>
        </header>
        <div className="card-pad stack" style={{ gap: 14 }}>
          <div className="field">
            <label className="label" htmlFor="t-folder">{t.tasks.folder}</label>
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
                {folder.routingMode === 'AUTO_ASSIGN' ? t.tasks.autoNote : t.tasks.proposeNote}
                {folder.defaultPositionTitle &&
                  ` ${fill(t.tasks.defaultsTo, { position: folder.defaultPositionTitle })}`}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">{t.tasks.whatItTakes}</div>
            <div className="card-sub">{t.tasks.whatItTakesSub}</div>
          </div>
        </header>
        <div className="card-pad">
          {skills.length === 0 ? (
            <div className="notice notice-warn">
              <span>
                {t.tasks.catalogueEmpty}{' '}
                <Link href="/skills" style={{ textDecoration: 'underline' }}>
                  {t.tasks.addCapabilitiesFirst}
                </Link>
                .
              </span>
            </div>
          ) : (
            <RequirementBuilder skills={skills} t={t} />
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <div className="card-title">{t.tasks.whoMayBeConsidered}</div>
            <div className="card-sub">{t.tasks.whoSub}</div>
          </div>
        </header>
        <div className="card-pad" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field">
            <label className="label" htmlFor="t-position">{t.tasks.restrictPosition}</label>
            <select id="t-position" name="requiredPositionId" className="select" defaultValue="">
              <option value="">{t.tasks.anyPosition}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="t-dept">{t.tasks.restrictDepartment}</label>
            <input
              id="t-dept"
              name="requiredDepartment"
              className="input"
              placeholder={t.tasks.anyDepartment}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="t-lang">{t.tasks.requiredLanguages}</label>
            <input id="t-lang" name="requiredLanguages" className="input" placeholder="da, en" />
            <span className="hint">{t.tasks.languagesHint}</span>
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
          {pending ? (
            <><span className="spin" /> {t.tasks.distributing}</>
          ) : (
            <>{t.tasks.sendToFolder} <ArrowRightIcon size={16} /></>
          )}
        </button>
        <button type="submit" name="intent" value="draft" className="btn btn-lg" disabled={pending}>
          {t.tasks.saveDraft}
        </button>
      </div>
    </form>
  );
}
