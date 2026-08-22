import { describe, expect, it } from 'vitest';
import { evaluateGate } from '@/lib/matching/eligibility';
import { NOW, coworker, req, skill, task } from './helpers';

describe('the hard gate keeps unqualified coworkers out', () => {
  it('lets a coworker through when every mandatory capability is met', () => {
    const t = task({ requirements: [req({ skillId: 'welding', minLevel: 3 })] });
    const c = coworker('anna', { skills: [skill('welding', 3)] });
    const gate = evaluateGate(t, c, NOW);
    expect(gate.eligible).toBe(true);
    expect(gate.blockers).toHaveLength(0);
  });

  it('blocks a coworker whose level is one step too low', () => {
    const t = task({ requirements: [req({ skillId: 'welding', skillName: 'Welding', minLevel: 4 })] });
    const c = coworker('bo', { skills: [skill('welding', 3)] });
    const gate = evaluateGate(t, c, NOW);
    expect(gate.eligible).toBe(false);
    expect(gate.blockers[0].code).toBe('SKILL_LEVEL_TOO_LOW');
    expect(gate.blockers[0].message).toContain('Welding');
  });

  it('blocks a coworker who does not have the capability at all', () => {
    const t = task({ requirements: [req({ skillId: 'welding', skillName: 'Welding' })] });
    const gate = evaluateGate(t, coworker('cara'), NOW);
    expect(gate.eligible).toBe(false);
    expect(gate.blockers.map((b) => b.code)).toEqual(['MISSING_SKILL']);
  });

  it('treats a level of 0 as not having the capability', () => {
    const t = task({ requirements: [req({ skillId: 'welding', minLevel: 1 })] });
    const gate = evaluateGate(t, coworker('dan', { skills: [skill('welding', 0)] }), NOW);
    expect(gate.eligible).toBe(false);
  });

  it('never blocks on a preferred capability', () => {
    const t = task({
      requirements: [
        req({ skillId: 'welding', minLevel: 3 }),
        req({ skillId: 'crane', minLevel: 4, necessity: 'PREFERRED' }),
      ],
    });
    const gate = evaluateGate(t, coworker('eve', { skills: [skill('welding', 3)] }), NOW);
    expect(gate.eligible).toBe(true);
    // …but the miss is still recorded, so ranking and the UI can use it.
    const finding = gate.findings.find((f) => f.skillId === 'crane');
    expect(finding?.met).toBe(false);
    expect(finding?.necessity).toBe('PREFERRED');
  });

  it('reports every blocker at once rather than only the first', () => {
    const t = task({
      requirements: [
        req({ skillId: 'welding', minLevel: 4 }),
        req({ skillId: 'crane', minLevel: 3 }),
      ],
      requiredLanguages: ['da'],
    });
    const c = coworker('finn', { skills: [skill('welding', 2)], languages: ['en'] });
    const gate = evaluateGate(t, c, NOW);
    expect(gate.blockers.map((b) => b.code).sort()).toEqual([
      'MISSING_LANGUAGE',
      'MISSING_SKILL',
      'SKILL_LEVEL_TOO_LOW',
    ]);
  });
});

describe('certifications', () => {
  const certTask = task({
    requirements: [
      req({ skillId: 'forklift', skillName: 'Forklift licence', skillKind: 'CERTIFICATION' }),
    ],
  });

  it('accepts a held, unexpired certification', () => {
    const c = coworker('gita', {
      skills: [skill('forklift', 5, { expiresAt: new Date('2027-01-01T00:00:00Z') })],
    });
    expect(evaluateGate(certTask, c, NOW).eligible).toBe(true);
  });

  it('accepts a certification with no expiry', () => {
    const c = coworker('hans', { skills: [skill('forklift', 5)] });
    expect(evaluateGate(certTask, c, NOW).eligible).toBe(true);
  });

  it('rejects a lapsed certification even though the level is 5', () => {
    const c = coworker('iris', {
      skills: [skill('forklift', 5, { expiresAt: new Date('2026-01-01T00:00:00Z') })],
    });
    const gate = evaluateGate(certTask, c, NOW);
    expect(gate.eligible).toBe(false);
    expect(gate.blockers[0].code).toBe('CERTIFICATION_EXPIRED');
  });

  it('rejects a missing certification', () => {
    const gate = evaluateGate(certTask, coworker('jon'), NOW);
    expect(gate.blockers[0].code).toBe('CERTIFICATION_MISSING');
  });
});

