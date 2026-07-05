'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type DeleteAction = (formData: FormData) => Promise<{ error: string } | void>;

// Shared card-corner delete button for garage/watchlist entries. Native
// confirm() keeps this dependency-free (no dialog primitive in components/ui).
export function DeleteEntryButton({
  id,
  action,
  confirmText,
  successText,
}: {
  id: string;
  action: DeleteAction;
  confirmText: string;
  successText: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      const result = await action(fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(successText);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label="Vymazať"
      title="Vymazať"
      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
