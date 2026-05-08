'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/auth/client';

export function GoogleSignInButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const next = params.get('next') ?? '/app/overview';

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError('Prihlásenie zatiaľ nie je nakonfigurované (chýbajú Supabase env premenné).');
        setLoading(false);
        return;
      }
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznáma chyba');
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={loading}
        onClick={handleClick}
      >
        <GoogleLogo className="size-4" />
        {loading ? 'Presmerovávam…' : label}
      </Button>
      {error && <p className="text-destructive mt-3 text-center text-sm">{error}</p>}
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M5.27 9.76A7.08 7.08 0 0 1 12 5c1.93 0 3.55.7 4.7 1.78l3.27-3.21A11.83 11.83 0 0 0 12 0C7.31 0 3.26 2.69 1.28 6.62l3.99 3.14Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.79-3.13c-1 .73-2.28 1.16-4.16 1.16-3.18 0-5.86-2.09-6.83-4.92l-4.06 3.16C2.96 21.31 7.18 24 12 24Z"
      />
      <path
        fill="#4A90E2"
        d="M23.49 12.27c0-.79-.08-1.55-.21-2.27H12v4.57h6.46c-.32 1.61-1.32 2.96-2.86 3.91l3.79 3.13c2.21-2.04 3.49-5.04 3.49-8.34Z"
      />
      <path
        fill="#FBBC05"
        d="M5.17 14.2A7.04 7.04 0 0 1 4.81 12c0-.77.13-1.51.36-2.2L1.18 6.62A11.94 11.94 0 0 0 0 12c0 1.92.46 3.74 1.28 5.36l3.89-3.16Z"
      />
    </svg>
  );
}
