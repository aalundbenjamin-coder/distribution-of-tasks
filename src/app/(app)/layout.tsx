import { redirect } from 'next/navigation';
import TopBar, { type NavItem } from '@/components/TopBar';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getTranslations } from '@/lib/i18n';
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

  const { locale, t } = await getTranslations();

  const navItems: NavItem[] = [{ href: '/dashboard', label: t.nav.overview }];

  if (canDistribute(user.role)) {
    navItems.push(
      { href: '/folders', label: t.nav.folders },
      { href: '/tasks', label: t.nav.tasks },
      { href: '/coworkers', label: t.nav.coworkers },
      { href: '/positions', label: t.nav.positions },
      { href: '/skills', label: t.nav.capabilities },
    );
  } else {
    navItems.push(
      { href: '/tasks', label: t.nav.myTasks },
      { href: '/coworkers/me', label: t.nav.myProfile },
    );
  }

  if (canManageAccounts(user.role)) navItems.push({ href: '/audit', label: t.nav.audit });

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
        locale={locale}
        labels={{
          settings: t.nav.settings,
          allNotifications: t.nav.allNotifications,
          signOut: t.common.signOut,
          appName: t.meta.appName,
        }}
        user={{
          fullName: user.fullName,
          avatarColor: user.avatarColor,
          email: user.email,
          phone: user.phone,
          roleLabel: t.roles[user.role],
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
