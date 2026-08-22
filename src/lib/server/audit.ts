/**
 * Append-only audit trail.
 *
 * Recording an event must never be the reason a user-facing action fails, so
 * every write is best-effort and logged rather than thrown.
 */

import { prisma } from '@/lib/db';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  data?: unknown;
  ipAddress?: string | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        dataJson: JSON.stringify(input.data ?? {}),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error('Could not write audit event', input.action, error);
  }
}

export async function recentAuditEvents(limit = 50) {
  return prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { fullName: true, avatarColor: true } } },
  });
}
