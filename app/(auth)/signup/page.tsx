import Link from 'next/link';
import { Suspense } from 'react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

export const metadata = { title: 'Vytvoriť účet' };

export default function SignupPage() {
  return (
    <div className="bg-card/40 border-border/60 w-full max-w-md rounded-2xl border p-8 shadow-2xl backdrop-blur">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Vytvorte si účet</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          7 dní zadarmo. Bez platobnej karty. Bez záväzku.
        </p>
      </div>

      <div className="mt-8">
        <Suspense fallback={null}>
          <GoogleSignInButton label="Pokračovať s Google" />
        </Suspense>
      </div>

      <ul className="text-muted-foreground mt-6 space-y-2 text-sm">
        <li>· 3 kompletné analýzy modelov</li>
        <li>· 3 AI generované inzeráty</li>
        <li>· Sledovanie 1 modelu s e-mail alertom</li>
      </ul>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Už máte účet?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Prihlásiť sa
        </Link>
      </p>

      <p className="text-muted-foreground mt-8 text-center text-xs">
        Vytvorením účtu súhlasíte s{' '}
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
