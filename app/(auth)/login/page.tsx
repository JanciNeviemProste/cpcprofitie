import Link from 'next/link';
import { Suspense } from 'react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

export const metadata = { title: 'Prihlásenie' };

export default function LoginPage() {
  return (
    <div className="bg-card/40 border-border/60 w-full max-w-md rounded-2xl border p-8 shadow-2xl backdrop-blur">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Prihlásenie do CPCProfit</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pokračujte cez Google. Žiadne ďalšie heslá na zapamätanie.
        </p>
      </div>

      <div className="mt-8">
        <Suspense fallback={null}>
          <GoogleSignInButton label="Pokračovať s Google" />
        </Suspense>
      </div>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Nemáte účet?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Vytvoriť účet
        </Link>
      </p>

      <p className="text-muted-foreground mt-8 text-center text-xs">
        Prihlásením súhlasíte s{' '}
        <Link href="/legal/terms" className="hover:text-foreground underline">
          obchodnými podmienkami
        </Link>{' '}
        a{' '}
        <Link href="/legal/privacy-policy" className="hover:text-foreground underline">
          ochranou údajov
        </Link>
        .
      </p>
    </div>
  );
}
