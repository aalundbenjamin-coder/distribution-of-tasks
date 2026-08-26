/**
 * Every sentence the matching engine produces, in both languages.
 *
 * The engine explains its own decisions in prose, so those sentences have to be
 * translatable without the engine losing its purity — it still takes plain data
 * and returns plain data. The message catalogue is therefore passed *in*, with
 * English as the default so existing callers and tests are unaffected.
 *
 * Danish notes, because these read badly if got wrong:
 *   * "opgave" and "mappe" are common gender (en), "certifikat" and "niveau"
 *     are neuter (et) — the articles and adjective endings below follow that.
 *   * "krav" has no plural ending: et krav, flere krav.
 *   * Hours abbreviate to "t" and dates take the ordinal full stop ("5. august").
 */

import type { Locale } from '@/lib/i18n/locale';

/** Picks the singular or plural form. Both languages happen to branch at 1. */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export interface EngineMessages {
  readonly locale: Locale;

  /**
   * How this language writes a date inside a sentence. Danish wants
   * "5. august 2026"; an ISO string reads like a serial number.
   */
  formatDate(date: Date): string;

  /** 0-5 capability levels, used inside the "needs X, has Y" sentence. */
  levelLabels: Record<number, string>;
  /** Availability states, used inside the "currently …" sentence. */
  availabilityLabels: Record<string, string>;

  // --- gate ---------------------------------------------------------------
  notAvailable(statusLabel: string): string;
  notAvailableUntil(date: string): string;
  availableOnlyUntil(until: string, dueAt: string): string;
  availabilityEnded(date: string): string;
  excluded(reason: string): string;
  wrongPosition(required: string, held: string): string;
  wrongDepartment(required: string, held: string): string;
  missingLanguage(language: string): string;
  missingSkill(skill: string): string;
  certificationMissing(skill: string): string;
  certificationExpired(skill: string, date: string): string;
  levelTooLow(skill: string, needLabel: string, need: number, hasLabel: string, has: number): string;
  noCapacity(needed: number, free: number, capacity: number): string;
  noPosition: string;

  // --- requirement findings ------------------------------------------------
  findingCertificationNotHeld: string;
  findingSkillNotRegistered: string;
  findingExpired(date: string): string;
  findingBelowLevel(held: number, required: number): string;
  findingHeld: string;
  findingValidUntil(date: string): string;
  findingLevel(level: number, surplus: number, verified: boolean): string;

  // --- factors -------------------------------------------------------------
  factorLabels: Record<string, string>;
  factorDescriptions: Record<string, string>;
  detailSkillSurplus(above: number, total: number): string;
  detailSkillMet(met: number, total: number): string;
  detailNoRequirements: string;
  detailVerified(verified: number, total: number): string;
  detailNothingToVerify: string;
  detailExperience(years: string): string;
  detailNoOverlap: string;
  detailCapacity(free: string, capacity: string): string;
  detailWorkload(open: number, busiest: number): string;
  detailNobodyBusy: string;
  detailDeadlinePassed: string;
  detailDeadline(freeHours: string, estimate: number): string;
  detailNoDeadline: string;
  detailContext(position: string, department: string): string;
  detailHoldsPosition(position: string): string;
  detailNoPositionYet: string;

  // --- outcomes ------------------------------------------------------------
  summaryAssigned(name: string, pct: number, eligible: number): string;
  summaryProposed(name: string, pct: number): string;
  summaryAmbiguous(tied: number, epsilonPct: number): string;
  summaryBelowMinimum(name: string, pct: number, minimumPct: number): string;
  summaryNobodyToConsider: string;
  summaryAllAtCapacity(atCapacity: number): string;
  summaryNobodyQualified(checked: number): string;
  rationale(name: string, pct: number, met: number, total: number, factors: string): string;
  rationaleNoRequirements(name: string, pct: number, factors: string): string;
  rationaleOthersTied(others: number): string;
  describeFactor(label: string, pct: number): string;
  noComparableFactors: string;

  // --- tie-breaks ----------------------------------------------------------
  tieOpenTasks(other: string, mine: number, theirs: number): string;
  tieCommittedHours(other: string, mine: number, theirs: number): string;
  tieWaitedLonger(other: string, myDays: number, theirDays: number): string;
  tieNeverAssigned(other: string): string;
  tieLifetimeCount(other: string, mine: number, theirs: number): string;
  tieVerified(other: string, mine: number, theirs: number): string;
  tieCombinedLevel(other: string, mine: number, theirs: number): string;
  tieIdentifier(other: string): string;
}

