'use client';

import { useActionState } from 'react';
import { requestPasswordResetAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);
  // Server action returns `{ error: '' }` on success — empty string signals "sent".
  const sent = state !== undefined && state.error === '';

  if (sent) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
        Ak účet s týmto e-mailom existuje, poslali sme vám link na obnovenie hesla. Skontrolujte si
        schránku.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required disabled={pending} />
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Posielam…' : 'Poslať obnovovací link'}
      </Button>
    </form>
  );
}
