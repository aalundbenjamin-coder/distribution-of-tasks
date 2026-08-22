/**
 * Deciding who hears about what, and through which channel.
 *
 * The rule the product is built on:
 *
 *   The bell in the top-right corner always gets the message.
 *   E-mail and SMS only go out when the person has said yes.
 *
 * So a coworker who never ticks the marketing box still sees every new feature
 * and every task assigned to them — they just see it in the app instead of in
 * their inbox. Consent widens the reach of a notification; it is never the
 * thing that decides whether the notification exists.
 *
 * Two consent scopes are kept apart on purpose, because they are genuinely
 * different asks:
 *   * OPERATIONAL_* — "tell me when work lands on my desk";
 *   * MARKETING_*   — "tell me about the product".
 */

import { prisma } from '@/lib/db';
import { getConsentState } from '@/lib/auth/consent';
import type {
  ConsentType,
  DeliveryStatus,
  NotificationCategory,
  NotificationSeverity,
} from '@/lib/domain/enums';
import { sendEmail, sendSms } from './transports';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  severity?: NotificationSeverity;
  category?: NotificationCategory;
}

export interface NotifyResult {
  notificationId: string;
  emailStatus: DeliveryStatus;
  smsStatus: DeliveryStatus;
  note: string | null;
}

function consentTypesFor(category: NotificationCategory): {
  email: ConsentType;
  sms: ConsentType;
} {
  return category === 'MARKETING'
    ? { email: 'MARKETING_EMAIL', sms: 'MARKETING_SMS' }
    : { email: 'OPERATIONAL_EMAIL', sms: 'OPERATIONAL_SMS' };
}

function appUrl(link?: string | null): string | null {
  if (!link) return null;
  const origin = process.env.APP_ORIGIN?.trim().replace(/\/$/, '') || 'http://localhost:3000';
  return `${origin}${link}`;
}

/**
 * Create the in-app notification and, where consent allows, mirror it to
 * e-mail and SMS.
 *
 * Delivery failures are recorded on the notification and never thrown: a task
 * assignment must not fail because a mail provider had a bad minute.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const category: NotificationCategory = input.category ?? 'OPERATIONAL';
  const severity: NotificationSeverity = input.severity ?? 'INFO';

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      status: true,
    },
  });

  if (!user) throw new Error(`Cannot notify unknown user ${input.userId}.`);

  // 1. The bell. Always written, for every category, consent or not.
  const notification = await prisma.notification.create({
    data: {
      userId: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      severity,
      category,
    },
  });

  // A deactivated account gets the record but no outbound traffic.
  if (user.status !== 'ACTIVE') {
    return finalise(notification.id, 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'Account is not active.');
  }

  const consent = await getConsentState(user.id);
  const required = consentTypesFor(category);
  const notes: string[] = [];

  // 2. E-mail --------------------------------------------------------------
  let emailStatus: DeliveryStatus = 'NOT_APPLICABLE';
  if (user.email) {
    if (!consent[required.email]) {
      emailStatus = 'SKIPPED_NO_CONSENT';
    } else if (!user.emailVerifiedAt) {
      emailStatus = 'SKIPPED_NO_CONSENT';
      notes.push('E-mail address is not verified yet.');
    } else {
      const url = appUrl(input.link);
      const result = await sendEmail({
        to: user.email,
        subject: input.title,
        text: [
          `Hello ${user.fullName.split(' ')[0]},`,
          '',
          input.body,
          ...(url ? ['', `Open it here: ${url}`] : []),
          '',
          '—',
          'Distribution of Tasks',
          'You receive this because you agreed to notifications. Change that any time under Settings → Notifications.',
        ].join('\n'),
      });
      emailStatus = result.ok ? 'SENT' : 'FAILED';
      if (result.transport === 'LOCAL') notes.push('E-mail simulated: no provider configured.');
      if (!result.ok && result.error) notes.push(`E-mail failed: ${result.error}`);
    }
  }

  // 3. SMS -----------------------------------------------------------------
  let smsStatus: DeliveryStatus = 'NOT_APPLICABLE';
  if (user.phone) {
    if (!consent[required.sms]) {
      smsStatus = 'SKIPPED_NO_CONSENT';
    } else if (!user.phoneVerifiedAt) {
      smsStatus = 'SKIPPED_NO_CONSENT';
      notes.push('Phone number is not verified yet.');
    } else {
      const url = appUrl(input.link);
      const result = await sendSms({
        to: user.phone,
        text: `${input.title}\n${input.body}${url ? `\n${url}` : ''}`.slice(0, 480),
      });
      smsStatus = result.ok ? 'SENT' : 'FAILED';
      if (result.transport === 'LOCAL') notes.push('SMS simulated: no provider configured.');
      if (!result.ok && result.error) notes.push(`SMS failed: ${result.error}`);
    }
  }

  return finalise(notification.id, emailStatus, smsStatus, notes.join(' ') || null);
}

async function finalise(
  notificationId: string,
  emailStatus: DeliveryStatus,
  smsStatus: DeliveryStatus,
  note: string | null,
): Promise<NotifyResult> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { emailStatus, smsStatus, deliveryNote: note },
  });
  return { notificationId, emailStatus, smsStatus, note };
}

/** Notify several people with the same message. Failures are isolated. */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  const results = await Promise.allSettled(userIds.map((userId) => notify({ ...input, userId })));
  return results;
}

/** Unread count for the bell. */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
