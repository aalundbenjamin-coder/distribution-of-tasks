'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import NotificationBell from './NotificationBell';
import { Avatar } from './ui';
import type { BellNotification } from '@/app/actions/notifications';
import { ChevronDownIcon } from './icons';
import LanguageSwitcher from './LanguageSwitcher';
import type { Locale } from '@/lib/i18n/locale';

export interface NavItem {
  href: string;
  label: string;
}

export default function TopBar({
  navItems,
  user,
  notifications,
  unread,
  locale,
  labels,
}: {
  navItems: NavItem[];
  user: { fullName: string; avatarColor: string; email: string | null; phone: string | null; roleLabel: string };
  notifications: BellNotification[];
  unread: number;
  locale: Locale;
  labels: { settings: string; allNotifications: string; signOut: string; appName: string };
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="topbar">
      <div className="shell" style={{ display: 'flex', alignItems: 'center', gap: 14, height: 58 }}>
        <Link href="/dashboard" className="row" style={{ gap: 9, flex: 'none' }}>
          <LogoMark />
          <span style={{ fontWeight: 680, letterSpacing: '-0.02em', fontSize: 15 }}>
            {labels.appName}
          </span>
        </Link>

        <nav
          aria-label="Main"
          style={{ display: 'flex', gap: 2, marginLeft: 10, flex: 1, overflowX: 'auto' }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="navlink"
              data-active={isActive(item.href)}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LanguageSwitcher current={locale} compact />

        <NotificationBell initialItems={notifications} initialUnread={unread} />

        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ gap: 8, paddingLeft: 5 }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Avatar name={user.fullName} colour={user.avatarColor} />
            <ChevronDownIcon size={14} />
          </button>

          {menuOpen && (
            <>
              <div className="bell-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="bell-panel" style={{ width: 260 }} role="menu">
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 620, fontSize: 14 }}>{user.fullName}</div>
                  <div className="tiny muted" style={{ marginTop: 1 }}>
                    {user.email ?? user.phone ?? '—'}
                  </div>
                  <div style={{ marginTop: 7 }}>
                    <span className="badge">{user.roleLabel}</span>
                  </div>
                </div>
                <div style={{ padding: 7 }}>
                  <Link
                    href="/settings"
                    className="btn btn-ghost btn-sm btn-block"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    {labels.settings}
                  </Link>
                  <Link
                    href="/notifications"
                    className="btn btn-ghost btn-sm btn-block"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    {labels.allNotifications}
                  </Link>
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      className="btn btn-ghost btn-sm btn-block"
                      style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}
                      role="menuitem"
                    >
                      {labels.signOut}
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M9 11.5h6M9 16h9M9 20.5h5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle cx="22" cy="20.5" r="3.2" fill="none" stroke="#fff" strokeWidth="2" opacity="0.95" />
    </svg>
  );
}