// ===========================================================================
// English
// ===========================================================================

export const EN_MESSAGES: EngineMessages = {
  locale: 'en',

  formatDate: (d) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  levelLabels: { 0: 'None', 1: 'Awareness', 2: 'Assisted', 3: 'Independent', 4: 'Advanced', 5: 'Expert' },
  availabilityLabels: {
    ACTIVE: 'Available',
    ON_LEAVE: 'On leave',
    UNAVAILABLE: 'Temporarily unavailable',
    OFFBOARDED: 'Offboarded',
  },

  notAvailable: (s) => `Currently ${s.toLowerCase()}.`,
  notAvailableUntil: (d) => `Not available until ${d}.`,
  availableOnlyUntil: (u, due) => `Available only until ${u}, task is due ${due}.`,
  availabilityEnded: (d) => `Availability ended ${d}.`,
  excluded: (r) => `Excluded from this task: ${r}`,
  wrongPosition: (req, held) => `Task is restricted to ${req}; holds ${held}.`,
  wrongDepartment: (req, held) => `Task is restricted to ${req}; works in ${held}.`,
  missingLanguage: (l) => `Does not speak ${l}.`,
  missingSkill: (s) => `Missing ${s}.`,
  certificationMissing: (s) => `Does not hold the ${s} certification.`,
  certificationExpired: (s, d) => `${s} certification expired ${d}.`,
  levelTooLow: (s, nl, n, hl, h) => `${s}: needs ${nl} (${n}), has ${hl} (${h}).`,
  noCapacity: (need, free, cap) =>
    `Needs ${need} h but only ${free} h of ${cap} h remain this week.`,
  noPosition: 'no position',

  findingCertificationNotHeld: 'Certification not held',
  findingSkillNotRegistered: 'Capability not registered',
  findingExpired: (d) => `Expired ${d}`,
  findingBelowLevel: (h, r) => `${h} of ${r} required`,
  findingHeld: 'Held',
  findingValidUntil: (d) => `Valid until ${d}`,
  findingLevel: (l, s, v) => `Level ${l}${s > 0 ? ` (+${s})` : ''}${v ? ', verified' : ''}`,

  factorLabels: {
    skillFit: 'Capability fit',
    verification: 'Verified capabilities',
    experience: 'Experience',
    capacityHeadroom: 'Capacity headroom',
    workloadBalance: 'Workload balance',
    deadlineFit: 'Deadline feasibility',
    contextFit: 'Position & department fit',
  },
  factorDescriptions: {
    skillFit: 'How far the coworker clears each required level, plus credit for preferred capabilities.',
    verification: 'Share of the required capabilities that a lead has signed off on.',
    experience: 'Years of hands-on experience in the required capabilities.',
    capacityHeadroom: 'How much of the working week is still free after taking this task.',
    workloadBalance: 'How this coworker’s open workload compares with the rest of the shortlist.',
    deadlineFit: 'Whether the free hours before the deadline comfortably cover the estimate.',
    contextFit: 'Whether the coworker’s position and department line up with the task.',
  },
  detailSkillSurplus: (a, t) => `Clears every required level, above the bar on ${a} of ${t}.`,
  detailSkillMet: (m, t) => `Meets ${m} of ${t} listed capabilities.`,
  detailNoRequirements: 'The task lists no capability requirements.',
  detailVerified: (v, t) => `${v} of ${t} required capabilities signed off by a lead.`,
  detailNothingToVerify: 'No mandatory capabilities to verify.',
  detailExperience: (y) => `${y} years average in the required capabilities.`,
  detailNoOverlap: 'No overlapping capabilities to measure experience on.',
  detailCapacity: (f, c) => `${f} h of ${c} h still free after this task.`,
  detailWorkload: (o, b) =>
    `${o} open task${plural(o, '', 's')}; busiest on the shortlist has ${b}.`,
  detailNobodyBusy: 'Nobody on the shortlist has open work.',
  detailDeadlinePassed: 'The deadline has already passed.',
  detailDeadline: (h, e) => `About ${h} free hours before the deadline against a ${e} h estimate.`,
  detailNoDeadline: 'The task has no deadline.',
  detailContext: (p, d) => `${p} · ${d}.`,
  detailHoldsPosition: (p) => `Holds the position ${p}.`,
  detailNoPositionYet: 'No position assigned to this coworker yet.',

  summaryAssigned: (n, p, e) =>
    `${n} matched at ${p}% out of ${e} qualified coworker${plural(e, '', 's')}.`,
  summaryProposed: (n, p) =>
    `${n} is the strongest match at ${p}%. This folder proposes rather than assigns, so a head of distribution confirms.`,
  summaryAmbiguous: (t, e) =>
    `${t} coworkers are equally qualified for this task (within ${e}% of each other). This folder is set to ask a person rather than pick one.`,
  summaryBelowMinimum: (n, p, m) =>
    `The strongest qualified coworker, ${n}, scores ${p}%, below this folder's ${m}% threshold. A head of distribution should confirm before the task goes out.`,
  summaryNobodyToConsider: 'No coworkers were available to consider for this task.',
  summaryAllAtCapacity: (a) =>
    `No coworker can take this task. ${a} qualified coworker${a === 1 ? ' is' : 's are'} at full capacity this week; the rest do not meet the requirements.`,
  summaryNobodyQualified: (c) =>
    `No coworker meets every requirement of this task. ${c} profile${c === 1 ? ' was' : 's were'} checked.`,
  rationale: (n, p, m, t, f) => `${n} scored ${p}%, meeting ${m} of ${t} listed capabilities, ${f}.`,
  rationaleNoRequirements: (n, p, f) =>
    `${n} scored ${p}%, with no capability requirements to check, ${f}.`,
  rationaleOthersTied: (o) =>
    `${o} other coworker${o === 1 ? ' was' : 's were'} within the tie band.`,
  describeFactor: (l, p) => `${l.toLowerCase()} ${p}%`,
  noComparableFactors: 'No comparable factors.',

  tieOpenTasks: (o, m, t) =>
    `Same score as ${o}; chosen because they carry ${m} open task${plural(m, '', 's')} against ${t}.`,
  tieCommittedHours: (o, m, t) =>
    `Same score and task count as ${o}; chosen on the lighter committed load (${m} h against ${t} h).`,
  tieWaitedLonger: (o, md, td) =>
    `Same score as ${o}; chosen because they have waited longer since their last task (${md} day${plural(md, '', 's')}, against ${td}).`,
  tieNeverAssigned: (o) =>
    `Same score as ${o}; chosen because they have not been assigned a task yet.`,
  tieLifetimeCount: (o, m, t) =>
    `Same score as ${o}; chosen on the lower lifetime assignment count (${m} against ${t}).`,
  tieVerified: (o, m, t) =>
    `Same score as ${o}; chosen on more lead-verified capabilities (${m} against ${t}).`,
  tieCombinedLevel: (o, m, t) =>
    `Same score as ${o}; chosen on the higher combined capability level (${m} against ${t}).`,
  tieIdentifier: (o) =>
    `Indistinguishable from ${o} on every ranking rule; separated only by a stable identifier tie-break.`,
};

