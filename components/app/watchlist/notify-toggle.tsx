'use client';

import { useTransition } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { toggleWatchlistNotifyAction } from '@/app/app/watchlist/actions';

// Per-entry e-mail alert toggle — the real control behind watchlist alerts
// (writes watchlist.notify_by_email).
export function NotifyToggle({ id, notifyByEmail }: { id: string; notifyByEmail: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      fd.set('notify', notifyByEmail ? '0' : '1');
      const result = await toggleWatchlistNotifyAction(fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(notifyByEmail ? 'E-mail alerty vypnuté.' : 'E-mail alerty zapnuté.');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={notifyByEmail ? 'Vypnúť e-mail alerty' : 'Zapnúť e-mail alerty'}
      className={
        notifyByEmail
          ? 'bg-primary/15 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-opacity disabled:opacity-50'
          : 'bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-opacity disabled:opacity-50'
      }
    >
      {notifyByEmail ? <Bell className="size-3" /> : <BellOff className="size-3" />}
      {notifyByEmail ? 'E-mail zapnutý' : 'E-mail vypnutý'}
    </button>
  );
}
