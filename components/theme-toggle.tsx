'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const subscribeNoop = () => () => {};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid hydration mismatch — render the icon only after the client mount.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`}
    >
      {mounted ? (
        isDark ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}
