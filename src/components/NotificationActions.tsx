'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead } from '@/app/actions/notifications';
import { CheckIcon } from './icons';

export function MarkAllReadButton() {
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
      {pending ? <><span className="spin" /> Marking…</> : <><CheckIcon size={15} /> Mark all read</>}
    </button>
  );
}
