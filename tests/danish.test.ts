/**
 * The Danish the engine writes about its own decisions.
 *
 * These assertions exist because a translation regression is invisible: the app
 * keeps working, it just starts speaking badly. Pinning the exact sentences
 * means a careless edit to the catalogue fails the build instead of shipping.
 */

import { describe, expect, it } from 'vitest';
import { matchTask } from '@/lib/matching/engine';
import { evaluateGate } from '@/lib/matching/eligibility';
import { DA_MESSAGES } from '@/lib/matching/messages';
import { NOW, coworker, req, skill, task } from './helpers';

const weldingTask = task({
  requirements: [req({ skillId: 'welding', skillName: 'Svejsning', minLevel: 4, weight: 5 })],
});

describe('the gate explains itself in Danish', () => {
  it('names a capability that is missing entirely', () => {
    const gate = evaluateGate(weldingTask, coworker('anna'), NOW, DA_MESSAGES);
    expect(gate.blockers[0].message).toBe('Mangler kompetencen Svejsning.');
  });

  it('names a level that is too low, with both level words', () => {
    const gate = evaluateGate(
      weldingTask,
      coworker('bo', { skills: [skill('welding', 2)] }),
      NOW,
      DA_MESSAGES,
    );
    expect(gate.blockers[0].message).toBe('Svejsning: kræver Avanceret (4), har Med støtte (2).');
  });

  it('names an expired certificate with the Danish date form', () => {
    const certTask = task({
      requirements: [
        req({ skillId: 'cert', skillName: 'Kørekort til truck', skillKind: 'CERTIFICATION' }),
      ],
    });
    const gate = evaluateGate(
      certTask,
      coworker('cara', {
        skills: [skill('cert', 5, { expiresAt: new Date('2026-01-15T00:00:00Z') })],
      }),
      NOW,
      DA_MESSAGES,
    );
    expect(gate.blockers[0].message).toBe('Certifikatet Kørekort til truck udløb den 15. januar 2026.');
  });

  it('uses the definite article for availability', () => {
    const gate = evaluateGate(task(), coworker('dan', { availability: 'ON_LEAVE' }), NOW, DA_MESSAGES);
    expect(gate.blockers[0].message).toBe('Er på orlov.');
  });

  it('counts hours with the Danish abbreviation', () => {
    const gate = evaluateGate(
      task({ estimatedHours: 10 }),
      coworker('eva', { weeklyCapacityHours: 37, committedHours: 32 }),
      NOW,
      DA_MESSAGES,
    );
    expect(gate.blockers[0].message).toBe(
      'Kræver 10 t, men der er kun 5 t tilbage af 37 t i denne uge.',
    );
  });
});

describe('the outcome reads correctly in Danish', () => {
  it('inflects the singular and plural of "kvalificeret medarbejder"', () => {
    const one = matchTask(weldingTask, [coworker('a', { skills: [skill('welding', 5)] })], {
      now: NOW,
      locale: 'da',
    });
    expect(one.summary).toContain('ud af 1 kvalificeret medarbejder.');

    const many = matchTask(
      weldingTask,
      [
        coworker('a', { skills: [skill('welding', 5)] }),
        coworker('b', { skills: [skill('welding', 4)] }),
      ],
      { now: NOW, locale: 'da' },
    );
    expect(many.summary).toContain('ud af 2 kvalificerede medarbejdere.');
  });

  it('writes a rationale with Danish factor names', () => {
    const result = matchTask(
      weldingTask,
      [coworker('anna', { fullName: 'Anna Holm', skills: [skill('welding', 5, { verified: true })] })],
      { now: NOW, locale: 'da' },
    );
    expect(result.rationale).toContain('Anna Holm fik');
    expect(result.rationale).toContain('kompetencematch');
  });

  it('says nobody qualified, with the plural of "profil"', () => {
    const result = matchTask(weldingTask, [coworker('a'), coworker('b')], {
      now: NOW,
      locale: 'da',
    });
    expect(result.summary).toBe(
      'Ingen medarbejder opfylder alle krav til denne opgave. 2 profiler blev kontrolleret.',
    );
  });

  it('inflects "åben opgave" in the tie-break sentence', () => {
    const identical = (id: string, open: number) =>
      coworker(id, { skills: [skill('welding', 4, { verified: true })], openTaskCount: open });
    const result = matchTask(weldingTask, [identical('anna', 3), identical('bo', 1)], {
      now: NOW,
      locale: 'da',
      policy: { tieBreak: 'BALANCED_LOAD', ambiguityPolicy: 'AUTO' },
    });
    // Different open counts separate them on score, so assert the Danish detail line instead.
    const winner = result.selected!;
    const workload = winner.factors.find((f) => f.key === 'workloadBalance')!;
    expect(workload.label).toBe('Fordeling af arbejdsbyrde');
    expect(workload.detail).toBe('1 åben opgave; den travleste på listen har 3.');
  });

  it('uses the plural form when there is more than one open task', () => {
    const identical = (id: string, open: number) =>
      coworker(id, { skills: [skill('welding', 4)], openTaskCount: open });
    const result = matchTask(weldingTask, [identical('anna', 4), identical('bo', 2)], {
      now: NOW,
      locale: 'da',
      policy: { ambiguityPolicy: 'AUTO' },
    });
    const workload = result.selected!.factors.find((f) => f.key === 'workloadBalance')!;
    expect(workload.detail).toBe('2 åbne opgaver; den travleste på listen har 4.');
  });
});

describe('English is still the default', () => {
  it('produces English when no locale is given', () => {
    const result = matchTask(weldingTask, [coworker('a', { skills: [skill('welding', 5)] })], {
      now: NOW,
    });
    expect(result.summary).toContain('qualified coworker');
    expect(result.selected!.factors[0].label).toBe('Capability fit');
  });
});