// ===========================================================================
// Dansk
// ===========================================================================

export const DA_MESSAGES: EngineMessages = {
  locale: 'da',

  formatDate: (d) =>
    d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }),
  levelLabels: { 0: 'Ingen', 1: 'Kendskab', 2: 'Med støtte', 3: 'Selvstændig', 4: 'Avanceret', 5: 'Ekspert' },
  availabilityLabels: {
    ACTIVE: 'Ledig',
    ON_LEAVE: 'På orlov',
    UNAVAILABLE: 'Midlertidigt utilgængelig',
    OFFBOARDED: 'Fratrådt',
  },

  notAvailable: (s) => `Er ${s.toLowerCase()}.`,
  notAvailableUntil: (d) => `Er først til rådighed fra den ${d}.`,
  availableOnlyUntil: (u, due) =>
    `Er kun til rådighed til den ${u}, men opgaven har frist den ${due}.`,
  availabilityEnded: (d) => `Var kun til rådighed til den ${d}.`,
  excluded: (r) => `Udelukket fra denne opgave: ${r}`,
  wrongPosition: (req, held) => `Opgaven kræver stillingen ${req}; medarbejderen har ${held}.`,
  wrongDepartment: (req, held) => `Opgaven er forbeholdt ${req}; medarbejderen arbejder i ${held}.`,
  missingLanguage: (l) => `Taler ikke ${l}.`,
  missingSkill: (s) => `Mangler kompetencen ${s}.`,
  certificationMissing: (s) => `Har ikke certifikatet ${s}.`,
  certificationExpired: (s, d) => `Certifikatet ${s} udløb den ${d}.`,
  levelTooLow: (s, nl, n, hl, h) => `${s}: kræver ${nl} (${n}), har ${hl} (${h}).`,
  noCapacity: (need, free, cap) =>
    `Kræver ${need} t, men der er kun ${free} t tilbage af ${cap} t i denne uge.`,
  noPosition: 'ingen stilling',

  findingCertificationNotHeld: 'Certifikat ikke opnået',
  findingSkillNotRegistered: 'Kompetence ikke registreret',
  findingExpired: (d) => `Udløbet ${d}`,
  findingBelowLevel: (h, r) => `${h} af de krævede ${r}`,
  findingHeld: 'Opnået',
  findingValidUntil: (d) => `Gyldigt til ${d}`,
  findingLevel: (l, s, v) => `Niveau ${l}${s > 0 ? ` (+${s})` : ''}${v ? ', verificeret' : ''}`,

  factorLabels: {
    skillFit: 'Kompetencematch',
    verification: 'Verificerede kompetencer',
    experience: 'Erfaring',
    capacityHeadroom: 'Ledig kapacitet',
    workloadBalance: 'Fordeling af arbejdsbyrde',
    deadlineFit: 'Tid nok til fristen',
    contextFit: 'Stilling og afdeling',
  },
  factorDescriptions: {
    skillFit: 'Hvor langt medarbejderen ligger over hvert krævet niveau, plus point for ønskede kompetencer.',
    verification: 'Hvor stor en del af de krævede kompetencer en leder har godkendt.',
    experience: 'Antal års praktisk erfaring inden for de krævede kompetencer.',
    capacityHeadroom: 'Hvor stor en del af arbejdsugen der stadig er ledig, når opgaven er taget.',
    workloadBalance: 'Hvordan medarbejderens åbne arbejdsbyrde ser ud sammenlignet med resten af listen.',
    deadlineFit: 'Om de ledige timer inden fristen med god margin dækker estimatet.',
    contextFit: 'Om medarbejderens stilling og afdeling passer til opgaven.',
  },
  detailSkillSurplus: (a, t) =>
    `Opfylder alle krævede niveauer og ligger over kravet på ${a} af ${t}.`,
  detailSkillMet: (m, t) => `Opfylder ${m} af ${t} angivne kompetencer.`,
  detailNoRequirements: 'Opgaven stiller ingen kompetencekrav.',
  detailVerified: (v, t) => `${v} af ${t} krævede kompetencer er godkendt af en leder.`,
  detailNothingToVerify: 'Ingen obligatoriske kompetencer at verificere.',
  detailExperience: (y) => `${y} års erfaring i gennemsnit inden for de krævede kompetencer.`,
  detailNoOverlap: 'Ingen overlappende kompetencer at måle erfaring på.',
  detailCapacity: (f, c) => `${f} t af ${c} t er stadig ledige efter denne opgave.`,
  detailWorkload: (o, b) =>
    `${o} ${plural(o, 'åben opgave', 'åbne opgaver')}; den travleste på listen har ${b}.`,
  detailNobodyBusy: 'Ingen på listen har åbne opgaver.',
  detailDeadlinePassed: 'Fristen er allerede overskredet.',
  detailDeadline: (h, e) =>
    `Cirka ${h} ledige timer inden fristen mod et estimat på ${e} t.`,
  detailNoDeadline: 'Opgaven har ingen frist.',
  detailContext: (p, d) => `${p} · ${d}.`,
  detailHoldsPosition: (p) => `Har stillingen ${p}.`,
  detailNoPositionYet: 'Medarbejderen har endnu ingen stilling.',

  summaryAssigned: (n, p, e) =>
    `${n} matchede med ${p}% ud af ${e} ${plural(e, 'kvalificeret medarbejder', 'kvalificerede medarbejdere')}.`,
  summaryProposed: (n, p) =>
    `${n} er det stærkeste match med ${p}%. Denne mappe foreslår i stedet for at tildele, så en fordelingsansvarlig godkender.`,
  summaryAmbiguous: (t, e) =>
    `${t} medarbejdere er lige kvalificerede til denne opgave (inden for ${e}% af hinanden). Denne mappe er indstillet til at spørge et menneske frem for selv at vælge.`,
  summaryBelowMinimum: (n, p, m) =>
    `Den stærkeste kvalificerede medarbejder, ${n}, får ${p}%, hvilket er under mappens grænse på ${m}%. En fordelingsansvarlig bør godkende, før opgaven sendes ud.`,
  summaryNobodyToConsider: 'Der var ingen medarbejdere at overveje til denne opgave.',
  summaryAllAtCapacity: (a) =>
    `Ingen medarbejder kan tage denne opgave. ${a} ${plural(a, 'kvalificeret medarbejder har', 'kvalificerede medarbejdere har')} fuld kapacitet i denne uge; resten opfylder ikke kravene.`,
  summaryNobodyQualified: (c) =>
    `Ingen medarbejder opfylder alle krav til denne opgave. ${c} ${plural(c, 'profil blev', 'profiler blev')} kontrolleret.`,
  rationale: (n, p, m, t, f) =>
    `${n} fik ${p}% og opfylder ${m} af ${t} angivne kompetencer: ${f}.`,
  rationaleNoRequirements: (n, p, f) =>
    `${n} fik ${p}%, uden kompetencekrav at kontrollere: ${f}.`,
  rationaleOthersTied: (o) =>
    `${o} ${plural(o, 'anden medarbejder lå', 'andre medarbejdere lå')} inden for samme spænd.`,
  describeFactor: (l, p) => `${l.toLowerCase()} ${p}%`,
  noComparableFactors: 'Ingen sammenlignelige faktorer.',

  tieOpenTasks: (o, m, t) =>
    `Samme score som ${o}; valgt fordi vedkommende har ${m} ${plural(m, 'åben opgave', 'åbne opgaver')} mod ${t}.`,
  tieCommittedHours: (o, m, t) =>
    `Samme score og opgaveantal som ${o}; valgt på den lettere arbejdsbyrde (${m} t mod ${t} t).`,
  tieWaitedLonger: (o, md, td) =>
    `Samme score som ${o}; valgt fordi der er gået længere tid siden sidste opgave (${md} ${plural(md, 'dag', 'dage')} mod ${td}).`,
  tieNeverAssigned: (o) =>
    `Samme score som ${o}; valgt fordi vedkommende endnu ikke har fået tildelt en opgave.`,
  tieLifetimeCount: (o, m, t) =>
    `Samme score som ${o}; valgt på det lavere samlede antal tildelinger (${m} mod ${t}).`,
  tieVerified: (o, m, t) =>
    `Samme score som ${o}; valgt på flere ledergodkendte kompetencer (${m} mod ${t}).`,
  tieCombinedLevel: (o, m, t) =>
    `Samme score som ${o}; valgt på det højere samlede kompetenceniveau (${m} mod ${t}).`,
  tieIdentifier: (o) =>
    `Kan ikke skelnes fra ${o} på nogen rangeringsregel; adskilt alene af en fast identifikator.`,
};

export const ENGINE_MESSAGES: Record<Locale, EngineMessages> = {
  en: EN_MESSAGES,
  da: DA_MESSAGES,
};

export function engineMessagesFor(locale: Locale): EngineMessages {
  return ENGINE_MESSAGES[locale] ?? EN_MESSAGES;
}
