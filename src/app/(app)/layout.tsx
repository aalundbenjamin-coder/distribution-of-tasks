import { redirect } from 'next/navigation';
import TopBar, { type NavItem } from '@/components/TopBar';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { USER_ROLE_LABELS } from '@/lib/domain/enums';
import { canDistribute, canManageAccounts } from '@/lib/server/permissions';

/**
 * The signed-in shell.
 *
 * Navigation is built from the role, so a coworker is never shown a link into
 * a screen they cannot open — the permission checks on the pages themselves
 * remain the real guard, this just avoids dead ends.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const navItems: NavItem[] = [{ href: '/dashboard', label: 'Overview' }];

  if (canDistribute(user.role)) {
    navItems.push(
      { href: '/folders', label: 'Folders' },
      { href: '/tasks', label: 'Tasks' },
      { href: '/coworkers', label: 'Coworkers' },
      { href: '/positions', label: 'Positions' },
      { href: '/skills', label: 'Capabilities' },
    );
  } else {
    navItems.push({ href: '/tasks', label: 'My tasks' }, { href: '/coworkers/me', label: 'My profile' });
  }

  if (canManageAccounts(user.role)) navItems.push({ href: '/audit', label: 'Audit' });

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <>
      <TopBar
        navItems={navItems}
        unread={unread}
        user={{
          fullName: user.fullName,
          avatarColor: user.avatarColor,
          email: user.email,
          phone: user.phone,
          roleLabel: USER_ROLE_LABELS[user.role],
        }}
        notifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          severity: n.severity,
          category: n.category,
          createdAt: n.createdAt.toISOString(),
          read: n.readAt !== null,
        }))}
      />
      <main className="shell" style={{ padding: '28px 24px 72px' }}>
        {children}
      </main>
    </>
  );
}
