'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { assertUser } from '@/lib/server/permissions';

/** Mark one notification read. Scoped to the caller's own rows. */
export async function markNotificationRead(notificationId: string) {
  const user = await assertUser();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath('/', 'layout');
}

export async function markAllNotificationsRead() {
  const user = await assertUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath('/', 'layout');
}

/** Freshest notifications for the bell, plus the unread count. */
export async function fetchNotifications(limit = 12) {
  const user = await assertUser();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      severity: n.severity,
      category: n.category,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
    })),
  };
}

export type BellNotification = Awaited<ReturnType<typeof fetchNotifications>>['items'][number];
