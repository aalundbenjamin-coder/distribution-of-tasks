'use client';

/**
 * The bell in the top-right corner.
 *
 * This is the channel that always works. Whether or not someone agreed to
 * e-mail or SMS, everything the system wants to tell them — a task landing on
 * their desk, a folder that could not be routed, a new feature — is here.
 *
 * It refreshes on an interval and whenever the tab regains focus, so a
 * distribution that happens while the page is open shows up without a reload.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type BellNotification,
} from '@/app/actions/notifications';
import { AlertIcon, BellIcon, CheckIcon, SparkIcon } from './icons';

const POLL_MS = 45_000;

function severityColour(severity: string): string {
  if (severity === 'CRITICAL') return 'var(--danger)';
  if (severity === 'WARNING') return 'var(--warn)';
  if (severity === 'SUCCESS') return 'var(--ok)';
  return 'var(--accent)';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({
  initialItems,
  initialUnread,
}: {
  initialItems: BellNotification[];
  initialUnread: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // A failed poll is not worth interrupting anyone over; the next one runs
      // in 45 seconds.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, refresh]);

  function handleOpen(item: BellNotification) {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      startTransition(() => {
        void markNotificationRead(item.id);
      });
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  function handleMarkAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    startTransition(() => {
      void markAllNotificationsRead();
    });
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="bell-btn"
        data-open={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon size={19} />
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="bell-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="bell-panel" role="dialog" aria-label="Notifications">
            <div className="card-header" style={{ padding: '13px 16px' }}>
              <div>
                <div className="card-title">Notifications</div>
                <div className="card-sub">
                  {unread > 0 ? `${unread} unread` : 'Everything here is read'}
                </div>
              </div>
              {unread > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleMarkAll}>
                  <CheckIcon size={14} /> Mark all read
                </button>
              )}
            </div>

            <div className="bell-list">
              {items.length === 0 ? (
                <div className="empty" style={{ padding: '34px 20px' }}>
                  Nothing yet. New tasks, decisions that need you and product news
                  all land here.
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="bell-item"
                    data-unread={!item.read}
                    onClick={() => handleOpen(item)}
                  >
                    <span className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                      <span style={{ color: severityColour(item.severity), marginTop: 1, flex: 'none' }}>
                        {item.category === 'MARKETING' ? (
                          <SparkIcon size={15} />
                        ) : item.severity === 'WARNING' || item.severity === 'CRITICAL' ? (
                          <AlertIcon size={15} />
                        ) : (
                          <CheckIcon size={15} />
                        )}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span
                          style={{
                            display: 'block',
                            fontWeight: item.read ? 520 : 640,
                            fontSize: 13.5,
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          className="tiny muted"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginTop: 2,
                          }}
                        >
                          {item.body}
                        </span>
                        <span className="tiny subtle" style={{ display: 'block', marginTop: 4 }}>
                          {timeAgo(item.createdAt)}
                          {item.category === 'MARKETING' && ' · product news'}
                        </span>
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div style={{ padding: 11, borderTop: '1px solid var(--border)' }}>
              <Link
                href="/notifications"
                className="btn btn-ghost btn-sm btn-block"
                onClick={() => setOpen(false)}
              >
                See everything
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