describe('availability, position, department and language gates', () => {
  it('blocks anyone who is not currently active', () => {
    for (const availability of ['ON_LEAVE', 'UNAVAILABLE', 'OFFBOARDED'] as const) {
      const gate = evaluateGate(task(), coworker('k', { availability }), NOW);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers[0].code).toBe('NOT_AVAILABLE');
    }
  });

  it('blocks someone whose availability starts after today', () => {
    const gate = evaluateGate(
      task(),
      coworker('lea', { availableFrom: new Date('2026-04-01T00:00:00Z') }),
      NOW,
    );
    expect(gate.blockers[0].code).toBe('OUTSIDE_AVAILABILITY_WINDOW');
  });

  it('blocks someone whose availability ends before the deadline', () => {
    const t = task({ dueAt: new Date('2026-05-01T00:00:00Z') });
    const gate = evaluateGate(
      t,
      coworker('mads', { availableUntil: new Date('2026-04-01T00:00:00Z') }),
      NOW,
    );
    expect(gate.blockers[0].code).toBe('OUTSIDE_AVAILABILITY_WINDOW');
  });

  it('honours an explicit exclusion', () => {
    const gate = evaluateGate(
      task(),
      coworker('nina', { exclusionReason: 'Conflict of interest with the customer' }),
      NOW,
    );
    expect(gate.blockers[0].code).toBe('EXPLICITLY_EXCLUDED');
    expect(gate.blockers[0].message).toContain('Conflict of interest');
  });

  it('enforces a required position', () => {
    const t = task({ requiredPositionId: 'pos-senior', requiredPositionTitle: 'Senior Technician' });
    expect(evaluateGate(t, coworker('olav', { positionId: 'pos-junior' }), NOW).blockers[0].code).toBe(
      'WRONG_POSITION',
    );
    expect(evaluateGate(t, coworker('pia', { positionId: 'pos-senior' }), NOW).eligible).toBe(true);
  });

  it('enforces a required department, case-insensitively', () => {
    const t = task({ requiredDepartment: 'Field Service' });
    expect(evaluateGate(t, coworker('q', { department: 'Workshop' }), NOW).blockers[0].code).toBe(
      'WRONG_DEPARTMENT',
    );
    expect(evaluateGate(t, coworker('r', { department: 'field service' }), NOW).eligible).toBe(true);
  });

  it('requires every listed language, not just one of them', () => {
    const t = task({ requiredLanguages: ['da', 'de'] });
    const gate = evaluateGate(t, coworker('sven', { languages: ['da', 'en'] }), NOW);
    expect(gate.eligible).toBe(false);
    expect(gate.blockers[0].message).toContain('DE');
    expect(evaluateGate(t, coworker('tina', { languages: ['DA', 'de', 'en'] }), NOW).eligible).toBe(true);
  });
});

describe('capacity', () => {
  it('blocks a coworker with no room left in the week', () => {
    const t = task({ estimatedHours: 10 });
    const c = coworker('ulla', { weeklyCapacityHours: 37, committedHours: 30 });
    const gate = evaluateGate(t, c, NOW);
    expect(gate.eligible).toBe(false);
    expect(gate.blockers[0].code).toBe('NO_CAPACITY');
    expect(gate.blockers[0].message).toContain('7 h');
  });

  it('allows a task that exactly fills the remaining capacity', () => {
    const t = task({ estimatedHours: 7 });
    const c = coworker('vera', { weeklyCapacityHours: 37, committedHours: 30 });
    const gate = evaluateGate(t, c, NOW);
    expect(gate.eligible).toBe(true);
    expect(gate.remainingHoursAfterTask).toBe(0);
  });
});
