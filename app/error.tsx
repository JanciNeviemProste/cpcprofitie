'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-md text-center">
        <p className="text-primary text-sm font-semibold tracking-wider uppercase">Chyba</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Niečo sa pokazilo</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Stránku sa nepodarilo načítať. Skúste to znova alebo nás kontaktujte na{' '}
          <a href="mailto:hello@cpcprofit.sk" className="text-primary hover:underline">
            hello@cpcprofit.sk
          </a>
          .
        </p>
        {error.digest && (
          <p className="text-muted-foreground mt-4 font-mono text-xs">
            Referencia: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset} size="sm">
            Skúsiť znova
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/" />}>
            Späť na úvod
          </Button>
        </div>
      </div>
    </div>
  );
}
