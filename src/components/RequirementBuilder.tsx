'use client';

/**
 * The repeating "capability + minimum level" rows used by both the task form
 * and the position form.
 *
 * Mandatory and preferred are presented as the distinct things they are:
 * mandatory rows are what keep unqualified people out, preferred rows only move
 * the ranking. Getting that wrong is the most consequential mistake someone can
 * make on these forms, so the difference is spelled out on screen rather than
 * hidden in a dropdown label.
 */

import { useState } from 'react';
import { SKILL_LEVEL_LABELS } from '@/lib/domain/enums';
import { PlusIcon, XIcon } from './icons';

export interface SkillOption {
  id: string;
  name: string;
  category: string;
  kind: string;
}

interface Row {
  key: number;
  skillId: string;
  minLevel: number;
  necessity: 'MANDATORY' | 'PREFERRED';
  weight: number;
}

let nextKey = 1;

export default function RequirementBuilder({
  skills,
  showWeight = true,
  initialRows = 1,
}: {
  skills: SkillOption[];
  showWeight?: boolean;
  initialRows?: number;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: initialRows }, () => ({
      key: nextKey++,
      skillId: '',
      minLevel: 3,
      necessity: 'MANDATORY' as const,
      weight: 3,
    })),
  );

  const used = new Set(rows.map((r) => r.skillId).filter(Boolean));

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey++, skillId: '', minLevel: 3, necessity: 'MANDATORY', weight: 3 },
    ]);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  const grouped = groupByCategory(skills);
  const mandatoryCount = rows.filter((r) => r.skillId && r.necessity === 'MANDATORY').length;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((row) => {
        const skill = skills.find((s) => s.id === row.skillId);
        const isCertification = skill?.kind === 'CERTIFICATION';

        return (
          <div
            key={row.key}
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: showWeight
                ? 'minmax(160px, 2fr) minmax(130px, 1fr) minmax(130px, 1fr) 90px 36px'
                : 'minmax(160px, 2fr) minmax(130px, 1fr) minmax(130px, 1fr) 36px',
              alignItems: 'end',
            }}
          >
            <div className="field">
              <label className="tiny subtle">Capability</label>
              <select
                className="select"
                name="requirement_skill"
                value={row.skillId}
                onChange={(e) => update(row.key, { skillId: e.target.value })}
              >
                <option value="">Choose a capability…</option>
                {grouped.map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((s) => (
                      <option key={s.id} value={s.id} disabled={used.has(s.id) && s.id !== row.skillId}>
                        {s.name}
                        {s.kind === 'CERTIFICATION' ? ' (certification)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="tiny subtle">
                {isCertification ? 'Requirement' : 'Minimum level'}
              </label>
              <select
                className="select"
                name="requirement_level"
                value={isCertification ? 5 : row.minLevel}
                disabled={isCertification}
                onChange={(e) => update(row.key, { minLevel: Number(e.target.value) })}
              >
                {isCertification ? (
                  <option value={5}>Must hold it</option>
                ) : (
                  [1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {SKILL_LEVEL_LABELS[n]}
                    </option>
                  ))
                )}
              </select>
              {/* A disabled select posts nothing, so certifications post here. */}
              {isCertification && <input type="hidden" name="requirement_level" value={5} />}
            </div>

            <div className="field">
              <label className="tiny subtle">Necessity</label>
              <select
                className="select"
                name="requirement_necessity"
                value={row.necessity}
                onChange={(e) =>
                  update(row.key, { necessity: e.target.value as 'MANDATORY' | 'PREFERRED' })
                }
              >
                <option value="MANDATORY">Mandatory — disqualifying</option>
                <option value="PREFERRED">Preferred — a plus</option>
              </select>
            </div>

            {showWeight && (
              <div className="field">
                <label className="tiny subtle">Weight</label>
                <select
                  className="select"
                  name="requirement_weight"
                  value={row.weight}
                  onChange={(e) => update(row.key, { weight: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: 9 }}
              onClick={() => removeRow(row.key)}
              aria-label="Remove this requirement"
              disabled={rows.length === 1}
            >
              <XIcon size={15} />
            </button>
          </div>
        );
      })}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" onClick={addRow}>
          <PlusIcon size={14} /> Add a capability
        </button>
        <span className="tiny subtle">
          {mandatoryCount === 0
            ? 'No mandatory capability yet — anyone available would qualify.'
            : `${mandatoryCount} mandatory requirement${mandatoryCount === 1 ? '' : 's'}: a coworker missing any one of them is removed from consideration.`}
        </span>
      </div>
    </div>
  );
}

function groupByCategory(skills: SkillOption[]): [string, SkillOption[]][] {
  const map = new Map<string, SkillOption[]>();
  for (const skill of skills) {
    const list = map.get(skill.category) ?? [];
    list.push(skill);
    map.set(skill.category, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
