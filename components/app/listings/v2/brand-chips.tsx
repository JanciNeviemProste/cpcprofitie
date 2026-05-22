'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Make = { name: string; count: number };

export function BrandChips({
  makes,
  activeQuery,
}: {
  makes: Make[];
  activeQuery: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const trimmed = activeQuery.trim().toLowerCase();

  function setBrand(name: string | null) {
    const params = new URLSearchParams(sp.toString());
    params.delete('page');
    if (name == null) {
      params.delete('q');
    } else {
      params.set('q', name);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/app/listings/v2?${qs}` : '/app/listings/v2', { scroll: false });
    });
  }

  const allActive = trimmed === '';

  return (
    <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setBrand(null)}
          className={
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ' +
            (allActive
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-card hover:bg-muted')
          }
        >
          Všetky
        </button>
        {makes.map((m) => {
          const active = trimmed === m.name.toLowerCase();
          return (
            <button
              key={m.name}
              type="button"
              onClick={() => setBrand(m.name)}
              className={
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ' +
                (active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card hover:bg-muted')
              }
            >
              <span>{m.name}</span>
              <span
                className={
                  'tabular-nums text-xs ' + (active ? 'opacity-70' : 'text-muted-foreground')
                }
              >
                {m.count.toLocaleString('sk-SK')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
