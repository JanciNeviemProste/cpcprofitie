'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UpdatePasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Supabase delivers the recovery session via URL hash (#access_token=…&type=recovery).
  // The browser client parses it on mount; wait until a session exists before allowing submit.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Obnovenie hesla je dočasne nedostupné.');
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value;
    if (password.length < 6) return setError('Heslo musí mať aspoň 6 znakov.');
    if (password !== confirm) return setError('Heslá sa nezhodujú.');

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setPending(false);
      setError('Obnovenie hesla je dočasne nedostupné.');
      return;
    }
    const { error: e2 } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (e2) return setError(e2.message);
    router.push('/app/overview');
  }

  if (!ready) {
    return (
      <p className="text-muted-foreground text-sm">
        {error ?? 'Overujem obnovovací link…'}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Nové heslo</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Potvrdenie</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={6} disabled={pending} />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Ukladám…' : 'Nastaviť nové heslo'}
      </Button>
    </form>
  );
}
