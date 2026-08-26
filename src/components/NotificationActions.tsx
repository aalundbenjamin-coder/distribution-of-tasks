'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead } from '@/app/actions/notifications';
import { CheckIcon } from './icons';

export function MarkAllReadButton({ labels }: { labels: { mark: string; marking: string } }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      {pending ? (
        <><span className="spin" /> {labels.marking}</>
      ) : (
        <><CheckIcon size={15} /> {labels.mark}</>
      )}
    </button>
  );
}
