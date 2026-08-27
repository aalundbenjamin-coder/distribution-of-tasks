/**
 * Every state the domain can be in has a name in both languages.
 *
 * TypeScript already forces the Danish dictionary to carry the same keys as the
 * English one, but nothing connects either of them to the enums they describe.
 * A status added to the domain and forgotten here falls back to whichever key
 * the badge happens to default to, and shows the reader a confidently wrong
 * label rather than an obviously missing one.
 */

import { describe, expect, it } from 'vitest';
import { da, en } from '@/lib/i18n/dictionary';
import { LOCALES } from '@/lib/i18n/locale';
import {
  ASSIGNMENT_STATUSES,
  AVAILABILITIES,
  MATCH_OUTCOMES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/domain/enums';

const SECTIONS = {
  taskStatus: TASK_STATUSES,
  assignmentStatus: ASSIGNMENT_STATUSES,
  availability: AVAILABILITIES,
  priority: TASK_PRIORITIES,
  outcome: MATCH_OUTCOMES,
} as const;

const dictionaries = { da, en } as const;

describe('status labels', () => {
  for (const locale of LOCALES) {
    for (const [section, values] of Object.entries(SECTIONS)) {
      it(`${locale}: every ${section} has a label`, () => {
        const labels = dictionaries[locale][section as keyof typeof SECTIONS] as Record<string, string>;
        for (const value of values) {
          expect(labels[value], `${locale}.${section}.${value}`).toBeTruthy();
        }
      });
    }
  }

  it('never gives two states in one section the same words', () => {
    // Two states sharing a label is the bug this file exists for: an assignment
    // that was withdrawn read exactly like one still held.
    for (const locale of LOCALES) {
      for (const [section, values] of Object.entries(SECTIONS)) {
        const labels = dictionaries[locale][section as keyof typeof SECTIONS] as Record<string, string>;
        const used = values.map((v) => labels[v]);
        expect(new Set(used).size, `${locale}.${section}: ${used.join(' / ')}`).toBe(values.length);
      }
    }
  });
});
