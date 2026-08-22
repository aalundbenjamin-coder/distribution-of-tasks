/**
 * Consent.
 *
 * Consent rows are append-only. Withdrawing marketing permission writes a new
 * row with granted=false rather than deleting or updating the old one, so the
 * question "what had this person agreed to on the day we sent that message?"
 * always has an answer.
 *
 * The terms of service and privacy policy carry a version. If the documents
 * change, `TERMS_VERSION` is bumped and everyone is asked again — an old
 * acceptance is not silently carried over to new terms.
 */

import { prisma } from '@/lib/db';
import { CONSENT_TYPES, type ConsentSource, type ConsentType } from '@/lib/domain/enums';

/** Bump when the legal documents change. */
export const TERMS_VERSION = '2026-01-15';
export const PRIVACY_VERSION = '2026-01-15';

export function documentVersionFor(type: ConsentType): string | null {
  if (type === 'TERMS_OF_SERVICE') return TERMS_VERSION;
  if (type === 'PRIVACY_POLICY') return PRIVACY_VERSION;
  return null;
}

export interface ConsentDecision {
  type: ConsentType;
  granted: boolean;
}

export interface RecordConsentOptions {
  userId: string;
  decisions: ConsentDecision[];
  source: ConsentSource;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Write one row per decision. Never updates, never deletes. */
export async function recordConsents({
  userId,
  decisions,
  source,
  ipAddress,
  userAgent,
}: RecordConsentOptions): Promise<void> {
  if (decisions.length === 0) return;
  await prisma.consent.createMany({
    data: decisions.map((d) => ({
      userId,
      type: d.type,
      granted: d.granted,
      documentVersion: documentVersionFor(d.type),
      source,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })),
  });
}

export type ConsentState = Record<ConsentType, boolean>;

const EMPTY_STATE: ConsentState = Object.fromEntries(
  CONSENT_TYPES.map((t) => [t, false]),
) as ConsentState;

/**
 * The current answer for each consent type: the most recent row wins.
 *
 * Terms and privacy are additionally checked against the current document
 * version — an acceptance of an older version does not count as current.
 */
export async function getConsentState(userId: string): Promise<ConsentState> {
  const rows = await prisma.consent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const state: ConsentState = { ...EMPTY_STATE };
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.type)) continue;
    seen.add(row.type);
    const type = row.type as ConsentType;
    const requiredVersion = documentVersionFor(type);
    const versionOk = requiredVersion === null || row.documentVersion === requiredVersion;
    state[type] = row.granted && versionOk;
  }

  return state;
}

/** Full history, newest first — shown on the settings page. */
export async function getConsentHistory(userId: string) {
  return prisma.consent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
